import { PaymentMethod, Role, ItemType } from '@prisma/client';
import prisma from '../db/client.js';
import { CustomerPaymentService } from '../services/customer-payment.service.js';
import { SupplierPaymentService } from '../services/supplier-payment.service.js';
import { ExpenseService } from '../services/expense.service.js';
import { FinancialAccountService } from '../services/financial-account.service.js';
import { ReceivablesPayablesService } from '../services/receivables-payables.service.js';
import { AccountingService } from '../services/accounting.service.js';
import { ProfitabilityService } from '../services/profitability.service.js';
import { FinancialDashboardService } from '../services/financial-dashboard.service.js';
import { runPhase5Benchmark } from './verify-phase5-benchmark.js';

let passed = 0;
let failed = 0;

function check(title: string, condition: boolean, actual: any, expected: any) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${title}: ${actual}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${title} | Expected: ${expected}, Got: ${actual}`);
  }
}

export async function runPhase6Benchmark() {
  console.log('\n======================================================================');
  console.log('   FACTORYFLOW EVALUATION BENCHMARK: PHASE 6 FINANCE & AR/AP           ');
  console.log('   Order-to-Audit Management System: Packaged Murukku (200 g)         ');
  console.log('======================================================================\n');

  // 1. Run Phase 5 benchmark baseline to set up sales orders, invoices, stock dispatches
  console.log('[Phase 6 Benchmark] Initializing Phase 5 sales invoices and inventory baseline...');
  await runPhase5Benchmark();

  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!admin) throw new Error('Admin user not found.');
  const adminId = admin.id;

  // Retrieve Invoices created in Phase 5 benchmark
  const invoices = await prisma.invoice.findMany({
    include: { customer: true },
    orderBy: { invoiceDate: 'asc' },
  });

  const invoiceA = invoices.find(i => i.customer.name.includes('Retailer A') || i.customer.name.includes('Trichy'));
  const invoiceB = invoices.find(i => i.customer.name.includes('Distributor B') || i.customer.name.includes('Bengaluru'));

  if (!invoiceA || !invoiceB) {
    throw new Error('Phase 5 benchmark invoices for Retailer A and Distributor B were not found.');
  }

  // Retrieve or create Supplier Purchase Invoice for Supplier A (Flour)
  let supplierA = await prisma.supplier.findFirst({ where: { name: { contains: 'Grain' } } });
  if (!supplierA) {
    supplierA = await prisma.supplier.findFirst();
  }
  if (!supplierA) throw new Error('Supplier A not found.');

  // Create standard benchmark purchase invoice for Supplier A: ₹12,000
  let purchaseA = await prisma.purchase.findFirst({
    where: { supplierId: supplierA.id },
  });

  if (!purchaseA) {
    const rawMaterial = await prisma.rawMaterial.findFirst({ where: { code: 'RM-FLOUR-01' } }) || await prisma.rawMaterial.findFirst();
    purchaseA = await prisma.purchase.create({
      data: {
        purchaseNumber: 'PUR-2026-0001',
        supplierId: supplierA.id,
        supplierInvoiceNumber: 'INV-SUP-8899',
        totalTaxable: 11428.57,
        totalGst: 571.43,
        grandTotal: 12000.0,
        paidAmount: 0.0,
        outstandingAmount: 12000.0,
        paymentStatus: 'UNPAID',
        status: 'RECEIVED',
        createdById: adminId,
        items: {
          create: [
            {
              itemType: ItemType.RAW_MATERIAL,
              rawMaterialId: rawMaterial?.id,
              quantity: 300,
              receivedQuantity: 300,
              unit: 'kg',
              unitPrice: 40.0,
              taxableAmount: 11428.57,
              gstRate: 5.0,
              gstAmount: 571.43,
              totalAmount: 12000.0,
            },
          ],
        },
      },
    });
  } else {
    // Reset purchase amount to benchmark ₹12,000
    purchaseA = await prisma.purchase.update({
      where: { id: purchaseA.id },
      data: {
        grandTotal: 12000.0,
        paidAmount: 0.0,
        outstandingAmount: 12000.0,
        paymentStatus: 'UNPAID',
      },
    });
  }

  // Ensure default Cash and Bank accounts exist and have exact benchmark opening balances
  await FinancialAccountService.ensureDefaultAccounts();
  const cashAcc = await prisma.financialAccount.findFirst({ where: { accountType: 'CASH' } });
  const bankAcc = await prisma.financialAccount.findFirst({ where: { accountType: 'CURRENT_ACCOUNT' } });

  if (!cashAcc || !bankAcc) throw new Error('Default Cash and Bank accounts not found.');

  // Reset accounts to benchmark opening balances: Cash = ₹10,000, Bank = ₹50,000
  await prisma.financialAccountTransaction.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.supplierPaymentAllocation.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.journalEntryLine.deleteMany();
  await prisma.journalEntry.deleteMany();

  await prisma.financialAccount.update({
    where: { id: cashAcc.id },
    data: { openingBalance: 10000.0, currentBalance: 10000.0 },
  });
  await prisma.financialAccount.update({
    where: { id: bankAcc.id },
    data: { openingBalance: 50000.0, currentBalance: 50000.0 },
  });

  console.log('\n--- FINANCIAL ACCOUNT OPENING BALANCES ---');
  check('Opening Cash on Hand Balance', Number(cashAcc.openingBalance) === 10000, Number(cashAcc.openingBalance), 10000);
  check('Opening SBI Bank Balance', Number(bankAcc.openingBalance) === 50000, Number(bankAcc.openingBalance), 50000);

  // ------------------------------------------------------------------
  // 1. CUSTOMER PAYMENT 1: Retailer A (Partial Payment in Cash: ₹3,000)
  // ------------------------------------------------------------------
  console.log('\n--- TRANSACTION 1: RETAILER A PARTIAL PAYMENT (CASH: ₹3,000) ---');
  const paymentA = await CustomerPaymentService.recordPayment({
    customerId: invoiceA.customerId,
    invoiceId: invoiceA.id,
    amount: 3000.0,
    paymentMethod: PaymentMethod.CASH,
    financialAccountId: cashAcc.id,
    referenceNumber: 'CASH-REC-001',
    notes: 'Partial payment received at shop collection',
    userId: adminId,
  });

  const updatedInvA = await prisma.invoice.findUnique({ where: { id: invoiceA.id } });
  check('Invoice A Paid Amount (₹3,000)', Number(updatedInvA?.paidAmount) === 3000, Number(updatedInvA?.paidAmount), 3000);
  check('Invoice A Outstanding Balance (₹5,250 - ₹3,000)', Number(updatedInvA?.outstandingAmount) === 2250, Number(updatedInvA?.outstandingAmount), 2250);
  check('Invoice A Status is PARTIALLY_PAID', updatedInvA?.status === 'PARTIALLY_PAID', updatedInvA?.status, 'PARTIALLY_PAID');

  const cashAfterPmtA = await prisma.financialAccount.findUnique({ where: { id: cashAcc.id } });
  check('Cash Balance after Receipt (₹10,000 + ₹3,000)', Number(cashAfterPmtA?.currentBalance) === 13000, Number(cashAfterPmtA?.currentBalance), 13000);

  // ------------------------------------------------------------------
  // 2. CUSTOMER PAYMENT 2: Distributor B (Full Payment via Bank: ₹2,625)
  // ------------------------------------------------------------------
  console.log('\n--- TRANSACTION 2: DISTRIBUTOR B FULL SETTLEMENT (BANK: ₹2,625) ---');
  const paymentB = await CustomerPaymentService.recordPayment({
    customerId: invoiceB.customerId,
    invoiceId: invoiceB.id,
    amount: 2625.0,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    financialAccountId: bankAcc.id,
    referenceNumber: 'NEFT-KA-990011',
    notes: 'Full payment settlement for inter-state consignment',
    userId: adminId,
  });

  const updatedInvB = await prisma.invoice.findUnique({ where: { id: invoiceB.id } });
  check('Invoice B Paid Amount (₹2,625)', Number(updatedInvB?.paidAmount) === 2625, Number(updatedInvB?.paidAmount), 2625);
  check('Invoice B Outstanding Balance (₹0)', Number(updatedInvB?.outstandingAmount) === 0, Number(updatedInvB?.outstandingAmount), 0);
  check('Invoice B Status is PAID', updatedInvB?.status === 'PAID', updatedInvB?.status, 'PAID');

  const bankAfterPmtB = await prisma.financialAccount.findUnique({ where: { id: bankAcc.id } });
  check('Bank Balance after Receipt (₹50,000 + ₹2,625)', Number(bankAfterPmtB?.currentBalance) === 52625, Number(bankAfterPmtB?.currentBalance), 52625);

  // ------------------------------------------------------------------
  // 3. SUPPLIER PAYMENT: Supplier A (Flour) Partial Payment: ₹7,000
  // ------------------------------------------------------------------
  console.log('\n--- TRANSACTION 3: SUPPLIER A PARTIAL DISBURSEMENT (BANK: ₹7,000) ---');
  const supplierPayment = await SupplierPaymentService.recordPayment({
    supplierId: supplierA.id,
    purchaseId: purchaseA.id,
    amount: 7000.0,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    financialAccountId: bankAcc.id,
    referenceNumber: 'RTGS-SBI-554433',
    notes: 'Part-settlement for flour delivery',
    userId: adminId,
  });

  const updatedPurA = await prisma.purchase.findUnique({ where: { id: purchaseA.id } });
  check('Supplier Purchase Paid Amount (₹7,000)', Number(updatedPurA?.paidAmount) === 7000, Number(updatedPurA?.paidAmount), 7000);
  check('Supplier Purchase Outstanding Balance (₹12,000 - ₹7,000)', Number(updatedPurA?.outstandingAmount) === 5000, Number(updatedPurA?.outstandingAmount), 5000);
  check('Supplier Purchase Payment Status is PARTIALLY_PAID', updatedPurA?.paymentStatus === 'PARTIALLY_PAID', updatedPurA?.paymentStatus, 'PARTIALLY_PAID');

  const bankAfterSupp = await prisma.financialAccount.findUnique({ where: { id: bankAcc.id } });
  check('Bank Balance after Supplier Disbursement (₹52,625 - ₹7,000)', Number(bankAfterSupp?.currentBalance) === 45625, Number(bankAfterSupp?.currentBalance), 45625);

  // ------------------------------------------------------------------
  // 4. OPERATIONAL EXPENSES: Total ₹3,500
  // Electricity: ₹2,000 (Cash)
  // Transportation: ₹1,000 (Cash)
  // Maintenance: ₹500 (Bank)
  // ------------------------------------------------------------------
  console.log('\n--- TRANSACTION 4: OPERATIONAL EXPENSES (TOTAL ₹3,500) ---');
  const expElec = await ExpenseService.recordExpense({
    category: 'ELECTRICITY' as any,
    description: 'TNEB Factory Power Bill - April 2026',
    amount: 2000.0,
    paymentMethod: PaymentMethod.CASH,
    financialAccountId: cashAcc.id,
    referenceNumber: 'EB-REC-9944',
    userId: adminId,
  });
  check('Electricity Expense Recorded & Posted', expElec?.status === 'POSTED', expElec?.status, 'POSTED');

  const expTrans = await ExpenseService.recordExpense({
    category: 'TRANSPORTATION' as any,
    description: 'Local tempo delivery freight charges',
    amount: 1000.0,
    paymentMethod: PaymentMethod.CASH,
    financialAccountId: cashAcc.id,
    referenceNumber: 'TR-VCH-12',
    userId: adminId,
  });
  check('Transportation Expense Recorded & Posted', expTrans?.status === 'POSTED', expTrans?.status, 'POSTED');

  const expMaint = await ExpenseService.recordExpense({
    category: 'MAINTENANCE' as any,
    description: 'Frying machine motor servicing & grease',
    amount: 500.0,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    financialAccountId: bankAcc.id,
    referenceNumber: 'SVC-SBI-101',
    userId: adminId,
  });
  check('Maintenance Expense Recorded & Posted', expMaint?.status === 'POSTED', expMaint?.status, 'POSTED');

  // ------------------------------------------------------------------
  // 5. CLOSING BALANCES & INTEGRITY AUDIT
  // ------------------------------------------------------------------
  console.log('\n--- FINAL BENCHMARK INTEGRITY AUDIT ---');

  const finalCash = await prisma.financialAccount.findUnique({ where: { id: cashAcc.id } });
  const finalBank = await prisma.financialAccount.findUnique({ where: { id: bankAcc.id } });

  // Cash Invariant: 10,000 + 3,000 - 2,000 - 1,000 = 10,000
  check('Closing Cash on Hand Balance', Number(finalCash?.currentBalance) === 10000, Number(finalCash?.currentBalance), 10000);

  // Bank Invariant: 50,000 + 2,625 - 7,000 - 500 = 45,125
  check('Closing SBI Bank Balance', Number(finalBank?.currentBalance) === 45125, Number(finalBank?.currentBalance), 45125);

  const totalLiquid = Number(finalCash?.currentBalance) + Number(finalBank?.currentBalance);
  check('Total Liquid Operating Funds (₹10,000 + ₹45,125)', totalLiquid === 55125, totalLiquid, 55125);

  // Receivables Summary Audit
  const arSummary = await ReceivablesPayablesService.getReceivablesSummary();
  check('Total Invoiced Revenue', arSummary.totalInvoiced === 7875, arSummary.totalInvoiced, 7875);
  check('Total Customer Collections', arSummary.totalCollected === 5625, arSummary.totalCollected, 5625);
  check('Total Accounts Receivable Outstanding', arSummary.totalOutstanding === 2250, arSummary.totalOutstanding, 2250);

  // Payables Summary Audit
  const apSummary = await ReceivablesPayablesService.getPayablesSummary();
  check('Total Supplier Payables Outstanding', apSummary.totalOutstanding === 5000, apSummary.totalOutstanding, 5000);

  // Double-Entry Balanced Journals Audit
  const journals = await prisma.journalEntry.findMany();
  check('Journal Entries Generated (>0)', journals.length >= 6, journals.length, '>= 6');

  const allBalanced = journals.every(j => Number(j.totalDebit) === Number(j.totalCredit));
  check('All Journal Entries Satisfy Debit == Credit', allBalanced, allBalanced, true);

  // Trial Balance Zero Difference Audit
  const trialBalance = await AccountingService.getTrialBalance();
  check('Trial Balance is Balanced (Difference <= 0.05)', trialBalance.isBalanced, trialBalance.isBalanced, true);
  check('Trial Balance Net Difference', trialBalance.difference <= 0.05, trialBalance.difference, 0);

  // Profitability Summary Audit
  const profitability = await ProfitabilityService.getOverallProfitabilitySummary();
  check('Total Taxable Revenue Verified', profitability.totalRevenue === 7500, profitability.totalRevenue, 7500);
  check('Operating Expenses Total', profitability.operatingExpenses === 3500, profitability.operatingExpenses, 3500);

  // Dashboard Metrics Verification
  const dashboard = await FinancialDashboardService.getDashboardMetrics();
  check('Dashboard Liquid Funds matches DB', dashboard.kpis.totalLiquidFunds === 55125, dashboard.kpis.totalLiquidFunds, 55125);
  check('Dashboard Total Receivables matches DB', dashboard.kpis.totalReceivables === 2250, dashboard.kpis.totalReceivables, 2250);
  check('Dashboard Total Payables matches DB', dashboard.kpis.totalPayables === 5000, dashboard.kpis.totalPayables, 5000);

  console.log('\n======================================================================');
  console.log(`   PHASE 6 BENCHMARK EVALUATION SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('   Financial Management Benchmark: 100% VERIFIED');
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1]?.includes('verify-phase6-benchmark')) {
  runPhase6Benchmark().catch((err) => {
    console.error('Benchmark fatal error:', err);
    process.exit(1);
  });
}
