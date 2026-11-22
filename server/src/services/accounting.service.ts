import { Prisma, AccountNature } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

export interface JournalLineDto {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface PostJournalEntryDto {
  entryType?: string; // "SALES", "PURCHASE", "RECEIPT", "PAYMENT", "EXPENSE", "CONTRA", "GENERAL"
  narration: string;
  referenceType?: string;
  referenceId?: string;
  userId: string;
  entryDate?: Date | string;
  lines: JournalLineDto[];
}

export const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: '1010', name: 'Cash on Hand', nature: AccountNature.ASSET, description: 'Petty cash and cash in factory register' },
  { code: '1020', name: 'Bank Account - SBI Current', nature: AccountNature.ASSET, description: 'State Bank of India primary operating account' },
  { code: '1030', name: 'Accounts Receivable (Debtors)', nature: AccountNature.ASSET, description: 'Customer trade receivables' },
  { code: '1040', name: 'Raw Material Inventory', nature: AccountNature.ASSET, description: 'Inventory of raw food ingredients at cost' },
  { code: '1050', name: 'Finished Goods Inventory', nature: AccountNature.ASSET, description: 'Inventory of packaged food products ready for sale' },
  { code: '2010', name: 'Accounts Payable (Creditors)', nature: AccountNature.LIABILITY, description: 'Supplier trade payables' },
  { code: '2020', name: 'Output CGST Payable', nature: AccountNature.LIABILITY, description: 'Central GST collected on intra-state sales' },
  { code: '2021', name: 'Output SGST Payable', nature: AccountNature.LIABILITY, description: 'State GST collected on intra-state sales' },
  { code: '2022', name: 'Output IGST Payable', nature: AccountNature.LIABILITY, description: 'Integrated GST collected on inter-state sales' },
  { code: '2030', name: 'Input CGST Credit', nature: AccountNature.ASSET, description: 'Central GST input credit on purchases' },
  { code: '2031', name: 'Input SGST Credit', nature: AccountNature.ASSET, description: 'State GST input credit on purchases' },
  { code: '2032', name: 'Input IGST Credit', nature: AccountNature.ASSET, description: 'Integrated GST input credit on purchases' },
  { code: '3010', name: 'Owner Capital & Equity', nature: AccountNature.EQUITY, description: 'Promoter equity and retained business earnings' },
  { code: '4010', name: 'Sales Revenue', nature: AccountNature.REVENUE, description: 'Net sales revenue from food products' },
  { code: '5010', name: 'Cost of Goods Sold (COGS)', nature: AccountNature.EXPENSE, description: 'Direct materials, labour and production costs of goods sold' },
  { code: '5020', name: 'Electricity Expense', nature: AccountNature.EXPENSE, description: 'Factory power and lighting' },
  { code: '5030', name: 'Transportation & Freight', nature: AccountNature.EXPENSE, description: 'Outward and inward distribution freight' },
  { code: '5040', name: 'Factory Maintenance & Repairs', nature: AccountNature.EXPENSE, description: 'Machinery maintenance, spares and upkeep' },
  { code: '5050', name: 'Wages & Factory Labour', nature: AccountNature.EXPENSE, description: 'Direct and indirect factory floor labour' },
  { code: '5060', name: 'Packaging & Operating Supplies', nature: AccountNature.EXPENSE, description: 'Consumables, secondary packaging and office items' },
  { code: '5070', name: 'Administrative & Other Expenses', nature: AccountNature.EXPENSE, description: 'General operational and administrative overheads' },
];

