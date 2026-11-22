import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateJWT, requireRole } from '../middleware/auth.js';
import { FinanceController } from '../controllers/finance.controller.js';

const router = Router();

// ================= FINANCIAL ACCOUNTS =================
router.post('/accounts', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.createAccount);
router.get('/accounts', authenticateJWT, FinanceController.getAccounts);
router.get('/accounts/:id', authenticateJWT, FinanceController.getAccountById);
router.post('/accounts/transfer', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.contraTransfer);
router.get('/cashbook', authenticateJWT, FinanceController.getCashbook);
router.get('/bankbook', authenticateJWT, FinanceController.getBankbook);

// ================= CUSTOMER PAYMENTS =================
router.post('/customer-payments', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.SALESMAN), FinanceController.recordCustomerPayment);
router.get('/customer-payments', authenticateJWT, FinanceController.getCustomerPayments);
router.get('/customer-payments/:id', authenticateJWT, FinanceController.getCustomerPaymentById);
router.post('/customer-payments/:id/reverse', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.reverseCustomerPayment);
router.get('/customer-payments/:id/receipt', authenticateJWT, FinanceController.getCustomerPaymentReceipt);

// ================= RECEIVABLES & AGEING =================
router.get('/receivables/summary', authenticateJWT, FinanceController.getReceivablesSummary);
router.get('/receivables/ageing', authenticateJWT, FinanceController.getCustomerAgeing);
router.get('/receivables/customers/:id/statement', authenticateJWT, FinanceController.getCustomerStatement);

// ================= SUPPLIER PAYMENTS =================
router.post('/supplier-payments', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.recordSupplierPayment);
router.get('/supplier-payments', authenticateJWT, FinanceController.getSupplierPayments);
router.get('/supplier-payments/:id', authenticateJWT, FinanceController.getSupplierPaymentById);
router.post('/supplier-payments/:id/reverse', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.reverseSupplierPayment);
router.get('/supplier-payments/:id/voucher', authenticateJWT, FinanceController.getSupplierPaymentVoucher);

// ================= PAYABLES & SUPPLIER AGEING =================
router.get('/payables/summary', authenticateJWT, FinanceController.getPayablesSummary);
router.get('/payables/ageing', authenticateJWT, FinanceController.getSupplierAgeing);
router.get('/payables/suppliers/:id/statement', authenticateJWT, FinanceController.getSupplierStatement);

// ================= OPERATIONAL EXPENSES =================
router.post('/expenses', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.PRODUCTION_SUPERVISOR), FinanceController.recordExpense);
router.get('/expenses', authenticateJWT, FinanceController.getExpenses);
router.post('/expenses/:id/approve', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.approveExpense);
router.post('/expenses/:id/reject', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.rejectExpense);
router.get('/expenses/summary', authenticateJWT, FinanceController.getExpenseSummary);

// ================= GENERAL LEDGER & ACCOUNTING =================
router.get('/accounting/chart-of-accounts', authenticateJWT, FinanceController.getChartOfAccounts);
router.post('/accounting/chart-of-accounts', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.createChartOfAccount);
router.get('/accounting/journals', authenticateJWT, FinanceController.getJournalEntries);
router.post('/accounting/journals', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR), FinanceController.postJournalEntry);
router.get('/accounting/general-ledger', authenticateJWT, FinanceController.getGeneralLedger);
router.get('/accounting/trial-balance', authenticateJWT, FinanceController.getTrialBalance);
router.get('/accounting/profit-loss', authenticateJWT, FinanceController.getProfitLoss);
router.get('/accounting/balance-sheet', authenticateJWT, FinanceController.getBalanceSheet);

// ================= BANK RECONCILIATION =================
router.post('/reconciliation/import', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR), FinanceController.importBankStatement);
router.get('/reconciliation/statements', authenticateJWT, FinanceController.getBankStatements);
router.get('/reconciliation/statements/:id', authenticateJWT, FinanceController.getBankStatementById);
router.post('/reconciliation/:id/auto-match', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR), FinanceController.autoMatchBankStatement);
router.post('/reconciliation/manual-match', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR), FinanceController.manualMatchBankStatement);
router.post('/reconciliation/:id/finalize', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), FinanceController.finalizeBankReconciliation);
router.get('/reconciliation/reports', authenticateJWT, FinanceController.getBankReconciliationReports);

// ================= DASHBOARD & PROFITABILITY =================
router.get('/dashboard', authenticateJWT, FinanceController.getFinancialDashboard);
router.get('/profitability/products', authenticateJWT, FinanceController.getProductProfitability);
router.get('/profitability/customers', authenticateJWT, FinanceController.getCustomerProfitability);
router.get('/profitability/summary', authenticateJWT, FinanceController.getOverallProfitability);

export default router;
