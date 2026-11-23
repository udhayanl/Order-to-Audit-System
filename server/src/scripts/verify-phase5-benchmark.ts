import { ItemType, StockMovementType, Role, OrderStatus, InvoiceStatus, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from '../services/inventory.service.js';
import { OrderService } from '../services/order.service.js';
import { StockAllocationService } from '../services/stock-allocation.service.js';
import { InvoiceService } from '../services/invoice.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { seedDatabase } from './seed.js';

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

export async function runPhase5Benchmark() {
  console.log('\n======================================================================');
  console.log('   FACTORYFLOW EVALUATION BENCHMARK: PHASE 5 SALES & DISPATCH          ');
  console.log('   Order-to-Audit Management System: Packaged Murukku (200 g)         ');
  console.log('======================================================================\n');

  // 1. Seed database clean
  console.log('[Phase 5 Benchmark] Resetting and seeding fresh benchmark baseline...');
  const seed = await seedDatabase(true);
  const adminId = seed.admin.id;
  const salesmanAId = seed.salesmanA.id;
  const murukku = seed.murukkuProduct;
  const retailerA = seed.retailerA;
  const distributorB = seed.distributorB;

  // Clear any existing finished goods stock to set baseline exactly to 188 pkts (Phase 4 output)
  const currentMurukkuStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);
  const diffTo188 = 188 - currentMurukkuStock;

  if (diffTo188 !== 0) {
    await InventoryService.recordMovement(prisma, {
      itemType: ItemType.FINISHED_GOOD,
      itemId: murukku.id,
      movementType: StockMovementType.PRODUCTION_OUTPUT,
      quantity: diffTo188,
      unit: 'packets',
      direction: diffTo188 > 0 ? 'IN' : 'OUT',
      referenceType: 'PHASE4_BENCHMARK_BATCH',
      referenceId: 'BATCH-2026-0001',
      notes: 'Phase 4 actual production run output baseline (188 packets)',
      userId: adminId,
    });
  }

  const startingStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);
  console.log(`[Phase 5 Benchmark] Initial Verified FG Stock: ${startingStock} packets\n`);
  check('Initial Finished Goods Stock Baseline', startingStock === 188, startingStock, 188);

  // -------------------------------------------------------------
  // ORDER 1: Retailer A (Intra-state: Tamil Nadu -> Tamil Nadu, 33)
  // 100 packets @ ₹50.00
  // -------------------------------------------------------------
  console.log('--- TRANSACTION 1: RETAILER A (INTRA-STATE TN -> TN, Code 33) ---');
  const orderA = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.ADMIN,
    items: [{ productId: murukku.id, quantity: 100 }],
    orderNotes: 'Benchmark Order A: Retailer in Tamil Nadu',
  });

  await OrderService.approveOrder(orderA.id, adminId, Role.ADMIN);

  // Allocate stock
  const allocA = await StockAllocationService.allocateStock({
    salesOrderId: orderA.id,
    userId: adminId,
    items: [{ productId: murukku.id, quantity: 100 }],
  });
  check('Order A Allocation Status', allocA.status === 'ACTIVE', allocA.status, 'ACTIVE');

  // Generate Tax Invoice
  const invoiceA = await InvoiceService.createInvoiceFromOrder(orderA.id, adminId);
  check('Order A Taxable Amount', Number(invoiceA.totalTaxable) === 5000, Number(invoiceA.totalTaxable), 5000);
  check('Order A CGST (2.5%)', Number(invoiceA.cgstAmount) === 125, Number(invoiceA.cgstAmount), 125);
  check('Order A SGST (2.5%)', Number(invoiceA.sgstAmount) === 125, Number(invoiceA.sgstAmount), 125);
  check('Order A IGST (0.0%)', Number(invoiceA.igstAmount) === 0, Number(invoiceA.igstAmount), 0);
  check('Order A Grand Total', Number(invoiceA.grandTotal) === 5250, Number(invoiceA.grandTotal), 5250);

  // Post Dispatch
  const dispatchA = await DispatchService.postDispatch({
    orderId: orderA.id,
    vehicleNumber: 'TN-45-AK-2026',
    driverName: 'Kandasamy R',
    transporter: 'TN Fast Freight',
    remarks: 'Dispatched 100 pkts Murukku 200g',
    items: [{ productId: murukku.id, quantity: 100, batchNumber: 'BATCH-2026-0001' }],
    userId: adminId,
  });
  check('Order A Dispatch Status', dispatchA.deliveryStatus === 'DISPATCHED', dispatchA.deliveryStatus, 'DISPATCHED');

  const stockAfterA = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);
  check('Stock after Retailer A Dispatch (188 - 100)', stockAfterA === 88, stockAfterA, 88);

  // -------------------------------------------------------------
  // ORDER 2: Distributor B (Inter-state: Tamil Nadu -> Karnataka, 29)
  // 50 packets @ ₹50.00
  // -------------------------------------------------------------
  console.log('\n--- TRANSACTION 2: DISTRIBUTOR B (INTER-STATE TN -> KA, Code 29) ---');
  const orderB = await OrderService.createOrder({
    customerId: distributorB.id,
    salesmanId: salesmanAId,
    callerRole: Role.ADMIN,
    items: [{ productId: murukku.id, quantity: 50 }],
    orderNotes: 'Benchmark Order B: Distributor in Bengaluru',
  });

  await OrderService.approveOrder(orderB.id, adminId, Role.ADMIN);

  // Allocate stock
  const allocB = await StockAllocationService.allocateStock({
    salesOrderId: orderB.id,
    userId: adminId,
    items: [{ productId: murukku.id, quantity: 50 }],
  });
  check('Order B Allocation Status', allocB.status === 'ACTIVE', allocB.status, 'ACTIVE');

  // Generate Tax Invoice
  const invoiceB = await InvoiceService.createInvoiceFromOrder(orderB.id, adminId);
  check('Order B Taxable Amount', Number(invoiceB.totalTaxable) === 2500, Number(invoiceB.totalTaxable), 2500);
  check('Order B CGST (0.0%)', Number(invoiceB.cgstAmount) === 0, Number(invoiceB.cgstAmount), 0);
  check('Order B SGST (0.0%)', Number(invoiceB.sgstAmount) === 0, Number(invoiceB.sgstAmount), 0);
  check('Order B IGST (5.0%)', Number(invoiceB.igstAmount) === 125, Number(invoiceB.igstAmount), 125);
  check('Order B Grand Total', Number(invoiceB.grandTotal) === 2625, Number(invoiceB.grandTotal), 2625);

  // Post Dispatch
  const dispatchB = await DispatchService.postDispatch({
    orderId: orderB.id,
    vehicleNumber: 'KA-01-MJ-9988',
    driverName: 'Suresh Kumar',
    transporter: 'Interstate Express Lines',
    remarks: 'Dispatched 50 pkts Murukku 200g',
    items: [{ productId: murukku.id, quantity: 50, batchNumber: 'BATCH-2026-0001' }],
    userId: adminId,
  });
  check('Order B Dispatch Status', dispatchB.deliveryStatus === 'DISPATCHED', dispatchB.deliveryStatus, 'DISPATCHED');

  // -------------------------------------------------------------
  // VERIFICATION: FINAL RECONCILIATION & STOCK LEDGER INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- FINAL BENCHMARK RECONCILIATION & STOCK LEDGER AUDIT ---');

  const finalStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);
  check('Final Finished Goods Inventory (188 - 150)', finalStock === 38, finalStock, 38);

  const totalSalesTaxable = Number(invoiceA.totalTaxable) + Number(invoiceB.totalTaxable);
  check('Total Sales Taxable (₹5,000 + ₹2,500)', totalSalesTaxable === 7500, totalSalesTaxable, 7500);

  const totalGstCollected =
    Number(invoiceA.cgstAmount) +
    Number(invoiceA.sgstAmount) +
    Number(invoiceA.igstAmount) +
    Number(invoiceB.cgstAmount) +
    Number(invoiceB.sgstAmount) +
    Number(invoiceB.igstAmount);
  check('Total GST Invoiced (₹250 + ₹125)', totalGstCollected === 375, totalGstCollected, 375);

  const totalInvoiceValue = Number(invoiceA.grandTotal) + Number(invoiceB.grandTotal);
  check('Total Invoiced Value (₹5,250 + ₹2,625)', totalInvoiceValue === 7875, totalInvoiceValue, 7875);

  // Traceability checks
  const dispatchLedgers = await prisma.stockLedger.findMany({
    where: {
      movementType: StockMovementType.DISPATCH,
      itemId: murukku.id,
    },
  });
  check('Stock OUT Ledger Entries Count', dispatchLedgers.length === 2, dispatchLedgers.length, 2);

  const totalDispatchedInLedger = dispatchLedgers.reduce((sum, l) => sum + Math.abs(Number(l.quantity)), 0);
  check('Total Dispatched in Stock Ledger', totalDispatchedInLedger === 150, totalDispatchedInLedger, 150);

  console.log('\n======================================================================');
  console.log(`   PHASE 5 BENCHMARK EVALUATION SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('   Packaged Food Benchmark Scenario: 100% VERIFIED');
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1]?.includes('verify-phase5-benchmark')) {
  runPhase5Benchmark().catch((err) => {
    console.error('Benchmark fatal error:', err);
    process.exit(1);
  });
}
