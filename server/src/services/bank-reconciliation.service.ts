import { Prisma, ReconciliationStatus } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface BankStatementLineImportDto {
  transactionDate: Date | string;
  valueDate?: Date | string;
  description: string;
  referenceNumber?: string;
  withdrawal?: number;
  deposit?: number;
  balanceAfter?: number;
}

export interface ImportBankStatementDto {
  financialAccountId: string;
  statementNumber?: string;
  startDate: Date | string;
  endDate: Date | string;
  openingBalance: number;
  closingBalance: number;
  lines: BankStatementLineImportDto[];
  userId: string;
}

export class BankReconciliationService {
  /**
   * Import bank statement and lines
   */
  static async importStatement(dto: ImportBankStatementDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new AppError('Bank statement must contain at least one transaction line.');
    }

    const account = await prisma.financialAccount.findUnique({
      where: { id: dto.financialAccountId },
    });
    if (!account) throw new AppError('Financial account not found.', 404);

    const count = await prisma.bankStatement.count();
    const statementNumber = dto.statementNumber || `STMT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const statement = await prisma.bankStatement.create({
      data: {
        statementNumber,
        financialAccountId: dto.financialAccountId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        openingBalance: new Prisma.Decimal(dto.openingBalance),
        closingBalance: new Prisma.Decimal(dto.closingBalance),
        status: 'IMPORTED',
        importedById: dto.userId,
        lines: {
          create: dto.lines.map(l => ({
            transactionDate: new Date(l.transactionDate),
            valueDate: l.valueDate ? new Date(l.valueDate) : null,
            description: l.description,
            referenceNumber: l.referenceNumber || null,
            withdrawal: new Prisma.Decimal(l.withdrawal ? Math.max(0, Number(l.withdrawal)) : 0.0),
            deposit: new Prisma.Decimal(l.deposit ? Math.max(0, Number(l.deposit)) : 0.0),
            balanceAfter: l.balanceAfter !== undefined ? new Prisma.Decimal(Number(l.balanceAfter)) : null,
            status: ReconciliationStatus.UNRECONCILED,
          })),
        },
      },
      include: { lines: true },
    });

    await AuditService.log(prisma, {
      userId: dto.userId,
      action: 'CREATE',
      entityType: 'BANK_STATEMENT',
      entityId: statement.id,
      newValues: { statementNumber, lineCount: dto.lines.length },
    });

    return statement;
  }

  /**
   * Automated rule engine matching statement lines against book transactions
   */
  static async autoMatch(statementId: string, userId: string) {
    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: {
        lines: { where: { status: ReconciliationStatus.UNRECONCILED } },
        financialAccount: true,
      },
    });

    if (!statement) throw new AppError('Bank statement not found.', 404);

    // Fetch candidate book transactions
    const bookTransactions = await prisma.financialAccountTransaction.findMany({
      where: {
        financialAccountId: statement.financialAccountId,
        transactionDate: {
          gte: new Date(new Date(statement.startDate).getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(new Date(statement.endDate).getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    let matchedCount = 0;
    const usedTxIds = new Set<string>();

    for (const line of statement.lines) {
      const isDeposit = Number(line.deposit) > 0;
      const amount = isDeposit ? Number(line.deposit) : Number(line.withdrawal);
      const expectedDir = isDeposit ? 'IN' : 'OUT';

      // Find best candidate
      const candidate = bookTransactions.find(bt => {
        if (usedTxIds.has(bt.id)) return false;
        if (bt.direction !== expectedDir) return false;
        if (Math.abs(Number(bt.amount) - amount) > 0.01) return false;

        // Check reference number match or date proximity
        const refMatch = line.referenceNumber && bt.referenceNumber &&
          (line.referenceNumber.includes(bt.referenceNumber) || bt.referenceNumber.includes(line.referenceNumber));
        const dateDiff = Math.abs(new Date(line.transactionDate).getTime() - new Date(bt.transactionDate).getTime());
        const daysDiff = dateDiff / (1000 * 60 * 60 * 24);

        return refMatch || daysDiff <= 5;
      });

      if (candidate) {
        usedTxIds.add(candidate.id);
        await prisma.bankStatementTransaction.update({
          where: { id: line.id },
          data: {
            status: ReconciliationStatus.AUTO_MATCHED,
            matchedTxId: candidate.id,
          },
        });
        matchedCount++;
      }
    }

    return {
      statementId,
      totalLines: statement.lines.length,
      matchedCount,
      unmatchedCount: statement.lines.length - matchedCount,
    };
  }

  /**
   * Manually match a statement line to a specific book transaction
   */
  static async manualMatch(lineId: string, financialAccountTxId: string) {
    const line = await prisma.bankStatementTransaction.findUnique({ where: { id: lineId } });
    if (!line) throw new AppError('Statement line not found.', 404);

    const tx = await prisma.financialAccountTransaction.findUnique({ where: { id: financialAccountTxId } });
    if (!tx) throw new AppError('Book transaction not found.', 404);

    return prisma.bankStatementTransaction.update({
      where: { id: lineId },
      data: {
        status: ReconciliationStatus.MANUALLY_MATCHED,
        matchedTxId: financialAccountTxId,
      },
    });
  }

  /**
   * Finalize Bank Reconciliation
   */
  static async finalizeReconciliation(statementId: string, userId: string, notes?: string) {
    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: {
        lines: true,
        financialAccount: true,
      },
    });

    if (!statement) throw new AppError('Bank statement not found.', 404);

    const statementBalance = Number(statement.closingBalance);
    const bookBalance = Number(statement.financialAccount.currentBalance);
    const diff = Math.round(Math.abs(statementBalance - bookBalance) * 100) / 100;

    const count = await prisma.bankReconciliation.count();
    const reconciliationNumber = `BRC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const reconciliation = await prisma.bankReconciliation.create({
      data: {
        reconciliationNumber,
        bankStatementId: statement.id,
        financialAccountId: statement.financialAccountId,
        reconciliationDate: new Date(),
        statementBalance: new Prisma.Decimal(statementBalance),
        bookBalance: new Prisma.Decimal(bookBalance),
        unreconciledDifference: new Prisma.Decimal(diff),
        status: diff <= 1.0 ? 'COMPLETED' : 'DISCREPANCY_NOTED',
        notes: notes || `Reconciliation of statement ${statement.statementNumber}`,
        reconciledById: userId,
      },
    });

