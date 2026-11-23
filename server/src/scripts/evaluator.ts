import { ItemType, OrderStatus, Role, StockMovementType, VarianceStatus, PaymentMethod } from '@prisma/client';
import prisma from '../db/client.js';
import { seedDatabase } from './seed.js';
import { PurchaseService } from '../services/purchase.service.js';
import { ProductionService } from '../services/production.service.js';
import { OrderService } from '../services/order.service.js';
import { InvoiceService } from '../services/invoice.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { PaymentService } from '../services/payment.service.js';
import { InventoryService } from '../services/inventory.service.js';
import { BOMService } from '../services/bom.service.js';
import { ReportService } from '../services/report.service.js';

interface EvalMetric {
  category: string;
  testCase: string;
  expected: any;
  actual: any;
  passed: boolean;
  score: number;
  maxScore: number;
}

export async function runEvaluation() {
  console.log('\n================================================================================');
  console.log('   FACTORYFLOW – ORDER-TO-AUDIT SYSTEM EVALUATION REPORT                        ');
  console.log('   PROJECT: FactoryFlow (Order-to-Audit Management System)                      ');
  console.log('================================================================================\n');

  const evaluations: EvalMetric[] = [];

  const evaluate = (
    category: string,
    testCase: string,
    expected: any,
    actual: any,
    passed: boolean,
    maxScore: number
  ) => {
    const score = passed ? maxScore : 0;
    evaluations.push({ category, testCase, expected, actual, passed, score, maxScore });
    const mark = passed ? '[PASS]' : '[FAIL]';
    console.log(`  ${mark} [${category}] ${testCase}: Expected=${expected}, Actual=${actual} (${score}/${maxScore} pts)`);
  };

  // --------------------------------------------------------------------------
  // SECTION 1: Clean Database Reset & Opening Balances
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: Clean Database Initialization & Opening Balances ---');
  const seed = await seedDatabase(true);

  // Check opening stocks
  const flourOpen = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  const oilOpen = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
  const spiceOpen = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  const pouchOpen = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
  const cartonOpen = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id);
  const fgOpen = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);

  evaluate('Initialization', 'Flour Opening Stock in Ledger', 100, flourOpen, flourOpen === 100, 5);
  evaluate('Initialization', 'Oil Opening Stock in Ledger', 30, oilOpen, oilOpen === 30, 5);
  evaluate('Initialization', 'Spice Mix Opening Stock in Ledger', 5.0, spiceOpen, spiceOpen === 5.0, 5);
  evaluate('Initialization', 'Pouches Opening Stock in Ledger', 500, pouchOpen, pouchOpen === 500, 5);
  evaluate('Initialization', 'Cartons Opening Stock in Ledger', 30, cartonOpen, cartonOpen === 30, 5);
  evaluate('Initialization', 'Murukku FG Opening Stock in Ledger', 50, fgOpen, fgOpen === 50, 5);

  // --------------------------------------------------------------------------
  // SECTION 2: Role Authorization & Security Boundary Verification
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Role-Based Access Controls & Authorization ---');
  let salesmanBlocked = false;
  try {
    // Salesman attempting to order for unassigned distributor
    await OrderService.createOrder({
      customerId: seed.distributorB.id,
      salesmanId: seed.salesmanA.id,
      callerRole: Role.SALESMAN,
      items: [{ productId: seed.murukkuProduct.id, quantity: 10 }],
    });
  } catch (err: any) {
    salesmanBlocked = true;
  }
  evaluate('Security / RBAC', 'Salesman Restricted to Assigned Customers', true, salesmanBlocked, salesmanBlocked, 10);

  // --------------------------------------------------------------------------
  // SECTION 3: Step 1 Procurement (60 kg Flour @ ₹45/kg)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Benchmark Step 1 – Procurement of 60 kg Flour ---');
  const po1 = await PurchaseService.recordPurchase({
    supplierId: seed.supplierGrain.id,
    userId: seed.admin.id,
    items: [
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.flourRM.id,
        quantity: 60,
        unit: 'kg',
        unitPrice: 45,
        gstRate: 5.0,
      },
    ],
    notes: 'Evaluation Step 1',
  });

  const flourAfterPO = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  evaluate('Procurement', 'Flour Stock Post-Purchase (100 + 60)', 160, flourAfterPO, flourAfterPO === 160, 10);
  evaluate('Procurement', 'PO Grand Total (₹2,700 taxable + ₹135 GST)', 2835, Number(po1.grandTotal), Number(po1.grandTotal) === 2835, 5);

  // Check valuation layers for flour
  const flourLayers = await prisma.inventoryValuationLayer.findMany({
    where: { itemId: seed.flourRM.id },
    orderBy: { receivedDate: 'asc' },
  });
  evaluate('FIFO Valuation', 'Total Flour Layers in DB', 2, flourLayers.length, flourLayers.length === 2, 5);
  evaluate('FIFO Valuation', 'Layer 1 Unit Cost (Opening)', 42, Number(flourLayers[0].unitCost), Number(flourLayers[0].unitCost) === 42, 5);
  evaluate('FIFO Valuation', 'Layer 2 Unit Cost (PO-1)', 45, Number(flourLayers[1].unitCost), Number(flourLayers[1].unitCost) === 45, 5);

  // --------------------------------------------------------------------------
  // SECTION 4: Production Run, Variances & Overheads (Steps 2 & 3)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Benchmark Steps 2 & 3 – Production Run & Unit Costing ---');
  const prodRun = await ProductionService.postProductionRun({
    bomId: seed.bom.id,
    plannedBatchQuantity: 200,
    actualGoodOutput: 188,
    damagedPouches: 6,
    cartonsUsed: 9,
    labourCost: 1200,
    powerCost: 600,
    otherOverheads: 0,
    consumptions: [
      { itemType: ItemType.RAW_MATERIAL, rawMaterialId: seed.flourRM.id, plannedQuantity: 40, actualQuantity: 40, unit: 'kg' },
      { itemType: ItemType.RAW_MATERIAL, rawMaterialId: seed.oilRM.id, plannedQuantity: 10, actualQuantity: 10.5, unit: 'litre' },
      { itemType: ItemType.RAW_MATERIAL, rawMaterialId: seed.spiceRM.id, plannedQuantity: 1.2, actualQuantity: 1.2, unit: 'kg' },
      { itemType: ItemType.PACKAGING, packagingMaterialId: seed.pouchPkg.id, plannedQuantity: 200, actualQuantity: 194, unit: 'pieces' },
      { itemType: ItemType.PACKAGING, packagingMaterialId: seed.cartonPkg.id, plannedQuantity: 10, actualQuantity: 9, unit: 'pieces' },
    ],
    notes: 'Benchmark Production Run PR-1',
    userId: seed.supervisor.id,
  });

  // Material Closing Balances
  const flourEnd = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  const oilEnd = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
  const spiceEnd = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  const pouchEnd = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
  const cartonEnd = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id);
  const fgPostProd = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);

  evaluate('Inventory Deduction', 'Flour Closing Stock (160 - 40)', 120, flourEnd, flourEnd === 120, 10);
  evaluate('Inventory Deduction', 'Oil Closing Stock (30 - 10.5)', 19.5, oilEnd, oilEnd === 19.5, 10);
  evaluate('Inventory Deduction', 'Spice Mix Closing Stock (5.0 - 1.2)', 3.8, spiceEnd, spiceEnd === 3.8, 10);
  evaluate('Inventory Deduction', 'Pouches Closing Stock (500 - 194)', 306, pouchEnd, pouchEnd === 306, 10);
  evaluate('Inventory Deduction', 'Cartons Closing Stock (30 - 9)', 21, cartonEnd, cartonEnd === 21, 10);
  evaluate('Production Output', 'Finished Goods Stock (50 + 188)', 238, fgPostProd, fgPostProd === 238, 10);

  // Variances
  evaluate('Production Variance', 'Batch Yield Variance %', -6.0, Number(prodRun.yieldVariancePercent), Number(prodRun.yieldVariancePercent) === -6.0, 10);
  evaluate('Production Variance', 'Batch Yield Status (Tolerance > 3%)', 'EXCEEDS_TOLERANCE', prodRun.yieldVarianceStatus, prodRun.yieldVarianceStatus === VarianceStatus.EXCEEDS_TOLERANCE, 10);

  const oilConsumption = prodRun.consumptions.find(c => c.rawMaterialId === seed.oilRM.id);
  evaluate('Consumption Variance', 'Oil Consumption Variance (+5%)', 5.0, Number(oilConsumption?.consumptionVariancePercent), Number(oilConsumption?.consumptionVariancePercent) === 5.0, 10);
  evaluate('Consumption Variance', 'Oil Variance Status (> 3%)', 'EXCEEDS_TOLERANCE', oilConsumption?.varianceStatus, oilConsumption?.varianceStatus === VarianceStatus.EXCEEDS_TOLERANCE, 10);

  // Costing
  evaluate('Unit Costing', 'Total Production Cost (₹4,010 + ₹1,800)', 5810, Number(prodRun.totalProductionCost), Number(prodRun.totalProductionCost) === 5810, 10);
  evaluate('Unit Costing', 'Cost per Good Packet (₹5,810 / 188)', 30.90, Number(prodRun.costPerPacket), Number(prodRun.costPerPacket) === 30.90, 10);

  // --------------------------------------------------------------------------
  // SECTION 5: Sales Order, Admin Modification, GST Invoice & Dispatch
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Benchmark Steps 4 & 5 – Order, Modification, GST Invoice & Dispatch ---');
  const orderA = await OrderService.createOrder({
    customerId: seed.retailerA.id,
    salesmanId: seed.salesmanA.id,
    orderNotes: 'Retailer A Festival Order',
    items: [{ productId: seed.murukkuProduct.id, quantity: 150 }],
  });

  // Admin approves order
  await OrderService.approveOrder(orderA.id, seed.admin.id);

  // Generate GST Invoice
  const invoiceA = await InvoiceService.createInvoiceFromOrder(orderA.id, seed.admin.id);
  evaluate('GST Invoicing', 'Invoice Number Format', 'INV-2026-0001', invoiceA.invoiceNumber, invoiceA.invoiceNumber.startsWith('INV-'), 5);
  evaluate('GST Invoicing', 'Taxable Value (150 pkts * ₹50)', 7500, Number(invoiceA.totalTaxable), Number(invoiceA.totalTaxable) === 7500, 10);
  evaluate('GST Invoicing', 'CGST (Tamil Nadu -> TN: 2.5%)', 187.50, Number(invoiceA.cgstAmount), Number(invoiceA.cgstAmount) === 187.50, 10);
  evaluate('GST Invoicing', 'SGST (Tamil Nadu -> TN: 2.5%)', 187.50, Number(invoiceA.sgstAmount), Number(invoiceA.sgstAmount) === 187.50, 10);
  evaluate('GST Invoicing', 'IGST (Intra-state = 0)', 0, Number(invoiceA.igstAmount), Number(invoiceA.igstAmount) === 0, 5);
  evaluate('GST Invoicing', 'Grand Total Tax Invoice', 7875, Number(invoiceA.grandTotal), Number(invoiceA.grandTotal) === 7875, 10);

  // Verify finished goods stock NOT deducted before dispatch
  const fgBeforeDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);
  evaluate('Dispatch Integrity', 'FG Stock Untouched Before Dispatch', 238, fgBeforeDispatch, fgBeforeDispatch === 238, 10);

  // Post Dispatch
  await DispatchService.postDispatch({
    orderId: orderA.id,
    vehicleNumber: 'TN-45-AZ-9988',
    driverName: 'Senthil',
    remarks: 'Dispatched 150 pkts',
    userId: seed.admin.id,
  });

  const fgAfterDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);
  evaluate('Dispatch Integrity', 'FG Stock After Dispatch (238 - 150)', 88, fgAfterDispatch, fgAfterDispatch === 88, 15);

  // --------------------------------------------------------------------------
  // SECTION 6: Shortage Detection & Dispatch Blocking (Step 6)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Benchmark Step 6 – Shortage Detection & Dispatch Prevention ---');
  const orderB = await OrderService.createOrder({
    customerId: seed.distributorB.id,
    salesmanId: seed.salesmanB.id,
    items: [{ productId: seed.murukkuProduct.id, quantity: 120 }],
  });

  const stockCheckB = await OrderService.checkStockAvailability(orderB.id);
  evaluate('Shortage Control', 'Available Stock Detected', 88, stockCheckB.stockStatus[0].availableStock, stockCheckB.stockStatus[0].availableStock === 88, 10);
  evaluate('Shortage Control', 'Shortage Correctly Computed (120 - 88)', 32, stockCheckB.stockStatus[0].shortage, stockCheckB.stockStatus[0].shortage === 32, 10);

  let dispatchBBlocked = false;
  try {
    await DispatchService.postDispatch({
      orderId: orderB.id,
      userId: seed.admin.id,
    });
  } catch (err: any) {
    dispatchBBlocked = true;
  }
  evaluate('Shortage Control', 'Dispatch of Excess Quantity Aborted', true, dispatchBBlocked, dispatchBBlocked, 15);

  // --------------------------------------------------------------------------
  // SECTION 7: Customer Payment & Allocation (Step 7)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Benchmark Step 7 – Customer Payment & Receivables ---');
  await PaymentService.recordPayment({
    customerId: seed.retailerA.id,
    invoiceId: invoiceA.id,
    amount: 4000,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    referenceNumber: 'NEFT-RETAIL-4000',
    userId: seed.admin.id,
  });

  const invPostPayment = await prisma.invoice.findUnique({ where: { id: invoiceA.id } });
  evaluate('Payment Settlement', 'Amount Paid Recorded', 4000, Number(invPostPayment?.paidAmount), Number(invPostPayment?.paidAmount) === 4000, 10);
  evaluate('Payment Settlement', 'Remaining Outstanding Balance (7,875 - 4,000)', 3875, Number(invPostPayment?.outstandingAmount), Number(invPostPayment?.outstandingAmount) === 3875, 10);

  // --------------------------------------------------------------------------
  // SECTION 8: Margin Analysis & Statutory Reporting (Steps 8 & 9)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Benchmark Steps 8 & 9 – Costing Margins & Statutory Reports ---');
  const unitSellingPrice = 50.0;
  const unitMfgCost = Number(prodRun.costPerPacket); // 30.90
  const grossMarginPkt = Math.round((unitSellingPrice - unitMfgCost) * 100) / 100; // 19.10
  const grossMarginPct = Math.round(((grossMarginPkt / unitSellingPrice) * 100) * 10) / 10; // 38.2%

  evaluate('Cost & Margin', 'Gross Profit Margin per Packet', 19.10, grossMarginPkt, grossMarginPkt === 19.10, 10);
  evaluate('Cost & Margin', 'Gross Margin Percentage', 38.2, grossMarginPct, grossMarginPct === 38.2, 10);

  const gstReport = await ReportService.getGSTSummary();
  evaluate('Statutory Reports', 'GSTR-3B Outward Taxable Turnover', 7500, gstReport.gstr3b.outwardTaxableSupplies, gstReport.gstr3b.outwardTaxableSupplies === 7500, 10);
  evaluate('Statutory Reports', 'GSTR-3B Total Tax Liability', 375, gstReport.gstr3b.totalTaxLiability, gstReport.gstr3b.totalTaxLiability === 375, 10);

  // --------------------------------------------------------------------------
  // EVALUATION SCORECARD
  // --------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('                 FINAL FACTORYFLOW EVALUATION SCORECARD                     ');
  console.log('================================================================================\n');

  console.table(
    evaluations.map((e, idx) => ({
      '#': idx + 1,
      Category: e.category,
      TestCase: e.testCase,
      Expected: e.expected,
      Actual: e.actual,
      Result: e.passed ? 'PASS' : 'FAIL',
      Score: `${e.score}/${e.maxScore}`,
    }))
  );

  const totalScore = evaluations.reduce((s, e) => s + e.score, 0);
  const maxTotalScore = evaluations.reduce((s, e) => s + e.maxScore, 0);
  const percentScore = Math.round((totalScore / maxTotalScore) * 1000) / 10;

  console.log(`\nTOTAL EVALUATION SCORE: ${totalScore} / ${maxTotalScore} points (${percentScore}%)\n`);

  if (totalScore === maxTotalScore) {
    console.log('>>> EVALUATION GRADE: A+ (PERFECT BENCHMARK ACCURACY & CODE RIGOR) <<<\n');
  } else {
    console.error(`>>> EVALUATION DEFICIENCIES FOUND (${maxTotalScore - totalScore} points deducted) <<<\n`);
    process.exit(1);
  }
}

// Execute
runEvaluation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Evaluation Error:', err);
    process.exit(1);
  });