export class AccountingService {
  /**
   * Seed / Ensure standard Chart of Accounts
   */
  static async ensureChartOfAccounts(tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const existing = await client.chartOfAccount.count();
    if (existing >= DEFAULT_CHART_OF_ACCOUNTS.length) return;

    for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
      await client.chartOfAccount.upsert({
        where: { code: acc.code },
        update: {},
        create: {
          code: acc.code,
          name: acc.name,
          nature: acc.nature,
          description: acc.description,
          currentDebit: new Prisma.Decimal(0.0),
          currentCredit: new Prisma.Decimal(0.0),
          currentBalance: new Prisma.Decimal(0.0),
        },
      });
    }
  }

  /**
   * Post balanced double-entry Journal Entry
   */
  static async postJournalEntry(txPrisma: Prisma.TransactionClient, dto: PostJournalEntryDto) {
    await this.ensureChartOfAccounts(txPrisma);

    if (!dto.lines || dto.lines.length < 2) {
      throw new AppError('Journal entry must contain at least two line items (debit and credit).');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of dto.lines) {
      const d = Math.round(Number(line.debit || 0) * 100) / 100;
      const c = Math.round(Number(line.credit || 0) * 100) / 100;
      if (d < 0 || c < 0) {
        throw new AppError('Journal entry line amounts cannot be negative.');
      }
      if (d === 0 && c === 0) {
        throw new AppError('Journal entry line must have either debit or credit amount.');
      }
      totalDebit += d;
      totalCredit += c;
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new AppError(
        `Journal entry is out of balance! Total Debit: INR ${totalDebit.toFixed(2)}, Total Credit: INR ${totalCredit.toFixed(2)}, Difference: INR ${Math.abs(totalDebit - totalCredit).toFixed(2)}`
      );
    }

    const count = await txPrisma.journalEntry.count();
    const entryNumber = `JV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const journal = await txPrisma.journalEntry.create({
      data: {
        entryNumber,
        entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
        entryType: dto.entryType || 'GENERAL',
        narration: dto.narration,
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId || null,
        totalDebit: new Prisma.Decimal(totalDebit),
        totalCredit: new Prisma.Decimal(totalCredit),
        isBalanced: true,
        status: 'POSTED',
        createdById: dto.userId,
        lines: {
          create: dto.lines.map(l => ({
            accountCode: l.accountCode,
            debit: new Prisma.Decimal(Math.round(Number(l.debit || 0) * 100) / 100),
            credit: new Prisma.Decimal(Math.round(Number(l.credit || 0) * 100) / 100),
            description: l.description || null,
          })),
        },
      },
      include: { lines: true },
    });

    // Update account balances
    for (const line of dto.lines) {
      const debitAmt = Number(line.debit || 0);
      const creditAmt = Number(line.credit || 0);

      const acc = await txPrisma.chartOfAccount.findUnique({
        where: { code: line.accountCode },
      });

      if (acc) {
        const newDebit = Number(acc.currentDebit) + debitAmt;
        const newCredit = Number(acc.currentCredit) + creditAmt;
        let newBal = 0;

        if (acc.nature === AccountNature.ASSET || acc.nature === AccountNature.EXPENSE) {
          newBal = newDebit - newCredit;
        } else {
          newBal = newCredit - newDebit;
        }

        await txPrisma.chartOfAccount.update({
          where: { code: line.accountCode },
          data: {
            currentDebit: new Prisma.Decimal(Math.round(newDebit * 100) / 100),
            currentCredit: new Prisma.Decimal(Math.round(newCredit * 100) / 100),
            currentBalance: new Prisma.Decimal(Math.round(newBal * 100) / 100),
          },
        });
      }
    }

    return journal;
  }

  /**
   * List all accounts with balances
   */
  static async getChartOfAccounts() {
    await this.ensureChartOfAccounts();
    const accounts = await prisma.chartOfAccount.findMany({
      orderBy: { code: 'asc' },
    });
    return accounts.map(a => ({
      code: a.code,
      name: a.name,
      nature: a.nature,
      description: a.description,
      currentDebit: Number(a.currentDebit),
      currentCredit: Number(a.currentCredit),
      currentBalance: Number(a.currentBalance),
      active: a.active,
    }));
  }

  /**
   * Create custom account in Chart of Accounts
   */
  static async createAccount(dto: { code: string; name: string; nature: AccountNature; description?: string }) {
    const existing = await prisma.chartOfAccount.findUnique({ where: { code: dto.code } });
    if (existing) throw new AppError(`Account code ${dto.code} already exists.`);

    return prisma.chartOfAccount.create({
      data: {
        code: dto.code,
        name: dto.name,
        nature: dto.nature,
        description: dto.description || null,
      },
    });
  }

  /**
   * List Journal Entries with lines
   */
  static async getJournalEntries(filter?: { entryType?: string; startDate?: Date | string; endDate?: Date | string }) {
    const where: Prisma.JournalEntryWhereInput = {};
    if (filter?.entryType) where.entryType = filter.entryType;
    if (filter?.startDate || filter?.endDate) {
      where.entryDate = {};
      if (filter.startDate) where.entryDate.gte = new Date(filter.startDate);
      if (filter.endDate) where.entryDate.lte = new Date(filter.endDate);
    }

    const journals = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { entryDate: 'desc' },
      take: 100,
    });

    return journals.map(j => ({
      id: j.id,
      entryNumber: j.entryNumber,
      entryDate: j.entryDate,
      entryType: j.entryType,
      narration: j.narration,
      referenceType: j.referenceType,
      referenceId: j.referenceId,
      totalDebit: Number(j.totalDebit),
      totalCredit: Number(j.totalCredit),
      isBalanced: j.isBalanced,
      status: j.status,
      createdByName: j.createdBy?.fullName,
      lines: j.lines.map(l => ({
        id: l.id,
        accountCode: l.accountCode,
        accountName: l.account.name,
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description,
      })),
    }));
  }

  /**
   * General Ledger query for a specific account or all accounts
   */
  static async getGeneralLedger(params: { accountCode?: string; startDate?: Date | string; endDate?: Date | string }) {
    await this.ensureChartOfAccounts();

    const where: Prisma.JournalEntryLineWhereInput = {};
    if (params.accountCode) {
      where.accountCode = params.accountCode;
    }
    if (params.startDate || params.endDate) {
      where.journalEntry = {};
      if (params.startDate) where.journalEntry.entryDate = { gte: new Date(params.startDate) };
      if (params.endDate) {
        const existingDate = typeof where.journalEntry.entryDate === 'object' ? where.journalEntry.entryDate : {};
        where.journalEntry.entryDate = {
          ...existingDate,
          lte: new Date(params.endDate),
        };
      }
    }

    const lines = await prisma.journalEntryLine.findMany({
      where,
      include: {
        account: true,
        journalEntry: {
          include: { createdBy: { select: { fullName: true } } },
        },
      },
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    let runningBalance = 0;
    const entries = lines.map(line => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const isAssetOrExpense = line.account.nature === AccountNature.ASSET || line.account.nature === AccountNature.EXPENSE;

      if (isAssetOrExpense) {
        runningBalance += (debit - credit);
      } else {
        runningBalance += (credit - debit);
      }

      return {
        id: line.id,
        entryNumber: line.journalEntry.entryNumber,
        date: line.journalEntry.entryDate,
        entryType: line.journalEntry.entryType,
        accountCode: line.accountCode,
        accountName: line.account.name,
        accountNature: line.account.nature,
        narration: line.journalEntry.narration,
        description: line.description,
        debit,
        credit,
        runningBalance: Math.round(runningBalance * 100) / 100,
        createdBy: line.journalEntry.createdBy?.fullName,
      };
    });

    return {
      accountCode: params.accountCode || 'ALL',
      totalEntries: entries.length,
      entries,
    };
  }

  /**
   * Trial Balance Report:
   * Summarizes all accounts, calculates total debits & credits, validates balance
   */
  static async getTrialBalance() {
    await this.ensureChartOfAccounts();

    // Recompute actual ledger balances dynamically from journal lines for 100% mathematical precision
    const accounts = await prisma.chartOfAccount.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });

    const lines = await prisma.journalEntryLine.findMany();

    const totalsByCode: Record<string, { debit: number; credit: number }> = {};
    for (const a of accounts) {
      totalsByCode[a.code] = { debit: 0, credit: 0 };
    }

    for (const l of lines) {
      if (totalsByCode[l.accountCode]) {
        totalsByCode[l.accountCode].debit += Number(l.debit);
        totalsByCode[l.accountCode].credit += Number(l.credit);
      }
    }

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const rows = accounts.map(a => {
      const { debit, credit } = totalsByCode[a.code] || { debit: 0, credit: 0 };
      const net = debit - credit;

      let debitBalance = 0;
      let creditBalance = 0;

      if (a.nature === AccountNature.ASSET || a.nature === AccountNature.EXPENSE) {
        if (net >= 0) {
          debitBalance = net;
        } else {
          creditBalance = Math.abs(net);
        }
      } else {
        if (net <= 0) {
          creditBalance = Math.abs(net);
        } else {
          debitBalance = net;
        }
      }

      debitBalance = Math.round(debitBalance * 100) / 100;
      creditBalance = Math.round(creditBalance * 100) / 100;

      grandTotalDebit += debitBalance;
      grandTotalCredit += creditBalance;

      return {
        code: a.code,
        name: a.name,
        nature: a.nature,
        totalDebit: Math.round(debit * 100) / 100,
        totalCredit: Math.round(credit * 100) / 100,
        debitBalance,
        creditBalance,
      };
    });

    grandTotalDebit = Math.round(grandTotalDebit * 100) / 100;
    grandTotalCredit = Math.round(grandTotalCredit * 100) / 100;
    const difference = Math.round(Math.abs(grandTotalDebit - grandTotalCredit) * 100) / 100;

    return {
      asOfDate: new Date(),
      isBalanced: difference <= 0.05,
      totalDebit: grandTotalDebit,
      totalCredit: grandTotalCredit,
      difference,
      rows,
    };
  }

  /**
   * Profit and Loss Statement (Income Statement)
   */
  static async getProfitLoss(startDate?: Date | string, endDate?: Date | string) {
    await this.ensureChartOfAccounts();

    // 1. Net Sales Revenue (from 4010 or Sales Invoices)
    const salesAccounts = await prisma.chartOfAccount.findMany({
      where: { nature: AccountNature.REVENUE },
    });

    // 2. Cost of Goods Sold (5010)
    const cogsAccount = await prisma.chartOfAccount.findUnique({
      where: { code: '5010' },
    });

    // 3. Operating Expenses (5020 - 5070)
    const expenseAccounts = await prisma.chartOfAccount.findMany({
      where: {
        nature: AccountNature.EXPENSE,
        code: { not: '5010' },
      },
    });

    // Compute dynamic figures from posted invoices and expenses if journals are not yet run
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } },
    });
    const totalTaxableRevenue = invoices.reduce((s, i) => s + Number(i.totalTaxable), 0);

    const expenses = await prisma.expense.findMany({
      where: { status: 'POSTED' },
    });
    const totalOperatingExpenses = expenses.reduce((s, e) => s + Number(e.totalAmount), 0);

    // Get COGS from production or completed batches
    const productionRuns = await prisma.productionRun.findMany({
      where: { status: 'POSTED' },
    });
    const totalProductionCost = productionRuns.reduce((s, r) => s + Number(r.totalProductionCost), 0);

    // Also get ledger-based COGS if available
    const ledgerCogs = cogsAccount ? Math.abs(Number(cogsAccount.currentBalance)) : 0;
    const effectiveCogs = ledgerCogs > 0 ? ledgerCogs : totalProductionCost;

    const grossProfit = Math.round((totalTaxableRevenue - effectiveCogs) * 100) / 100;
    const grossMarginPercent = totalTaxableRevenue > 0
      ? Math.round((grossProfit / totalTaxableRevenue) * 10000) / 100
      : 0;

    const netOperatingProfit = Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;
    const netProfitMarginPercent = totalTaxableRevenue > 0
      ? Math.round((netOperatingProfit / totalTaxableRevenue) * 10000) / 100
      : 0;

    // Breakdown of operational expenses by category
    const expenseBreakdown: Record<string, number> = {};
    for (const exp of expenses) {
      expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + Number(exp.totalAmount);
    }

    return {
      period: 'Financial Year 2026-27',
      totalRevenue: Math.round(totalTaxableRevenue * 100) / 100,
      cogs: Math.round(effectiveCogs * 100) / 100,
      grossProfit,
      grossMarginPercent,
      operatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
      netOperatingProfit,
      netProfitMarginPercent,
      expenseBreakdown,
      revenueAccounts: salesAccounts.map(a => ({ code: a.code, name: a.name, balance: Number(a.currentBalance) })),
      expenseAccounts: expenseAccounts.map(a => ({ code: a.code, name: a.name, balance: Number(a.currentBalance) })),
    };
  }

  /**
   * Balance Sheet
   */
  static async getBalanceSheet() {
    await this.ensureChartOfAccounts();

    const assets = await prisma.chartOfAccount.findMany({
      where: { nature: AccountNature.ASSET, active: true },
    });
    const liabilities = await prisma.chartOfAccount.findMany({
      where: { nature: AccountNature.LIABILITY, active: true },
    });
    const equity = await prisma.chartOfAccount.findMany({
      where: { nature: AccountNature.EQUITY, active: true },
    });

    const totalAssets = assets.reduce((s, a) => s + Number(a.currentBalance), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + Number(a.currentBalance), 0);
    const totalEquity = equity.reduce((s, a) => s + Number(a.currentBalance), 0);

    return {
      asOfDate: new Date(),
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      totalEquity: Math.round(totalEquity * 100) / 100,
      assets: assets.map(a => ({ code: a.code, name: a.name, balance: Number(a.currentBalance) })),
      liabilities: liabilities.map(a => ({ code: a.code, name: a.name, balance: Number(a.currentBalance) })),
      equity: equity.map(a => ({ code: a.code, name: a.name, balance: Number(a.currentBalance) })),
    };
  }
}
