import { Prisma, PaymentMethod, PaymentStatus, AccountTxDirection, AccountTxType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { FinancialAccountService } from './financial-account.service.js';
import { AccountingService } from './accounting.service.js';

export interface CustomerInvoiceAllocationDto {
  invoiceId: string;
  amount: number;
}

export interface RecordCustomerPaymentDto {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  financialAccountId?: string;
  referenceNumber?: string;
  notes?: string;
  paymentDate?: Date | string;
  invoiceId?: string; // Single invoice allocation shortcut
  allocations?: CustomerInvoiceAllocationDto[]; // Multi-invoice allocation
  userId: string;
}

export class CustomerPaymentService {
  /**
   * Record a customer payment with single/multi-invoice allocation and GL entry
   */
  static async recordPayment(dto: RecordCustomerPaymentDto) {
    if (dto.amount <= 0) {
      throw new AppError('Payment amount must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Resolve customer
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) throw new AppError('Customer not found.', 404);

      // 2. Resolve financial account (Cash or Bank)
      let finAccount: any = null;
      if (dto.financialAccountId) {
        finAccount = await tx.financialAccount.findUnique({
          where: { id: dto.financialAccountId },
        });
      }
      if (!finAccount) {
        // Fallback to default cash or bank based on paymentMethod
        if (dto.paymentMethod === PaymentMethod.CASH) {
          finAccount = await tx.financialAccount.findFirst({
            where: { accountType: 'CASH' },
          });
        } else {
          finAccount = await tx.financialAccount.findFirst({
            where: { accountType: 'CURRENT_ACCOUNT' },
          });
        }
      }

      if (!finAccount) {
        throw new AppError('No suitable financial account found for payment posting.');
      }

      // 3. Build invoice allocation list
      const targetAllocations: CustomerInvoiceAllocationDto[] = [];
      if (dto.invoiceId) {
        targetAllocations.push({ invoiceId: dto.invoiceId, amount: dto.amount });
      } else if (dto.allocations && dto.allocations.length > 0) {
        targetAllocations.push(...dto.allocations);
      }

      let totalAllocated = 0;
      for (const alloc of targetAllocations) {
        totalAllocated += alloc.amount;
      }

      if (totalAllocated > dto.amount + 0.01) {
        throw new AppError(
          `Total allocated to invoices (INR ${totalAllocated.toFixed(2)}) exceeds payment amount (INR ${dto.amount.toFixed(2)}).`
        );
      }

      const advanceAmount = Math.max(0, dto.amount - totalAllocated);

      // 4. Generate Payment and Receipt Numbers
      const count = await tx.payment.count();
      const year = new Date().getFullYear();
      const paymentNumber = `PMT-${year}-${String(count + 1).padStart(4, '0')}`;
      const receiptNumber = `RCPT-${year}-${String(count + 1).padStart(4, '0')}`;

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          receiptNumber,
          customerId: dto.customerId,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: new Prisma.Decimal(dto.amount),
          paymentMethod: dto.paymentMethod,
          financialAccountId: finAccount.id,
          referenceNumber: dto.referenceNumber || null,
          notes: dto.notes || null,
          status: PaymentStatus.POSTED,
          advanceAmount: new Prisma.Decimal(advanceAmount),
          unallocatedAmount: new Prisma.Decimal(advanceAmount),
          createdById: dto.userId,
        },
      });

      // 5. Apply Allocations to Invoices
      for (const alloc of targetAllocations) {
        const inv = await tx.invoice.findUnique({
          where: { id: alloc.invoiceId },
        });

        if (!inv) throw new AppError(`Invoice ${alloc.invoiceId} not found.`, 404);
        if (inv.customerId !== dto.customerId) {
          throw new AppError(`Invoice ${inv.invoiceNumber} does not belong to customer ${customer.name}.`);
        }

        const outstanding = Number(inv.outstandingAmount);
        if (alloc.amount > outstanding + 0.01) {
          throw new AppError(
            `Allocated amount (INR ${alloc.amount.toFixed(2)}) exceeds outstanding balance (INR ${outstanding.toFixed(2)}) for invoice ${inv.invoiceNumber}.`
          );
        }

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: inv.id,
            amount: new Prisma.Decimal(alloc.amount),
          },
        });

        const newPaid = Math.round((Number(inv.paidAmount) + alloc.amount) * 100) / 100;
        const newOutstanding = Math.max(0, Math.round((Number(inv.grandTotal) - newPaid) * 100) / 100);
        const newStatus = newOutstanding <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: new Prisma.Decimal(newPaid),
            outstandingAmount: new Prisma.Decimal(newOutstanding),
            status: newStatus,
          },
        });
      }

      // 6. Record Financial Account Ledger Entry (IN)
      await FinancialAccountService.recordTransaction(tx, {
        financialAccountId: finAccount.id,
        transactionType: AccountTxType.RECEIPT,
        direction: AccountTxDirection.IN,
        amount: dto.amount,
        referenceType: 'CUSTOMER_PAYMENT',
        referenceId: payment.id,
        referenceNumber: receiptNumber,
        description: `Receipt from ${customer.name} via ${dto.paymentMethod} (${paymentNumber})`,
        userId: dto.userId,
        transactionDate: payment.paymentDate,
      });

      // 7. Post Double-Entry Journal (Debit Cash/Bank, Credit Accounts Receivable)
      const assetAccountCode = finAccount.accountType === 'CASH' ? '1010' : '1020';
      await AccountingService.postJournalEntry(tx, {
        entryType: 'RECEIPT',
        narration: `Payment received: INR ${dto.amount.toFixed(2)} from ${customer.name} (${paymentNumber})`,
        referenceType: 'CUSTOMER_PAYMENT',
        referenceId: payment.id,
        userId: dto.userId,
        entryDate: payment.paymentDate,
        lines: [
          { accountCode: assetAccountCode, debit: dto.amount, credit: 0, description: `Receipt from ${customer.name}` },
          { accountCode: '1030', debit: 0, credit: dto.amount, description: `Settlement of receivables for ${customer.name}` },
        ],
      });

      await AuditService.log(tx, {
        userId: dto.userId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        newValues: {
          paymentNumber,
          receiptNumber,
          amount: dto.amount,
          customerId: dto.customerId,
          advanceAmount,
          allocatedTo: targetAllocations.map(a => a.invoiceId),
        },
      });

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          customer: true,
          financialAccount: true,
          allocations: { include: { invoice: true } },
        },
      });
    });
  }

  /**
   * Reverse a customer payment (Audit-safe GL + Bank/Cash + Invoice balance reversal)
   */
  static async reversePayment(paymentId: string, userId: string, reason: string) {
    if (!reason || reason.trim().length < 5) {
      throw new AppError('A valid reversal reason of at least 5 characters is required.');
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          allocations: { include: { invoice: true } },
          financialAccount: true,
          customer: true,
        },
      });

      if (!payment) throw new AppError('Payment not found.', 404);
      if (payment.status === PaymentStatus.REVERSED) {
        throw new AppError('Payment has already been reversed.');
      }

      const amt = Number(payment.amount);

      // 1. Revert invoice balances
      for (const alloc of payment.allocations) {
        const inv = alloc.invoice;
        const allocAmt = Number(alloc.amount);
        const restoredPaid = Math.max(0, Math.round((Number(inv.paidAmount) - allocAmt) * 100) / 100);
        const restoredOutstanding = Math.round((Number(inv.grandTotal) - restoredPaid) * 100) / 100;
        const restoredStatus = restoredPaid <= 0 ? 'POSTED' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: new Prisma.Decimal(restoredPaid),
            outstandingAmount: new Prisma.Decimal(restoredOutstanding),
            status: restoredStatus,
          },
        });
      }

      // 2. Revert financial account balance (Direction: OUT)
      if (payment.financialAccountId) {
        await FinancialAccountService.recordTransaction(tx, {
          financialAccountId: payment.financialAccountId,
          transactionType: AccountTxType.ADJUSTMENT,
          direction: AccountTxDirection.OUT,
          amount: amt,
          referenceType: 'PAYMENT_REVERSAL',
          referenceId: payment.id,
          referenceNumber: `REV-${payment.paymentNumber}`,
          description: `Reversal of payment ${payment.paymentNumber}: ${reason}`,
          userId,
        });
      }

      // 3. Post Reverse Journal Entry (Debit 1030 Receivables, Credit Cash/Bank)
      const assetAccountCode = payment.financialAccount?.accountType === 'CASH' ? '1010' : '1020';
      await AccountingService.postJournalEntry(tx, {
        entryType: 'GENERAL',
        narration: `Reversal of payment ${payment.paymentNumber} (${payment.customer.name}): ${reason}`,
        referenceType: 'PAYMENT_REVERSAL',
        referenceId: payment.id,
        userId,
        lines: [
          { accountCode: '1030', debit: amt, credit: 0, description: `Re-instating receivables for ${payment.customer.name}` },
          { accountCode: assetAccountCode, debit: 0, credit: amt, description: `Reversal deduction from ${payment.financialAccount?.accountName || 'Cash/Bank'}` },
        ],
      });

      // 4. Mark payment as REVERSED
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          reversedById: userId,
          reversalReason: reason,
        },
      });

      await AuditService.log(tx, {
        userId,
        action: 'UPDATE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        newValues: { status: 'REVERSED', reversalReason: reason },
      });

      return updated;
    });
  }

  /**
   * Get payments with search, date range and customer filters
   */
  static async getPayments(filter?: {
    customerId?: string;
    status?: PaymentStatus;
    startDate?: Date | string;
    endDate?: Date | string;
  }) {
    const where: Prisma.PaymentWhereInput = {};
    if (filter?.customerId) where.customerId = filter.customerId;
    if (filter?.status) where.status = filter.status;
    if (filter?.startDate || filter?.endDate) {
      where.paymentDate = {};
      if (filter.startDate) where.paymentDate.gte = new Date(filter.startDate);
      if (filter.endDate) where.paymentDate.lte = new Date(filter.endDate);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, gstin: true } },
        financialAccount: { select: { id: true, accountName: true, accountType: true } },
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, outstandingAmount: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map(p => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      receiptNumber: p.receiptNumber,
      customer: p.customer,
      paymentDate: p.paymentDate,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      financialAccount: p.financialAccount,
      referenceNumber: p.referenceNumber,
      status: p.status,
      advanceAmount: Number(p.advanceAmount),
      notes: p.notes,
      recordedBy: p.createdBy?.fullName,
      allocations: p.allocations.map(a => ({
        id: a.id,
        invoiceNumber: a.invoice.invoiceNumber,
        allocatedAmount: Number(a.amount),
        invoiceGrandTotal: Number(a.invoice.grandTotal),
        invoiceOutstanding: Number(a.invoice.outstandingAmount),
      })),
      reversedAt: p.reversedAt,
      reversalReason: p.reversalReason,
    }));
  }

  /**
   * Get payment by ID
   */
  static async getPaymentById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        financialAccount: true,
        allocations: { include: { invoice: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    if (!payment) throw new AppError('Payment not found.', 404);

    return {
      ...payment,
      amount: Number(payment.amount),
      advanceAmount: Number(payment.advanceAmount),
      allocations: payment.allocations.map(a => ({
        id: a.id,
        invoiceId: a.invoiceId,
        invoiceNumber: a.invoice.invoiceNumber,
        invoiceDate: a.invoice.invoiceDate,
        grandTotal: Number(a.invoice.grandTotal),
        amount: Number(a.amount),
      })),
    };
  }
}
