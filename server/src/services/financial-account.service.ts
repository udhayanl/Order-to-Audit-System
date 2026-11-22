import { Prisma, AccountType, AccountTxDirection, AccountTxType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { AccountingService } from './accounting.service.js';

export interface CreateFinancialAccountDto {
  accountName: string;
  accountType: AccountType;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  openingBalance?: number;
  currency?: string;
}

export interface ContraTransferDto {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate?: Date | string;
  referenceNumber?: string;
  description?: string;
  userId: string;
}

export class FinancialAccountService {
  /**
   * Initialize or retrieve default financial accounts (Cash in Hand & SBI Bank)
   */
  static async ensureDefaultAccounts() {
    let cashAccount = await prisma.financialAccount.findFirst({
      where: { accountType: AccountType.CASH },
    });

    if (!cashAccount) {
      cashAccount = await prisma.financialAccount.create({
        data: {
          accountName: 'Cash on Hand',
          accountType: AccountType.CASH,
          openingBalance: new Prisma.Decimal(10000.0),
          currentBalance: new Prisma.Decimal(10000.0),
          currency: 'INR',
        },
      });
    }

    let bankAccount = await prisma.financialAccount.findFirst({
      where: { accountType: AccountType.CURRENT_ACCOUNT },
    });

    if (!bankAccount) {
      bankAccount = await prisma.financialAccount.create({
        data: {
          accountName: 'State Bank of India - Current A/c',
          accountType: AccountType.CURRENT_ACCOUNT,
          bankName: 'State Bank of India',
          accountNumber: '40192837465',
          ifscCode: 'SBIN0001234',
          branchName: 'Thuvakudi, Tiruchirappalli',
          openingBalance: new Prisma.Decimal(50000.0),
          currentBalance: new Prisma.Decimal(50000.0),
          currency: 'INR',
        },
      });
    }

    return { cashAccount, bankAccount };
  }

  /**
   * Create new financial account
   */
  static async createAccount(dto: CreateFinancialAccountDto, userId?: string) {
    const existing = await prisma.financialAccount.findUnique({
      where: { accountName: dto.accountName },
    });
    if (existing) {
      throw new AppError(`Financial account with name '${dto.accountName}' already exists.`);
    }

    const openingBalance = dto.openingBalance ? Math.max(0, Number(dto.openingBalance)) : 0.0;

    const account = await prisma.financialAccount.create({
      data: {
        accountName: dto.accountName,
        accountType: dto.accountType,
        bankName: dto.bankName || null,
        accountNumber: dto.accountNumber || null,
        ifscCode: dto.ifscCode || null,
        branchName: dto.branchName || null,
        openingBalance: new Prisma.Decimal(openingBalance),
        currentBalance: new Prisma.Decimal(openingBalance),
        currency: dto.currency || 'INR',
      },
    });

    if (userId) {
      await AuditService.log(prisma, {
        userId,
        action: 'CREATE',
        entityType: 'FINANCIAL_ACCOUNT',
        entityId: account.id,
        newValues: dto,
      });
    }

    return account;
  }

  /**
   * List all accounts with calculated transaction metrics
   */
  static async getAccounts() {
    await this.ensureDefaultAccounts();
    const accounts = await prisma.financialAccount.findMany({
      where: { active: true },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { accountType: 'asc' },
    });

    return accounts.map(a => ({
      id: a.id,
      accountName: a.accountName,
      accountType: a.accountType,
      bankName: a.bankName,
      accountNumber: a.accountNumber,
      ifscCode: a.ifscCode,
      branchName: a.branchName,
      openingBalance: Number(a.openingBalance),
      currentBalance: Number(a.currentBalance),
      currency: a.currency,
      transactionCount: a._count.transactions,
      createdAt: a.createdAt,
    }));
  }

  /**
   * Get single account details & statement
   */
  static async getAccountById(id: string) {
    const account = await prisma.financialAccount.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { transactionDate: 'desc' },
          take: 50,
          include: { user: { select: { fullName: true } } },
        },
      },
    });

    if (!account) throw new AppError('Financial account not found.', 404);

    return {
      ...account,
      openingBalance: Number(account.openingBalance),
      currentBalance: Number(account.currentBalance),
      transactions: account.transactions.map(tx => ({
        id: tx.id,
        transactionDate: tx.transactionDate,
        transactionType: tx.transactionType,
        direction: tx.direction,
        amount: Number(tx.amount),
        balanceAfter: Number(tx.balanceAfter),
        referenceType: tx.referenceType,
        referenceNumber: tx.referenceNumber,
        description: tx.description,
        performedBy: tx.user?.fullName,
      })),
    };
  }

  /**
   * Post a transaction to a financial account and adjust balance
   */
  static async recordTransaction(
    txPrisma: Prisma.TransactionClient,
    params: {
      financialAccountId: string;
      transactionType: AccountTxType;
      direction: AccountTxDirection;
      amount: number;
      referenceType: string;
      referenceId?: string;
      referenceNumber?: string;
      description?: string;
      userId?: string;
      transactionDate?: Date;
    }
  ) {
    if (params.amount <= 0) {
      throw new AppError('Transaction amount must be strictly greater than zero.');
    }

    const account = await txPrisma.financialAccount.findUnique({
      where: { id: params.financialAccountId },
    });

    if (!account) {
      throw new AppError('Financial account not found.', 404);
    }

    const currentBal = Number(account.currentBalance);
    let newBal: number;

    if (params.direction === AccountTxDirection.IN) {
      newBal = currentBal + params.amount;
    } else {
      newBal = currentBal - params.amount;
    }

    const roundedBal = Math.round(newBal * 100) / 100;

    const accountTx = await txPrisma.financialAccountTransaction.create({
      data: {
        financialAccountId: params.financialAccountId,
        transactionDate: params.transactionDate || new Date(),
        transactionType: params.transactionType,
        direction: params.direction,
        amount: new Prisma.Decimal(params.amount),
        balanceAfter: new Prisma.Decimal(roundedBal),
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
        referenceNumber: params.referenceNumber || null,
        description: params.description || null,
        userId: params.userId || null,
      },
    });

    await txPrisma.financialAccount.update({
      where: { id: params.financialAccountId },
      data: { currentBalance: new Prisma.Decimal(roundedBal) },
    });

    return accountTx;
  }

  /**
   * Inter-account Contra Transfer (Cash to Bank / Bank to Cash / Bank to Bank)
   */
  static async contraTransfer(dto: ContraTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new AppError('Source and destination accounts must be different.');
    }
    if (dto.amount <= 0) {
      throw new AppError('Transfer amount must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      const fromAcc = await tx.financialAccount.findUnique({ where: { id: dto.fromAccountId } });
      const toAcc = await tx.financialAccount.findUnique({ where: { id: dto.toAccountId } });

      if (!fromAcc) throw new AppError('Source account not found.', 404);
      if (!toAcc) throw new AppError('Destination account not found.', 404);

      if (Number(fromAcc.currentBalance) < dto.amount) {
        throw new AppError(
          `Insufficient funds in ${fromAcc.accountName}. Available: INR ${Number(fromAcc.currentBalance).toFixed(2)}, Requested: INR ${dto.amount.toFixed(2)}`
        );
      }

      const txDate = dto.transferDate ? new Date(dto.transferDate) : new Date();
      const refNo = dto.referenceNumber || `CONTRA-${Date.now()}`;

      // Deduct from source
      await this.recordTransaction(tx, {
        financialAccountId: fromAcc.id,
        transactionType: AccountTxType.TRANSFER,
        direction: AccountTxDirection.OUT,
        amount: dto.amount,
        referenceType: 'CONTRA_TRANSFER',
        referenceNumber: refNo,
        description: dto.description || `Transfer to ${toAcc.accountName}`,
        userId: dto.userId,
        transactionDate: txDate,
      });

      // Credit to destination
      await this.recordTransaction(tx, {
        financialAccountId: toAcc.id,
        transactionType: AccountTxType.TRANSFER,
        direction: AccountTxDirection.IN,
        amount: dto.amount,
        referenceType: 'CONTRA_TRANSFER',
        referenceNumber: refNo,
        description: dto.description || `Transfer from ${fromAcc.accountName}`,
        userId: dto.userId,
        transactionDate: txDate,
      });

      // Post double-entry journal
      const fromAccountCode = fromAcc.accountType === AccountType.CASH ? '1010' : '1020';
      const toAccountCode = toAcc.accountType === AccountType.CASH ? '1010' : '1020';

      await AccountingService.postJournalEntry(tx, {
        entryType: 'CONTRA',
        narration: `Contra Transfer: INR ${dto.amount.toFixed(2)} from ${fromAcc.accountName} to ${toAcc.accountName}`,
        referenceType: 'CONTRA_TRANSFER',
        referenceId: refNo,
        userId: dto.userId,
        lines: [
          { accountCode: toAccountCode, debit: dto.amount, credit: 0, description: `Transfer received from ${fromAcc.accountName}` },
          { accountCode: fromAccountCode, debit: 0, credit: dto.amount, description: `Transfer sent to ${toAcc.accountName}` },
        ],
      });

      return {
        success: true,
        transferAmount: dto.amount,
        fromAccount: fromAcc.accountName,
        toAccount: toAcc.accountName,
        referenceNumber: refNo,
      };
    });
  }

  /**
   * Cashbook Register (All cash account receipts vs payments)
   */
  static async getCashbook(startDate?: Date | string, endDate?: Date | string) {
    const cashAccount = await prisma.financialAccount.findFirst({
      where: { accountType: AccountType.CASH },
    });

    if (!cashAccount) {
      const { cashAccount: created } = await this.ensureDefaultAccounts();
      return this.generateBookReport(created.id, startDate, endDate);
    }

    return this.generateBookReport(cashAccount.id, startDate, endDate);
  }

  /**
   * Bankbook Register (All bank account deposits vs withdrawals)
   */
  static async getBankbook(startDate?: Date | string, endDate?: Date | string) {
    const bankAccount = await prisma.financialAccount.findFirst({
      where: { accountType: AccountType.CURRENT_ACCOUNT },
    });

    if (!bankAccount) {
      const { bankAccount: created } = await this.ensureDefaultAccounts();
      return this.generateBookReport(created.id, startDate, endDate);
    }

    return this.generateBookReport(bankAccount.id, startDate, endDate);
  }

  /**
   * Generate chronological book report (Cashbook / Bankbook)
   */
  private static async generateBookReport(accountId: string, startDate?: Date | string, endDate?: Date | string) {
    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new AppError('Account not found.', 404);

    const where: Prisma.FinancialAccountTransactionWhereInput = {
      financialAccountId: accountId,
    };

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = new Date(startDate);
      if (endDate) where.transactionDate.lte = new Date(endDate);
    }

    const transactions = await prisma.financialAccountTransaction.findMany({
      where,
      orderBy: { transactionDate: 'asc' },
      include: { user: { select: { fullName: true } } },
    });

    let totalReceipts = 0;
    let totalPayments = 0;

    const formattedTx = transactions.map(t => {
      const amt = Number(t.amount);
      if (t.direction === AccountTxDirection.IN) {
        totalReceipts += amt;
      } else {
        totalPayments += amt;
      }
      return {
        id: t.id,
        date: t.transactionDate,
        type: t.transactionType,
        direction: t.direction,
        receipt: t.direction === AccountTxDirection.IN ? amt : 0,
        payment: t.direction === AccountTxDirection.OUT ? amt : 0,
        balanceAfter: Number(t.balanceAfter),
        referenceType: t.referenceType,
        referenceNumber: t.referenceNumber,
        description: t.description,
        performedBy: t.user?.fullName,
      };
    });

    return {
      accountName: account.accountName,
      accountType: account.accountType,
      openingBalance: Number(account.openingBalance),
      currentBalance: Number(account.currentBalance),
      totalReceipts: Math.round(totalReceipts * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      closingBalance: Number(account.currentBalance),
      transactions: formattedTx,
    };
  }
}
