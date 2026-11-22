import prisma from '../db/client.js';
import { FinancialAccountService } from './financial-account.service.js';
import { ReceivablesPayablesService } from './receivables-payables.service.js';

export class FinancialDashboardService {
  /**
   * Executive Financial Dashboard Overview
   */
  static async getDashboardMetrics() {
    await FinancialAccountService.ensureDefaultAccounts();

    // 1. Balances from Financial Accounts
    const cashAccount = await prisma.financialAccount.findFirst({
      where: { accountType: 'CASH', active: true },
    });
    const bankAccount = await prisma.financialAccount.findFirst({
      where: { accountType: 'CURRENT_ACCOUNT', active: true },
    });

    const cashBalance = cashAccount ? Number(cashAccount.currentBalance) : 0;
    const bankBalance = bankAccount ? Number(bankAccount.currentBalance) : 0;
    const totalLiquidFunds = Math.round((cashBalance + bankBalance) * 100) / 100;

    // 2. Accounts Receivable & Accounts Payable
    const arSummary = await ReceivablesPayablesService.getReceivablesSummary();
    const apSummary = await ReceivablesPayablesService.getPayablesSummary();

    // 3. Today's collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPayments = await prisma.payment.aggregate({
      where: {
        paymentDate: { gte: today },
        status: 'POSTED',
      },
      _sum: { amount: true },
    });
    const todaysCollections = Number(todayPayments._sum.amount || 0);

    // 4. Monthly Invoicing & Monthly Expenses
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthlyInvoices = await prisma.invoice.aggregate({
      where: {
        invoiceDate: { gte: startOfMonth },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalTaxable: true, grandTotal: true },
    });
    const monthlyRevenue = Number(monthlyInvoices._sum.totalTaxable || 0);

    const monthlyExpensesAggr = await prisma.expense.aggregate({
      where: {
        expenseDate: { gte: startOfMonth },
        status: 'POSTED',
      },
      _sum: { totalAmount: true },
    });
    const monthlyExpenses = Number(monthlyExpensesAggr._sum.totalAmount || 0);

    // 5. Recent Financial Activities
    const recentTransactions = await prisma.financialAccountTransaction.findMany({
      include: {
        financialAccount: { select: { accountName: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 10,
    });

    // 6. Generate Financial Alerts
    const alerts: any[] = [];

    if (arSummary.totalOverdue > 0) {
      alerts.push({
        id: 'alert-ar-overdue',
        severity: 'HIGH',
        title: 'Overdue Customer Receivables',
        message: `INR ${arSummary.totalOverdue.toFixed(2)} in customer invoices are overdue for collection.`,
      });
    }

    if (cashBalance < 5000) {
      alerts.push({
        id: 'alert-low-cash',
        severity: 'MEDIUM',
        title: 'Low Cash Register Balance',
        message: `Cash on hand (INR ${cashBalance.toFixed(2)}) is below the recommended INR 5,000 threshold.`,
      });
    }

    if (bankBalance < 25000) {
      alerts.push({
        id: 'alert-low-bank',
        severity: 'HIGH',
        title: 'Low Operating Bank Balance',
        message: `Bank balance (INR ${bankBalance.toFixed(2)}) is below INR 25,000 operating reserve.`,
      });
    }

    // 7. Cashflow Series (Last 7 days)
    const cashflowSeries = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      const dayIn = await prisma.financialAccountTransaction.aggregate({
        where: {
          transactionDate: { gte: dayStart, lte: dayEnd },
          direction: 'IN',
        },
        _sum: { amount: true },
      });

      const dayOut = await prisma.financialAccountTransaction.aggregate({
        where: {
          transactionDate: { gte: dayStart, lte: dayEnd },
          direction: 'OUT',
        },
        _sum: { amount: true },
      });

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      cashflowSeries.push({
        day: dayNames[dayStart.getDay()],
        date: dayStart.toISOString().split('T')[0],
        inflow: Number(dayIn._sum.amount || 0),
        outflow: Number(dayOut._sum.amount || 0),
      });
    }

    return {
      kpis: {
        cashBalance: Math.round(cashBalance * 100) / 100,
        bankBalance: Math.round(bankBalance * 100) / 100,
        totalLiquidFunds,
        totalReceivables: arSummary.totalOutstanding,
        overdueReceivables: arSummary.totalOverdue,
        totalPayables: apSummary.totalOutstanding,
        todaysCollections: Math.round(todaysCollections * 100) / 100,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
      },
      cashflowSeries,
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        date: t.transactionDate,
        accountName: t.financialAccount.accountName,
        type: t.transactionType,
        direction: t.direction,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        description: t.description,
        performedBy: t.user?.fullName,
      })),
      alerts,
    };
  }
}