    await prisma.bankStatement.update({
      where: { id: statementId },
      data: { status: 'RECONCILED' },
    });

    return reconciliation;
  }

  /**
   * Get all statements with status
   */
  static async getStatements(financialAccountId?: string) {
    const where: Prisma.BankStatementWhereInput = {};
    if (financialAccountId) where.financialAccountId = financialAccountId;

    const statements = await prisma.bankStatement.findMany({
      where,
      include: {
        financialAccount: { select: { accountName: true, accountNumber: true } },
        lines: true,
        importedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return statements.map(s => {
      const matched = s.lines.filter(l => l.status === ReconciliationStatus.AUTO_MATCHED || l.status === ReconciliationStatus.MANUALLY_MATCHED).length;
      return {
        id: s.id,
        statementNumber: s.statementNumber,
        accountName: s.financialAccount.accountName,
        accountNumber: s.financialAccount.accountNumber,
        startDate: s.startDate,
        endDate: s.endDate,
        openingBalance: Number(s.openingBalance),
        closingBalance: Number(s.closingBalance),
        status: s.status,
        totalLines: s.lines.length,
        matchedLines: matched,
        unmatchedLines: s.lines.length - matched,
        importedBy: s.importedBy?.fullName,
        createdAt: s.createdAt,
      };
    });
  }

  /**
   * Get statement details with lines and matching status
   */
  static async getStatementById(id: string) {
    const statement = await prisma.bankStatement.findUnique({
      where: { id },
      include: {
        financialAccount: true,
        lines: {
          include: { matchedTx: true },
          orderBy: { transactionDate: 'asc' },
        },
        reconciliations: true,
        importedBy: { select: { fullName: true } },
      },
    });

    if (!statement) throw new AppError('Bank statement not found.', 404);

    return {
      ...statement,
      openingBalance: Number(statement.openingBalance),
      closingBalance: Number(statement.closingBalance),
      lines: statement.lines.map(l => ({
        id: l.id,
        transactionDate: l.transactionDate,
        description: l.description,
        referenceNumber: l.referenceNumber,
        withdrawal: Number(l.withdrawal),
        deposit: Number(l.deposit),
        balanceAfter: l.balanceAfter !== null ? Number(l.balanceAfter) : null,
        status: l.status,
        matchedTx: l.matchedTx ? {
          id: l.matchedTx.id,
          date: l.matchedTx.transactionDate,
          amount: Number(l.matchedTx.amount),
          referenceNumber: l.matchedTx.referenceNumber,
          description: l.matchedTx.description,
        } : null,
      })),
    };
  }

  /**
   * Get reconciliation history
   */
  static async getReconciliationReports() {
    const reconciliations = await prisma.bankReconciliation.findMany({
      include: {
        bankStatement: true,
        reconciledBy: { select: { fullName: true } },
      },
      orderBy: { reconciliationDate: 'desc' },
    });

    return reconciliations.map(r => ({
      id: r.id,
      reconciliationNumber: r.reconciliationNumber,
      statementNumber: r.bankStatement.statementNumber,
      reconciliationDate: r.reconciliationDate,
      statementBalance: Number(r.statementBalance),
      bookBalance: Number(r.bookBalance),
      difference: Number(r.unreconciledDifference),
      status: r.status,
      notes: r.notes,
      reconciledBy: r.reconciledBy?.fullName,
    }));
  }
}
