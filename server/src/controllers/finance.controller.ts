import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../db/client.js';
import { FinancialAccountService } from '../services/financial-account.service.js';
import { CustomerPaymentService } from '../services/customer-payment.service.js';
import { SupplierPaymentService } from '../services/supplier-payment.service.js';
import { ExpenseService } from '../services/expense.service.js';
import { AccountingService } from '../services/accounting.service.js';
import { BankReconciliationService } from '../services/bank-reconciliation.service.js';
import { ReceivablesPayablesService } from '../services/receivables-payables.service.js';
import { ProfitabilityService } from '../services/profitability.service.js';
import { FinancialDashboardService } from '../services/financial-dashboard.service.js';

export class FinanceController {
  // ================= FINANCIAL ACCOUNTS =================
  static async createAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const account = await FinancialAccountService.createAccount(req.body, req.user?.id);
      res.status(201).json({ success: true, data: account });
    } catch (err) { next(err); }
  }

  static async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const accounts = await FinancialAccountService.getAccounts();
      res.json({ success: true, data: accounts });
    } catch (err) { next(err); }
  }

  static async getAccountById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const account = await FinancialAccountService.getAccountById(req.params.id);
      res.json({ success: true, data: account });
    } catch (err) { next(err); }
  }

  static async contraTransfer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await FinancialAccountService.contraTransfer({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async getCashbook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const cashbook = await FinancialAccountService.getCashbook(startDate as string, endDate as string);
      res.json({ success: true, data: cashbook });
    } catch (err) { next(err); }
  }

  static async getBankbook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const bankbook = await FinancialAccountService.getBankbook(startDate as string, endDate as string);
      res.json({ success: true, data: bankbook });
    } catch (err) { next(err); }
  }

  // ================= CUSTOMER PAYMENTS =================
  static async recordCustomerPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await CustomerPaymentService.recordPayment({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: payment });
    } catch (err) { next(err); }
  }

  static async getCustomerPayments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerId, status, startDate, endDate } = req.query;
      const payments = await CustomerPaymentService.getPayments({
        customerId: customerId as string,
        status: status as any,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data: payments });
    } catch (err) { next(err); }
  }

  static async getCustomerPaymentById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await CustomerPaymentService.getPaymentById(req.params.id);
      res.json({ success: true, data: payment });
    } catch (err) { next(err); }
  }

  static async reverseCustomerPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await CustomerPaymentService.reversePayment(
        req.params.id,
        req.user!.id,
        req.body.reason
      );
      res.json({ success: true, data: payment, message: 'Payment successfully reversed.' });
    } catch (err) { next(err); }
  }

  static async getCustomerPaymentReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await CustomerPaymentService.getPaymentById(req.params.id);
      res.json({
        success: true,
        data: {
          receiptNumber: payment.receiptNumber,
          paymentNumber: payment.paymentNumber,
          date: payment.paymentDate,
          customer: payment.customer,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          referenceNumber: payment.referenceNumber,
          allocations: payment.allocations,
          advanceAmount: payment.advanceAmount,
          status: payment.status,
        },
      });
    } catch (err) { next(err); }
  }

  // ================= RECEIVABLES & AGEING =================
  static async getReceivablesSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReceivablesPayablesService.getReceivablesSummary();
      res.json({ success: true, data: summary });
    } catch (err) { next(err); }
  }

  static async getCustomerAgeing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ageing = await ReceivablesPayablesService.getCustomerAgeingSchedule();
      res.json({ success: true, data: ageing });
    } catch (err) { next(err); }
  }

  static async getCustomerStatement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const statement = await ReceivablesPayablesService.getCustomerStatement(req.params.id);
      res.json({ success: true, data: statement });
    } catch (err) { next(err); }
  }

  // ================= SUPPLIER PAYMENTS =================
  static async recordSupplierPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await SupplierPaymentService.recordPayment({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: payment });
    } catch (err) { next(err); }
  }

  static async getSupplierPayments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { supplierId, status, startDate, endDate } = req.query;
      const payments = await SupplierPaymentService.getPayments({
        supplierId: supplierId as string,
        status: status as any,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data: payments });
    } catch (err) { next(err); }
  }

  static async getSupplierPaymentById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await SupplierPaymentService.getPaymentById(req.params.id);
      res.json({ success: true, data: payment });
    } catch (err) { next(err); }
  }

  static async reverseSupplierPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await SupplierPaymentService.reversePayment(
        req.params.id,
        req.user!.id,
        req.body.reason
      );
      res.json({ success: true, data: payment, message: 'Supplier payment reversed.' });
    } catch (err) { next(err); }
  }

  static async getSupplierPaymentVoucher(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await SupplierPaymentService.getPaymentById(req.params.id);
      res.json({
        success: true,
        data: {
          voucherNumber: payment.voucherNumber,
          paymentNumber: payment.paymentNumber,
          date: payment.paymentDate,
          supplier: payment.supplier,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          referenceNumber: payment.referenceNumber,
          allocations: payment.allocations,
          advanceAmount: payment.advanceAmount,
          status: payment.status,
        },
      });
    } catch (err) { next(err); }
  }

  // ================= PAYABLES & SUPPLIER AGEING =================
  static async getPayablesSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReceivablesPayablesService.getPayablesSummary();
      res.json({ success: true, data: summary });
    } catch (err) { next(err); }
  }

  static async getSupplierAgeing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ageing = await ReceivablesPayablesService.getSupplierAgeingSchedule();
      res.json({ success: true, data: ageing });
    } catch (err) { next(err); }
  }

  static async getSupplierStatement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const statement = await ReceivablesPayablesService.getSupplierStatement(req.params.id);
      res.json({ success: true, data: statement });
    } catch (err) { next(err); }
  }

  // ================= EXPENSES =================
  static async recordExpense(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await ExpenseService.recordExpense({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: expense });
    } catch (err) { next(err); }
  }

  static async getExpenses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { category, status, financialAccountId, startDate, endDate } = req.query;
      const expenses = await ExpenseService.getExpenses({
        category: category as any,
        status: status as any,
        financialAccountId: financialAccountId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data: expenses });
    } catch (err) { next(err); }
  }

  static async approveExpense(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await ExpenseService.approveExpense(req.params.id, req.user!.id);
      res.json({ success: true, data: expense, message: 'Expense approved and posted.' });
    } catch (err) { next(err); }
  }

  static async rejectExpense(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await ExpenseService.rejectExpense(req.params.id, req.user!.id, req.body.reason);
      res.json({ success: true, data: expense, message: 'Expense rejected.' });
    } catch (err) { next(err); }
  }

  static async getExpenseSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ExpenseService.getExpenseSummary();
      res.json({ success: true, data: summary });
    } catch (err) { next(err); }
  }

  // ================= DOUBLE-ENTRY ACCOUNTING & GL =================
  static async getChartOfAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const coa = await AccountingService.getChartOfAccounts();
      res.json({ success: true, data: coa });
    } catch (err) { next(err); }
  }

  static async createChartOfAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const acc = await AccountingService.createAccount(req.body);
      res.status(201).json({ success: true, data: acc });
    } catch (err) { next(err); }
  }

  static async postJournalEntry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const journal = await AccountingService.postJournalEntry(prisma, {
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: journal });
    } catch (err) { next(err); }
  }

  static async getJournalEntries(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { entryType, startDate, endDate } = req.query;
      const journals = await AccountingService.getJournalEntries({
        entryType: entryType as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data: journals });
    } catch (err) { next(err); }
  }

  static async getGeneralLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { accountCode, startDate, endDate } = req.query;
      const ledger = await AccountingService.getGeneralLedger({
        accountCode: accountCode as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data: ledger });
    } catch (err) { next(err); }
  }

  static async getTrialBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tb = await AccountingService.getTrialBalance();
      res.json({ success: true, data: tb });
    } catch (err) { next(err); }
  }

  static async getProfitLoss(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const pl = await AccountingService.getProfitLoss(startDate as string, endDate as string);
      res.json({ success: true, data: pl });
    } catch (err) { next(err); }
  }

  static async getBalanceSheet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const bs = await AccountingService.getBalanceSheet();
      res.json({ success: true, data: bs });
    } catch (err) { next(err); }
  }

  // ================= BANK RECONCILIATION =================
  static async importBankStatement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const statement = await BankReconciliationService.importStatement({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: statement });
    } catch (err) { next(err); }
  }

  static async getBankStatements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { financialAccountId } = req.query;
      const statements = await BankReconciliationService.getStatements(financialAccountId as string);
      res.json({ success: true, data: statements });
    } catch (err) { next(err); }
  }

  static async getBankStatementById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const statement = await BankReconciliationService.getStatementById(req.params.id);
      res.json({ success: true, data: statement });
    } catch (err) { next(err); }
  }

  static async autoMatchBankStatement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await BankReconciliationService.autoMatch(req.params.id, req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async manualMatchBankStatement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lineId, transactionId } = req.body;
      const result = await BankReconciliationService.manualMatch(lineId, transactionId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async finalizeBankReconciliation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const reconciliation = await BankReconciliationService.finalizeReconciliation(
        req.params.id,
        req.user!.id,
        req.body.notes
      );
      res.json({ success: true, data: reconciliation });
    } catch (err) { next(err); }
  }

  static async getBankReconciliationReports(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const reports = await BankReconciliationService.getReconciliationReports();
      res.json({ success: true, data: reports });
    } catch (err) { next(err); }
  }

  // ================= DASHBOARD & PROFITABILITY =================
  static async getFinancialDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dashboard = await FinancialDashboardService.getDashboardMetrics();
      res.json({ success: true, data: dashboard });
    } catch (err) { next(err); }
  }

  static async getProductProfitability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profit = await ProfitabilityService.getProductProfitability();
      res.json({ success: true, data: profit });
    } catch (err) { next(err); }
  }

  static async getCustomerProfitability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profit = await ProfitabilityService.getCustomerProfitability();
      res.json({ success: true, data: profit });
    } catch (err) { next(err); }
  }

  static async getOverallProfitability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ProfitabilityService.getOverallProfitabilitySummary();
      res.json({ success: true, data: summary });
    } catch (err) { next(err); }
  }
}
