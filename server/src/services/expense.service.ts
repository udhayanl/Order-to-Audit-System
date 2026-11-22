import { Prisma, ExpenseCategory, ExpenseStatus, PaymentMethod, AccountTxDirection, AccountTxType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { FinancialAccountService } from './financial-account.service.js';
import { AccountingService } from './accounting.service.js';

export interface RecordExpenseDto {
  category: ExpenseCategory;
  description: string;
  amount: number;
  taxAmount?: number;
  vendor?: string;
  paymentMethod?: PaymentMethod;
  financialAccountId?: string;
  referenceNumber?: string;
  receiptUrl?: string;
  expenseDate?: Date | string;
  autoApprove?: boolean;
  userId: string;
}

// Map expense categories to standard GL Chart of Account codes
const EXPENSE_ACCOUNT_MAP: Record<ExpenseCategory, string> = {
  [ExpenseCategory.ELECTRICITY]: '5020',
  [ExpenseCategory.TRANSPORTATION]: '5030',
  [ExpenseCategory.FUEL]: '5030',
  [ExpenseCategory.MAINTENANCE]: '5040',
  [ExpenseCategory.REPAIRS]: '5040',
  [ExpenseCategory.MACHINERY]: '5040',
  [ExpenseCategory.LABOUR]: '5050',
  [ExpenseCategory.PACKAGING]: '5060',
  [ExpenseCategory.WATER]: '5070',
  [ExpenseCategory.RENT]: '5070',
  [ExpenseCategory.OFFICE_SUPPLIES]: '5060',
  [ExpenseCategory.INTERNET_PHONE]: '5070',
  [ExpenseCategory.ADMINISTRATIVE]: '5070',
  [ExpenseCategory.MARKETING]: '5070',
  [ExpenseCategory.OTHER]: '5070',
};

export class ExpenseService {
  /**
   * Record operational expense
   */
  static async recordExpense(dto: RecordExpenseDto) {
    if (dto.amount <= 0) {
      throw new AppError('Expense amount must be strictly greater than zero.');
    }

    const taxAmount = dto.taxAmount ? Math.max(0, Number(dto.taxAmount)) : 0.0;
    const totalAmount = Math.round((Number(dto.amount) + taxAmount) * 100) / 100;

    return prisma.$transaction(async (tx) => {
      // 1. Resolve financial account
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
        throw new AppError('No suitable financial account found for expense payment.');
      }

      // Check sufficient funds if posting immediately
      const shouldPost = dto.autoApprove !== false;
      if (shouldPost && Number(finAccount.currentBalance) < totalAmount) {
        throw new AppError(
          `Insufficient funds in ${finAccount.accountName}. Available: INR ${Number(finAccount.currentBalance).toFixed(2)}, Required: INR ${totalAmount.toFixed(2)}`
        );
      }

      const count = await tx.expense.count();
      const expenseNumber = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const status = shouldPost ? ExpenseStatus.POSTED : ExpenseStatus.SUBMITTED;

      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
          category: dto.category,
          description: dto.description,
          amount: new Prisma.Decimal(dto.amount),
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          vendor: dto.vendor || null,
          paymentMethod: dto.paymentMethod || (finAccount.accountType === 'CASH' ? PaymentMethod.CASH : PaymentMethod.BANK_TRANSFER),
          financialAccountId: finAccount.id,
          referenceNumber: dto.referenceNumber || null,
          receiptUrl: dto.receiptUrl || null,
          status,
          recordedById: dto.userId,
          approvedById: shouldPost ? dto.userId : null,
          approvedAt: shouldPost ? new Date() : null,
        },
      });

      if (shouldPost) {
        // Record financial account transaction (OUT)
        await FinancialAccountService.recordTransaction(tx, {
          financialAccountId: finAccount.id,
          transactionType: AccountTxType.EXPENSE,
          direction: AccountTxDirection.OUT,
          amount: totalAmount,
          referenceType: 'EXPENSE',
          referenceId: expense.id,
          referenceNumber: expense.expenseNumber,
          description: `Operational Expense (${dto.category}): ${dto.description}`,
          userId: dto.userId,
          transactionDate: expense.expenseDate,
        });

        // Post balanced journal entry (Debit Expense, Credit Cash/Bank)
        const expenseAccCode = EXPENSE_ACCOUNT_MAP[dto.category] || '5070';
        const assetAccCode = finAccount.accountType === 'CASH' ? '1010' : '1020';

        await AccountingService.postJournalEntry(tx, {
          entryType: 'EXPENSE',
          narration: `Expense [${dto.category}]: ${dto.description} (${expense.expenseNumber})`,
          referenceType: 'EXPENSE',
          referenceId: expense.id,
          userId: dto.userId,
          entryDate: expense.expenseDate,
          lines: [
            { accountCode: expenseAccCode, debit: totalAmount, credit: 0, description: dto.description },
            { accountCode: assetAccCode, debit: 0, credit: totalAmount, description: `Paid from ${finAccount.accountName}` },
          ],
        });
      }

      await AuditService.log(tx, {
        userId: dto.userId,
        action: 'CREATE',
        entityType: 'EXPENSE',
        entityId: expense.id,
        newValues: {
          expenseNumber,
          category: dto.category,
          amount: dto.amount,
          totalAmount,
          status,
        },
      });

      return tx.expense.findUnique({
        where: { id: expense.id },
        include: {
          financialAccount: true,
          recordedBy: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } },
        },
      });
    });
  }

  /**
   * Approve and post an existing pending expense
   */
  static async approveExpense(expenseId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({
        where: { id: expenseId },
        include: { financialAccount: true },
      });

      if (!expense) throw new AppError('Expense not found.', 404);
      if (expense.status === ExpenseStatus.POSTED) {
        throw new AppError('Expense is already approved and posted.');
      }
      if (expense.status === ExpenseStatus.REJECTED) {
        throw new AppError('Cannot approve a rejected expense.');
      }

      const totalAmount = Number(expense.totalAmount);
      let finAccount = expense.financialAccount;

      if (!finAccount) {
        finAccount = await tx.financialAccount.findFirst({
          where: { accountType: expense.paymentMethod === PaymentMethod.CASH ? 'CASH' : 'CURRENT_ACCOUNT' },
        });
      }

      if (!finAccount) throw new AppError('No financial account assigned to this expense.');

      if (Number(finAccount.currentBalance) < totalAmount) {
        throw new AppError(
          `Insufficient funds in ${finAccount.accountName}. Available: INR ${Number(finAccount.currentBalance).toFixed(2)}, Required: INR ${totalAmount.toFixed(2)}`
        );
      }

      // Record transaction
      await FinancialAccountService.recordTransaction(tx, {
        financialAccountId: finAccount.id,
        transactionType: AccountTxType.EXPENSE,
        direction: AccountTxDirection.OUT,
        amount: totalAmount,
        referenceType: 'EXPENSE',
        referenceId: expense.id,
        referenceNumber: expense.expenseNumber,
        description: `Operational Expense (${expense.category}): ${expense.description}`,
        userId,
        transactionDate: new Date(),
      });

      // Post GL
      const expenseAccCode = EXPENSE_ACCOUNT_MAP[expense.category] || '5070';
      const assetAccCode = finAccount.accountType === 'CASH' ? '1010' : '1020';

      await AccountingService.postJournalEntry(tx, {
        entryType: 'EXPENSE',
        narration: `Expense [${expense.category}]: ${expense.description} (${expense.expenseNumber})`,
        referenceType: 'EXPENSE',
        referenceId: expense.id,
        userId,
        lines: [
          { accountCode: expenseAccCode, debit: totalAmount, credit: 0, description: expense.description },
          { accountCode: assetAccCode, debit: 0, credit: totalAmount, description: `Paid from ${finAccount.accountName}` },
        ],
      });

      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: ExpenseStatus.POSTED,
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      await AuditService.log(tx, {
        userId,
        action: 'APPROVE',
        entityType: 'EXPENSE',
        entityId: expense.id,
        newValues: { status: 'POSTED' },
      });

      return updated;
    });
  }

  /**
   * Reject an expense
   */
  static async rejectExpense(expenseId: string, userId: string, reason?: string) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new AppError('Expense not found.', 404);
    if (expense.status === ExpenseStatus.POSTED) {
      throw new AppError('Cannot reject an already posted expense.');
    }

    return prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: ExpenseStatus.REJECTED,
        rejectionReason: reason || 'Rejected by approver',
      },
    });
  }

  /**
   * List expenses with filters
   */
  static async getExpenses(filter?: {
    category?: ExpenseCategory;
    status?: ExpenseStatus;
    financialAccountId?: string;
    startDate?: Date | string;
    endDate?: Date | string;
  }) {
    const where: Prisma.ExpenseWhereInput = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.status) where.status = filter.status;
    if (filter?.financialAccountId) where.financialAccountId = filter.financialAccountId;
    if (filter?.startDate || filter?.endDate) {
      where.expenseDate = {};
      if (filter.startDate) where.expenseDate.gte = new Date(filter.startDate);
      if (filter.endDate) where.expenseDate.lte = new Date(filter.endDate);
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        financialAccount: { select: { id: true, accountName: true, accountType: true } },
        recordedBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });

    return expenses.map(e => ({
      id: e.id,
      expenseNumber: e.expenseNumber,
      expenseDate: e.expenseDate,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      taxAmount: Number(e.taxAmount),
      totalAmount: Number(e.totalAmount),
      vendor: e.vendor,
      paymentMethod: e.paymentMethod,
      financialAccount: e.financialAccount,
      referenceNumber: e.referenceNumber,
      status: e.status,
      recordedBy: e.recordedBy?.fullName,
      approvedBy: e.approvedBy?.fullName,
      approvedAt: e.approvedAt,
    }));
  }

  /**
   * Get category-wise summary of expenses
   */
  static async getExpenseSummary() {
    const expenses = await prisma.expense.findMany({
      where: { status: ExpenseStatus.POSTED },
    });

    const categoryTotals: Record<string, number> = {};
    let totalAllExpenses = 0;

    for (const e of expenses) {
      const amt = Number(e.totalAmount);
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + amt;
      totalAllExpenses += amt;
    }

    const breakdown = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
      percentage: totalAllExpenses > 0 ? Math.round((total / totalAllExpenses) * 10000) / 100 : 0,
    })).sort((a, b) => b.total - a.total);

    return {
      totalAllExpenses: Math.round(totalAllExpenses * 100) / 100,
      totalExpenseCount: expenses.length,
      breakdown,
    };
  }
}
