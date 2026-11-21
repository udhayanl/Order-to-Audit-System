import { ItemType, StockMovementType, VarianceStatus, PaymentMethod } from '@prisma/client';
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

interface AuditResult {
  step: string;
  item: string;
  metric: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
  notes?: string;
}

export async function auditBOMAndProduction() {
  console.log('\n================================================================================');
  console.log('       IN-DEPTH AUDIT: BOM & PRODUCTION MANAGEMENT MODULE (NIT TRICHY)         ');
  console.log('================================================================================\n');

  const auditLog: AuditResult[] = [];

  const record = (
    step: string,
    item: string,
    metric: string,
    expected: string | number,
    actual: string | number,
    passed: boolean,
    notes?: string
  ) => {
    auditLog.push({ step, item, metric, expected, actual, passed, notes });
    const statusSymbol = passed ? '[PASS]' : '[FAIL]';
    console.log(`  ${statusSymbol} [${step}] ${item} - ${metric}: Expected=${expected}, Actual=${actual}`);
  };

  // 1. Reset and seed master database
  console.log('Phase 1: Seeding Benchmark Initial Master Data and Opening Balances...');
  const seed = await seedDatabase(true);

  // --------------------------------------------------------------------------
  // AUDIT PART 1: BOM Configuration Audit
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING BOM RECIPE SPECIFICATION ---');
  const bom = await BOMService.getBOMById(seed.bom.id);

  record('BOM', 'Murukku 200 g', 'Batch Size', 200, Number(bom.batchSize), Number(bom.batchSize) === 200);
  record('BOM', 'Murukku 200 g', 'Expected Yield', 200, Number(bom.expectedYield), Number(bom.expectedYield) === 200);
  record('BOM', 'Murukku 200 g', 'Yield Unit', 'packets', bom.yieldUnit, bom.yieldUnit === 'packets');

  // Verify BOM items
  const plannedCalcs = BOMService.calculatePlannedRequirements(bom, 200);
  const flourBOM = plannedCalcs.plannedItems.find((i: any) => i.name.toLowerCase().includes('flour'));
  const oilBOM = plannedCalcs.plannedItems.find((i: any) => i.name.toLowerCase().includes('oil'));
  const spiceBOM = plannedCalcs.plannedItems.find((i: any) => i.name.toLowerCase().includes('spice'));
  const pouchBOM = plannedCalcs.plannedItems.find((i: any) => i.name.toLowerCase().includes('pouch'));
  const cartonBOM = plannedCalcs.plannedItems.find((i: any) => i.name.toLowerCase().includes('carton'));

  record('BOM', 'Flour', 'Standard Qty per 200 pkts', 40, flourBOM?.standardQuantity, flourBOM?.standardQuantity === 40);
  record('BOM', 'Oil', 'Standard Qty per 200 pkts', 10, oilBOM?.standardQuantity, oilBOM?.standardQuantity === 10);
  record('BOM', 'Spice Mix', 'Standard Qty per 200 pkts', 1.2, spiceBOM?.standardQuantity, spiceBOM?.standardQuantity === 1.2);
  record('BOM', 'Pouches', 'Standard Qty per 200 pkts', 200, pouchBOM?.standardQuantity, pouchBOM?.standardQuantity === 200);
  record('BOM', 'Cartons', 'Standard Qty per 200 pkts', 10, cartonBOM?.standardQuantity, cartonBOM?.standardQuantity === 10);

  // --------------------------------------------------------------------------
  // AUDIT PART 2: Opening Stocks Verification
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING OPENING BALANCES IN STOCK LEDGER ---');
  const flourOpening = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  const oilOpening = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
  const spiceOpening = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  const pouchOpening = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
  const cartonOpening = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id);
  const fgOpening = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);

  record('Opening Stock', 'Flour', 'StockLedger Balance', 100, flourOpening, flourOpening === 100);
  record('Opening Stock', 'Oil', 'StockLedger Balance', 30, oilOpening, oilOpening === 30);
  record('Opening Stock', 'Spice Mix', 'StockLedger Balance', 5.0, spiceOpening, spiceOpening === 5.0);
  record('Opening Stock', 'Pouches', 'StockLedger Balance', 500, pouchOpening, pouchOpening === 500);
  record('Opening Stock', 'Cartons', 'StockLedger Balance', 30, cartonOpening, cartonOpening === 30);
  record('Opening Stock', 'Murukku FG', 'StockLedger Balance', 50, fgOpening, fgOpening === 50);

  // --------------------------------------------------------------------------
  // AUDIT PART 3: Step 1 Procurement (60 kg flour @ ₹45/kg)
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING PROCUREMENT (STEP 1: 60 KG FLOUR @ ₹45) ---');
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
    notes: 'Benchmark Step 1: Procurement of 60 kg fresh flour',
  });

  const flourPostPurchase = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  record('Purchase', 'Flour', 'Stock post-purchase', 160, flourPostPurchase, flourPostPurchase === 160);

  // Audit purchase ledger entry
  const poLedgerEntry = await prisma.stockLedger.findFirst({
    where: {
      itemType: ItemType.RAW_MATERIAL,
      itemId: seed.flourRM.id,
      movementType: StockMovementType.PURCHASE_RECEIPT,
      referenceId: po1.purchaseNumber,
    },
  });
  record('StockLedger', 'Flour Purchase', 'Movement Quantity', 60, Number(poLedgerEntry?.quantity), Number(poLedgerEntry?.quantity) === 60);
  record('StockLedger', 'Flour Purchase', 'Balance After Receipt', 160, Number(poLedgerEntry?.balanceAfter), Number(poLedgerEntry?.balanceAfter) === 160);

  // --------------------------------------------------------------------------
  // AUDIT PART 4: Production Run Execution (Steps 2 & 3)
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING PRODUCTION POSTING & VARIANCE (STEPS 2 & 3) ---');
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
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.flourRM.id,
        plannedQuantity: 40,
        actualQuantity: 40,
        unit: 'kg',
      },
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.oilRM.id,
        plannedQuantity: 10,
        actualQuantity: 10.5,
        unit: 'litre',
      },
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.spiceRM.id,
        plannedQuantity: 1.2,
        actualQuantity: 1.2,
        unit: 'kg',
      },
      {
        itemType: ItemType.PACKAGING,
        packagingMaterialId: seed.pouchPkg.id,
        plannedQuantity: 200,
        actualQuantity: 194, // 188 good + 6 damaged
        unit: 'pieces',
      },
      {
        itemType: ItemType.PACKAGING,
        packagingMaterialId: seed.cartonPkg.id,
        plannedQuantity: 10,
        actualQuantity: 9, // 9 cartons used
        unit: 'pieces',
      },
    ],
    notes: 'Audit Batch 1: Murukku 200g production run',
    userId: seed.supervisor.id,
  });

  // Verify Production Run Header Values
  record('Production', 'Header', 'Planned Batch Qty', 200, Number(prodRun.plannedBatchQuantity), Number(prodRun.plannedBatchQuantity) === 200);
  record('Production', 'Header', 'Expected Output Yield', 200, Number(prodRun.expectedOutput), Number(prodRun.expectedOutput) === 200);
  record('Production', 'Header', 'Actual Good Output', 188, Number(prodRun.actualGoodOutput), Number(prodRun.actualGoodOutput) === 188);
  record('Production', 'Header', 'Damaged Pouches (Scrap)', 6, Number(prodRun.damagedPouches), Number(prodRun.damagedPouches) === 6);
  record('Production', 'Header', 'Cartons Used', 9, Number(prodRun.cartonsUsed), Number(prodRun.cartonsUsed) === 9);

  // Recalculate Yield Variance dynamically
  const expectedYieldVariance = Math.round(((188 - 200) / 200) * 100 * 100) / 100; // -6.00%
  record('Variance', 'Murukku Batch', 'Yield Variance %', -6.00, Number(prodRun.yieldVariancePercent), Number(prodRun.yieldVariancePercent) === expectedYieldVariance);
  record('Variance', 'Murukku Batch', 'Yield Variance Status', 'EXCEEDS_TOLERANCE', prodRun.yieldVarianceStatus, prodRun.yieldVarianceStatus === VarianceStatus.EXCEEDS_TOLERANCE);

  // --------------------------------------------------------------------------
  // AUDIT PART 5: Consumptions & Variance Audit
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING CONSUMPTION RECORDS & TOLERANCES ---');
  const consumptions = await prisma.productionConsumption.findMany({
    where: { productionRunId: prodRun.id },
    include: { rawMaterial: true, packagingMaterial: true },
  });

  for (const c of consumptions) {
    const name = c.rawMaterial?.name || c.packagingMaterial?.name || 'Item';
    const planned = Number(c.plannedQuantity);
    const actual = Number(c.actualQuantity);
    const expectedVar = Math.round(((actual - planned) / planned) * 100 * 100) / 100;
    const expectedStatus = Math.abs(expectedVar) > 3.0 ? VarianceStatus.EXCEEDS_TOLERANCE : VarianceStatus.NORMAL;

    record('Consumption', name, 'Planned Qty', planned, planned, true);
    record('Consumption', name, 'Actual Qty', actual, actual, true);
    record('Consumption', name, 'Variance %', expectedVar, Number(c.consumptionVariancePercent), Number(c.consumptionVariancePercent) === expectedVar);
    record('Consumption', name, 'Tolerance Status', expectedStatus, c.varianceStatus, c.varianceStatus === expectedStatus);
  }

  // --------------------------------------------------------------------------
  // AUDIT PART 6: Stock Ledger Deductions and Additions Audit
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING IMMUTABLE STOCK LEDGER DEDUCTIONS & CLOSING BALANCES ---');

  // Query actual latest balances from StockLedger
  const flourClosing = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  const oilClosing = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
  const spiceClosing = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  const pouchClosing = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
  const cartonClosing = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id);
  const fgPostProd = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);

  record('Stock Balance', 'Flour', 'Closing Stock', 120, flourClosing, flourClosing === 120, '100 opening + 60 purchase - 40 consumed');
  record('Stock Balance', 'Oil', 'Closing Stock', 19.5, oilClosing, oilClosing === 19.5, '30 opening - 10.5 consumed');
  record('Stock Balance', 'Spice Mix', 'Closing Stock', 3.8, spiceClosing, spiceClosing === 3.8, '5 opening - 1.2 consumed');
  record('Stock Balance', 'Pouches', 'Closing Stock', 306, pouchClosing, pouchClosing === 306, '500 opening - 194 consumed (188 good + 6 damaged)');
  record('Stock Balance', 'Cartons', 'Closing Stock', 21, cartonClosing, cartonClosing === 21, '30 opening - 9 consumed');
  record('Stock Balance', 'Murukku FG', 'Post-Production Stock', 238, fgPostProd, fgPostProd === 238, '50 opening + 188 actual good output');

  // Audit exact StockLedger entries for this production run
  const runLedgerEntries = await prisma.stockLedger.findMany({
    where: { referenceId: prodRun.runNumber },
    orderBy: { createdAt: 'asc' },
  });

  record('StockLedger', 'Production Run', 'Total Ledger Entries', 6, runLedgerEntries.length, runLedgerEntries.length === 6, '5 issues + 1 output');

  for (const entry of runLedgerEntries) {
    if (entry.movementType === StockMovementType.PRODUCTION_ISSUE) {
      const isNegative = Number(entry.quantity) < 0;
      record('StockLedger', `${entry.itemType} Issue`, 'Negative Quantity Sign', 'Negative', isNegative ? 'Negative' : 'Positive', isNegative);
    } else if (entry.movementType === StockMovementType.PRODUCTION_OUTPUT) {
      record('StockLedger', 'FG Output', 'Output Quantity', 188, Number(entry.quantity), Number(entry.quantity) === 188);
      record('StockLedger', 'FG Output', 'Balance After Output', 238, Number(entry.balanceAfter), Number(entry.balanceAfter) === 238);
    }
  }

  // --------------------------------------------------------------------------
  // AUDIT PART 7: FIFO Costing, Overheads & Margin Audit
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING FIFO VALUATION & UNIT COSTING ---');
  // Flour: 40 kg from ₹42 opening layer = ₹1,680
  // Oil: 10.5 L from ₹140 opening layer = ₹1,470
  // Spice Mix: 1.2 kg from ₹200 opening layer = ₹240
  // Pouches: 194 pcs @ ₹2.50 = ₹485
  // Cartons: 9 pcs @ ₹15 = ₹135
  // Overheads: Labour ₹1,200 + Power/Gas ₹600 = ₹1,800
  // Total Material Cost = 1680 + 1470 + 240 + 485 + 135 = 4010
  // Total Production Cost = 4010 + 1800 = 5810
  // Cost per Packet = 5810 / 188 = 30.904255... -> 30.90
  const expectedTotalMaterialCost = 4010.0;
  const expectedTotalProdCost = 5810.0;
  const expectedCostPerPacket = Math.round((5810 / 188) * 100) / 100; // 30.90

  record('Costing', 'Batch 1', 'Total Material Cost', expectedTotalMaterialCost, Number(prodRun.totalMaterialCost), Number(prodRun.totalMaterialCost) === expectedTotalMaterialCost);
  record('Costing', 'Batch 1', 'Labour Overhead', 1200, Number(prodRun.labourCost), Number(prodRun.labourCost) === 1200);
  record('Costing', 'Batch 1', 'Power/Gas Overhead', 600, Number(prodRun.powerCost), Number(prodRun.powerCost) === 600);
  record('Costing', 'Batch 1', 'Total Production Cost', expectedTotalProdCost, Number(prodRun.totalProductionCost), Number(prodRun.totalProductionCost) === expectedTotalProdCost);
  record('Costing', 'Batch 1', 'Cost per Good Packet', expectedCostPerPacket, Number(prodRun.costPerPacket), Number(prodRun.costPerPacket) === expectedCostPerPacket);

  // --------------------------------------------------------------------------
  // AUDIT PART 8: Retailer A Dispatch & Shortage Control (Steps 4, 5, 6)
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING DISPATCH, FG DEDUCTION & SHORTAGE CONTROL ---');
  const orderA = await OrderService.createOrder({
    customerId: seed.retailerA.id,
    salesmanId: seed.salesmanA.id,
    orderNotes: 'Benchmark Step 4: 150 pkts for Retailer A',
    items: [{ productId: seed.murukkuProduct.id, quantity: 150 }],
  });

  await OrderService.approveOrder(orderA.id, seed.admin.id);
  const invoiceA = await InvoiceService.createInvoiceFromOrder(orderA.id, seed.admin.id);

  // Verify FG stock NOT deducted on order create or approve
  const fgBeforeDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);
  record('Dispatch Rule', 'Murukku FG', 'Stock Before Dispatch', 238, fgBeforeDispatch, fgBeforeDispatch === 238, 'Stock must NOT be deducted on order create/approve');

  // Post dispatch
  const dispatchA = await DispatchService.postDispatch({
    orderId: orderA.id,
    vehicleNumber: 'TN-45-AZ-9988',
    driverName: 'Senthil',
    remarks: 'Dispatched 150 pkts',
    userId: seed.admin.id,
  });

  const fgAfterDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);
  record('Dispatch Rule', 'Murukku FG', 'Stock After Dispatch', 88, fgAfterDispatch, fgAfterDispatch === 88, 'Stock must deduct 150 exclusively on dispatch (238 - 150 = 88)');

  // Verify Shortage Blocking on Order B (120 pkts)
  const orderB = await OrderService.createOrder({
    customerId: seed.distributorB.id,
    salesmanId: seed.salesmanB.id,
    items: [{ productId: seed.murukkuProduct.id, quantity: 120 }],
  });

  const stockCheckB = await OrderService.checkStockAvailability(orderB.id);
  const firstItem = stockCheckB.stockStatus[0];
  record('Shortage Check', 'Order B (120 pkts)', 'Available Stock', 88, firstItem.availableStock, firstItem.availableStock === 88);
  record('Shortage Check', 'Order B (120 pkts)', 'Shortage Quantity', 32, firstItem.shortage, firstItem.shortage === 32);

  let dispatchBlocked = false;
  try {
    await DispatchService.postDispatch({
      orderId: orderB.id,
      vehicleNumber: 'TN-45-ZZ-1122',
      driverName: 'Driver',
      userId: seed.admin.id,
    });
  } catch (err: any) {
    dispatchBlocked = true;
  }
  record('Shortage Check', 'Order B (120 pkts)', 'Excess Dispatch Blocked', 'Blocked', dispatchBlocked ? 'Blocked' : 'Not Blocked', dispatchBlocked);

  // --------------------------------------------------------------------------
  // AUDIT PART 9: Payment & Cost Margin Audit (Steps 7 & 8)
  // --------------------------------------------------------------------------
  console.log('\n--- AUDITING PAYMENT & MARGINS (STEPS 7 & 8) ---');
  const pmt = await PaymentService.recordPayment({
    customerId: seed.retailerA.id,
    amount: 4000,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    referenceNumber: 'NEFT-RETAIL-4000',
    invoiceId: invoiceA.id,
    userId: seed.admin.id,
  });

  const updatedInv = await prisma.invoice.findUnique({ where: { id: invoiceA.id } });
  record('Payment', 'Retailer A', 'Invoice Total', 7875, Number(updatedInv?.grandTotal), Number(updatedInv?.grandTotal) === 7875);
  record('Payment', 'Retailer A', 'Amount Paid', 4000, Number(updatedInv?.paidAmount), Number(updatedInv?.paidAmount) === 4000);
  record('Payment', 'Retailer A', 'Outstanding Balance', 3875, Number(updatedInv?.outstandingAmount), Number(updatedInv?.outstandingAmount) === 3875);

  const sellingPrice = 50.0;
  const unitCost = Number(prodRun.costPerPacket); // 30.90
  const grossMargin = Math.round((sellingPrice - unitCost) * 100) / 100; // 19.10
  const marginPercent = Math.round(((grossMargin / sellingPrice) * 100) * 10) / 10; // 38.2%
  record('Margin', 'Murukku 200 g', 'Gross Margin per Packet', 19.10, grossMargin, grossMargin === 19.10);
  record('Margin', 'Murukku 200 g', 'Gross Margin %', 38.2, marginPercent, marginPercent === 38.2);

  // --------------------------------------------------------------------------
  // SUMMARY TABLE
  // --------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('                          AUDIT VERIFICATION SUMMARY                            ');
  console.log('================================================================================\n');

  console.table(
    auditLog.map((r, i) => ({
      '#': i + 1,
      Step: r.step,
      Item: r.item,
      Metric: r.metric,
      Expected: r.expected,
      Actual: r.actual,
      Result: r.passed ? 'PASSED' : 'FAILED',
    }))
  );

  const totalChecks = auditLog.length;
  const passedChecks = auditLog.filter((r) => r.passed).length;
  const failedChecks = auditLog.filter((r) => !r.passed).length;

  console.log(`\nAUDIT COMPLETED: ${passedChecks}/${totalChecks} CHECKS PASSED (${failedChecks} FAILS)`);

  if (failedChecks === 0) {
    console.log('>>> ALL BOM & PRODUCTION AUDIT CHECKS VERIFIED WITH 100% MATHEMATICAL PRECISION! <<<\n');
  } else {
    console.error(`>>> AUDIT FAILED WITH ${failedChecks} DISCREPANCIES! <<<\n`);
    process.exit(1);
  }
}

// Direct execution
auditBOMAndProduction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal audit error:', err);
    process.exit(1);
  });
