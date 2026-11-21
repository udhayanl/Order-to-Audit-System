import { Prisma, PaymentMethod } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface RecordPaymentParams {
  customerId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  userId: string;
}

export class PaymentService {
  /**
   * Record customer payment and allocate to invoice
   */
  static async recordPayment(params: RecordPaymentParams) {
    if (params.amount <= 0) {
      throw new AppError('Payment amount must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      let targetInvoice: any = null;

      if (params.invoiceId) {
        targetInvoice = await tx.invoice.findUnique({
          where: { id: params.invoiceId },
        });

        if (!targetInvoice) throw new AppError('Invoice not found.', 404);
        if (targetInvoice.customerId !== params.customerId) {
          throw new AppError('Invoice does not belong to the selected customer.');
        }

        const outstanding = Number(targetInvoice.outstandingAmount);
        if (params.amount > outstanding + 0.01) {
          throw new AppError(
            `Payment amount (₹${params.amount.toFixed(2)}) exceeds invoice outstanding balance (₹${outstanding.toFixed(2)}).`
          );
        }
      }

      // Generate payment number e.g. PMT-2026-0001
      const count = await tx.payment.count();
      const paymentNumber = `PMT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId: params.customerId,
          paymentDate: new Date(),
          amount: new Prisma.Decimal(params.amount),
          paymentMethod: params.paymentMethod,
          referenceNumber: params.referenceNumber || null,
          notes: params.notes || null,
          createdById: params.userId,
        },
      });

      // If allocated to a specific invoice
      if (targetInvoice) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: targetInvoice.id,
            amount: new Prisma.Decimal(params.amount),
          },
        });

        const newPaid = Number(targetInvoice.paidAmount) + params.amount;
        const newOutstanding = Math.max(0, Number(targetInvoice.grandTotal) - newPaid);

        await tx.invoice.update({
          where: { id: targetInvoice.id },
          data: {
            paidAmount: new Prisma.Decimal(Math.round(newPaid * 100) / 100),
            outstandingAmount: new Prisma.Decimal(Math.round(newOutstanding * 100) / 100),
          },
        });
      }

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        newValues: {
          paymentNumber,
          amount: params.amount,
          customerId: params.customerId,
          invoiceId: params.invoiceId,
        },
      });

      return payment;
    });
  }

  /**
   * Calculate customer outstanding and ageing buckets (0-30, 31-60, 61-90, 90+ days)
   */
  static async getCustomerAgeing() {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'POSTED',
        outstandingAmount: { gt: 0 },
      },
      include: { customer: true },
      orderBy: { invoiceDate: 'asc' },
    });

    const now = new Date();
    const customerMap: Record<string, {
      customerId: string;
      customerName: string;
      gstin: string | null;
      state: string;
      totalOutstanding: number;
      bucket0_30: number;
      bucket31_60: number;
      bucket61_90: number;
      bucketAbove90: number;
      invoices: any[];
    }> = {};

    for (const inv of invoices) {
      const cId = inv.customerId;
      if (!customerMap[cId]) {
        customerMap[cId] = {
          customerId: cId,
          customerName: inv.customer.name,
          gstin: inv.customer.gstin,
          state: inv.customer.state,
          totalOutstanding: 0,
          bucket0_30: 0,
          bucket31_60: 0,
          bucket61_90: 0,
          bucketAbove90: 0,
          invoices: [],
        };
      }

      const outstanding = Number(inv.outstandingAmount);
      const diffTime = Math.abs(now.getTime() - new Date(inv.invoiceDate).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      customerMap[cId].totalOutstanding += outstanding;
      customerMap[cId].invoices.push({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount),
        outstandingAmount: outstanding,
        ageDays: diffDays,
      });

      if (diffDays <= 30) {
        customerMap[cId].bucket0_30 += outstanding;
      } else if (diffDays <= 60) {
        customerMap[cId].bucket31_60 += outstanding;
      } else if (diffDays <= 90) {
        customerMap[cId].bucket61_90 += outstanding;
      } else {
        customerMap[cId].bucketAbove90 += outstanding;
      }
    }

    return Object.values(customerMap).map(c => ({
      ...c,
      totalOutstanding: Math.round(c.totalOutstanding * 100) / 100,
      bucket0_30: Math.round(c.bucket0_30 * 100) / 100,
      bucket31_60: Math.round(c.bucket31_60 * 100) / 100,
      bucket61_90: Math.round(c.bucket61_90 * 100) / 100,
      bucketAbove90: Math.round(c.bucketAbove90 * 100) / 100,
    }));
  }
}
