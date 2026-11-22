import { Prisma, PaymentMethod, PaymentStatus, AccountTxDirection, AccountTxType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { FinancialAccountService } from './financial-account.service.js';
import { AccountingService } from './accounting.service.js';

export interface SupplierPurchaseAllocationDto {
  purchaseId: string;
  amount: number;
}

export interface RecordSupplierPaymentDto {
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  financialAccountId?: string;
  referenceNumber?: string;
  notes?: string;
  paymentDate?: Date | string;
  purchaseId?: string; // Single purchase allocation shortcut
  allocations?: SupplierPurchaseAllocationDto[]; // Multi-purchase allocation
  userId: string;
}

export class SupplierPaymentService {
  /**
   * Record a supplier payment with purchase allocations and general ledger entry
   */
  static async recordPayment(dto: RecordSupplierPaymentDto) {
    if (dto.amount <= 0) {
      throw new AppError('Payment amount must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Resolve supplier
      const supplier = await tx.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) throw new AppError('Supplier not found.', 404);

      // 2. Resolve financial account
      let finAccount: any = null;
      if (dto.financialAccountId) {
        finAccount = await tx.financialAccount.findUnique({
          where: { id: dto.financialAccountId },
        });
      }
      if (!finAccount) {
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
        throw new AppError('No suitable financial account found for supplier payment.');
      }

      if (Number(finAccount.currentBalance) < dto.amount) {
        throw new AppError(
          `Insufficient funds in ${finAccount.accountName}. Available: INR ${Number(finAccount.currentBalance).toFixed(2)}, Required: INR ${dto.amount.toFixed(2)}`
        );
      }

      // 3. Build purchase allocations
      const targetAllocations: SupplierPurchaseAllocationDto[] = [];
      if (dto.purchaseId) {
        targetAllocations.push({ purchaseId: dto.purchaseId, amount: dto.amount });
      } else if (dto.allocations && dto.allocations.length > 0) {
        targetAllocations.push(...dto.allocations);
      }

      let totalAllocated = 0;
      for (const a of targetAllocations) {
        totalAllocated += a.amount;
      }

      if (totalAllocated > dto.amount + 0.01) {
        throw new AppError(
          `Total allocated to purchases (INR ${totalAllocated.toFixed(2)}) exceeds payment amount (INR ${dto.amount.toFixed(2)}).`
        );
      }

      const advanceAmount = Math.max(0, dto.amount - totalAllocated);

      // 4. Generate Numbers
      const count = await tx.supplierPayment.count();
      const year = new Date().getFullYear();
      const paymentNumber = `SPMT-${year}-${String(count + 1).padStart(4, '0')}`;
      const voucherNumber = `VCHR-${year}-${String(count + 1).padStart(4, '0')}`;

      const payment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          voucherNumber,
          supplierId: dto.supplierId,
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

      // 5. Apply Allocations to Purchases
      for (const alloc of targetAllocations) {
        const pur = await tx.purchase.findUnique({
          where: { id: alloc.purchaseId },
        });

        if (!pur) throw new AppError(`Purchase invoice ${alloc.purchaseId} not found.`, 404);
        if (pur.supplierId !== dto.supplierId) {
          throw new AppError(`Purchase ${pur.purchaseNumber} does not belong to supplier ${supplier.name}.`);
        }

        const grandTotal = Number(pur.grandTotal);
        const currentPaid = Number(pur.paidAmount || 0);
        const outstanding = pur.outstandingAmount !== null
          ? Number(pur.outstandingAmount)
          : Math.max(0, grandTotal - currentPaid);

        if (alloc.amount > outstanding + 0.01) {
          throw new AppError(
            `Allocated amount (INR ${alloc.amount.toFixed(2)}) exceeds outstanding balance (INR ${outstanding.toFixed(2)}) for purchase ${pur.purchaseNumber}.`
          );
        }

        await tx.supplierPaymentAllocation.create({
          data: {
            supplierPaymentId: payment.id,
            purchaseId: pur.id,
            amount: new Prisma.Decimal(alloc.amount),
          },
        });

        const newPaid = Math.round((currentPaid + alloc.amount) * 100) / 100;
        const newOutstanding = Math.max(0, Math.round((grandTotal - newPaid) * 100) / 100);
        const newStatus = newOutstanding <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.purchase.update({
          where: { id: pur.id },
          data: {
            paidAmount: new Prisma.Decimal(newPaid),
            outstandingAmount: new Prisma.Decimal(newOutstanding),
            paymentStatus: newStatus,
          },
        });
      }

      // 6. Record Financial Account Ledger Entry (OUT)
      await FinancialAccountService.recordTransaction(tx, {
        financialAccountId: finAccount.id,
        transactionType: AccountTxType.PAYMENT,
        direction: AccountTxDirection.OUT,
        amount: dto.amount,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: payment.id,
        referenceNumber: voucherNumber,
        description: `Disbursement to ${supplier.name} via ${dto.paymentMethod} (${paymentNumber})`,
        userId: dto.userId,
        transactionDate: payment.paymentDate,
      });

      // 7. Post Double-Entry Journal (Debit 2010 Accounts Payable, Credit Cash/Bank)
      const assetAccountCode = finAccount.accountType === 'CASH' ? '1010' : '1020';
      await AccountingService.postJournalEntry(tx, {
        entryType: 'PAYMENT',
        narration: `Payment made: INR ${dto.amount.toFixed(2)} to ${supplier.name} (${paymentNumber})`,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: payment.id,
        userId: dto.userId,
        entryDate: payment.paymentDate,
        lines: [
          { accountCode: '2010', debit: dto.amount, credit: 0, description: `Settlement of payables to ${supplier.name}` },
          { accountCode: assetAccountCode, debit: 0, credit: dto.amount, description: `Disbursement from ${finAccount.accountName}` },
        ],
      });

      await AuditService.log(tx, {
        userId: dto.userId,
        action: 'CREATE',
        entityType: 'SUPPLIER_PAYMENT',
        entityId: payment.id,
        newValues: {
          paymentNumber,
          voucherNumber,
          amount: dto.amount,
          supplierId: dto.supplierId,
          advanceAmount,
          allocatedTo: targetAllocations.map(a => a.purchaseId),
        },
      });

      return tx.supplierPayment.findUnique({
        where: { id: payment.id },
        include: {
          supplier: true,
          financialAccount: true,
          allocations: { include: { purchase: true } },
        },
      });
    });
  }

  /**
   * Reverse supplier payment
   */
  static async reversePayment(paymentId: string, userId: string, reason: string) {
    if (!reason || reason.trim().length < 5) {
      throw new AppError('A valid reversal reason of at least 5 characters is required.');
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.findUnique({
        where: { id: paymentId },
        include: {
          allocations: { include: { purchase: true } },
          financialAccount: true,
          supplier: true,
        },
      });

      if (!payment) throw new AppError('Supplier payment not found.', 404);
      if (payment.status === PaymentStatus.REVERSED) {
        throw new AppError('Supplier payment has already been reversed.');
      }

      const amt = Number(payment.amount);

      // 1. Revert purchase balances
      for (const alloc of payment.allocations) {
        const pur = alloc.purchase;
        const allocAmt = Number(alloc.amount);
        const restoredPaid = Math.max(0, Math.round((Number(pur.paidAmount || 0) - allocAmt) * 100) / 100);
        const restoredOutstanding = Math.round((Number(pur.grandTotal) - restoredPaid) * 100) / 100;
        const restoredStatus = restoredPaid <= 0 ? 'UNPAID' : 'PARTIALLY_PAID';

        await tx.purchase.update({
          where: { id: pur.id },
          data: {
            paidAmount: new Prisma.Decimal(restoredPaid),
            outstandingAmount: new Prisma.Decimal(restoredOutstanding),
            paymentStatus: restoredStatus,
          },
        });
      }

      // 2. Revert financial account balance (Direction: IN)
      if (payment.financialAccountId) {
        await FinancialAccountService.recordTransaction(tx, {
          financialAccountId: payment.financialAccountId,
          transactionType: AccountTxType.ADJUSTMENT,
          direction: AccountTxDirection.IN,
          amount: amt,
          referenceType: 'SUPPLIER_PAYMENT_REVERSAL',
          referenceId: payment.id,
          referenceNumber: `REV-${payment.paymentNumber}`,
          description: `Reversal of supplier payment ${payment.paymentNumber}: ${reason}`,
          userId,
        });
      }

      // 3. Post Reverse Journal (Debit Cash/Bank, Credit 2010 Accounts Payable)
      const assetAccountCode = payment.financialAccount?.accountType === 'CASH' ? '1010' : '1020';
      await AccountingService.postJournalEntry(tx, {
        entryType: 'GENERAL',
        narration: `Reversal of supplier payment ${payment.paymentNumber} (${payment.supplier.name}): ${reason}`,
        referenceType: 'SUPPLIER_PAYMENT_REVERSAL',
        referenceId: payment.id,
        userId,
        lines: [
          { accountCode: assetAccountCode, debit: amt, credit: 0, description: `Restoration of funds to ${payment.financialAccount?.accountName || 'Bank'}` },
          { accountCode: '2010', debit: 0, credit: amt, description: `Re-instating payables for ${payment.supplier.name}` },
        ],
      });

      const updated = await tx.supplierPayment.update({
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
        entityType: 'SUPPLIER_PAYMENT',
        entityId: payment.id,
        newValues: { status: 'REVERSED', reversalReason: reason },
      });

      return updated;
    });
  }

  /**
   * List supplier payments
   */
  static async getPayments(filter?: {
    supplierId?: string;
    status?: PaymentStatus;
    startDate?: Date | string;
    endDate?: Date | string;
  }) {
    const where: Prisma.SupplierPaymentWhereInput = {};
    if (filter?.supplierId) where.supplierId = filter.supplierId;
    if (filter?.status) where.status = filter.status;
    if (filter?.startDate || filter?.endDate) {
      where.paymentDate = {};
      if (filter.startDate) where.paymentDate.gte = new Date(filter.startDate);
      if (filter.endDate) where.paymentDate.lte = new Date(filter.endDate);
    }

    const payments = await prisma.supplierPayment.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, gstin: true } },
        financialAccount: { select: { id: true, accountName: true, accountType: true } },
        allocations: {
          include: {
            purchase: { select: { id: true, purchaseNumber: true, grandTotal: true, paidAmount: true, outstandingAmount: true } },
          },
        },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map(p => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      voucherNumber: p.voucherNumber,
      supplier: p.supplier,
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
        purchaseNumber: a.purchase.purchaseNumber,
        allocatedAmount: Number(a.amount),
        purchaseGrandTotal: Number(a.purchase.grandTotal),
        purchaseOutstanding: Number(a.purchase.outstandingAmount || 0),
      })),
      reversedAt: p.reversedAt,
      reversalReason: p.reversalReason,
    }));
  }

  /**
   * Get single supplier payment
   */
  static async getPaymentById(id: string) {
    const payment = await prisma.supplierPayment.findUnique({
      where: { id },
      include: {
        supplier: true,
        financialAccount: true,
        allocations: { include: { purchase: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    if (!payment) throw new AppError('Supplier payment not found.', 404);

    return {
      ...payment,
      amount: Number(payment.amount),
      advanceAmount: Number(payment.advanceAmount),
      allocations: payment.allocations.map(a => ({
        id: a.id,
        purchaseId: a.purchaseId,
        purchaseNumber: a.purchase.purchaseNumber,
        purchaseDate: a.purchase.purchaseDate,
        grandTotal: Number(a.purchase.grandTotal),
        amount: Number(a.amount),
      })),
    };
  }
}
