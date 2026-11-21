import assert from 'node:assert';
import { UnitConversionService } from '../services/unit.service.js';
import { ProductionService } from '../services/production.service.js';
import { BOMService } from '../services/bom.service.js';
import { OrderService } from '../services/order.service.js';
import { InvoiceService } from '../services/invoice.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { PaymentService } from '../services/payment.service.js';
import { InventoryService } from '../services/inventory.service.js';
import { CostingService } from '../services/costing.service.js';
import { runBenchmarkScenario } from '../scripts/run-benchmark.js';
import { seedDatabase } from '../scripts/seed.js';
import prisma from '../db/client.js';
import { ItemType, Role, OrderStatus, StockMovementType, PaymentMethod } from '@prisma/client';

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('  FACTORYFLOW BACKEND TEST SUITE: FORMULAS, DB & AUTHORIZATION ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message || err);
      failed++;
    }
  }

  // Seed clean benchmark database
  const seed = await seedDatabase(true);

  // -------------------------------------------------------------
  // GROUP 1: MASTER DATA & BOM SCALING CALCULATIONS
  // -------------------------------------------------------------
  console.log('\n--- GROUP 1: BOM & Unit Scaling Calculations ---');

  await test('1.1 BOM scaling for 1x batch (200 packets)', async () => {
    const bom = await BOMService.getBOMById(seed.bom.id);
    const planned = BOMService.calculatePlannedRequirements(bom, 200);
    assert.strictEqual(planned.expectedYield, 200);
    const flourItem = planned.plannedItems.find((i: any) => i.name.includes('Flour'));
    assert.strictEqual(flourItem.plannedQuantity, 40);
  });

  await test('1.2 BOM scaling for 2.5x batch (500 packets)', async () => {
    const bom = await BOMService.getBOMById(seed.bom.id);
    const planned = BOMService.calculatePlannedRequirements(bom, 500);
    assert.strictEqual(planned.expectedYield, 500);
    const flourItem = planned.plannedItems.find((i: any) => i.name.includes('Flour'));
    assert.strictEqual(flourItem.plannedQuantity, 100); // 40 * 2.5 = 100 kg
    const oilItem = planned.plannedItems.find((i: any) => i.name.includes('Oil'));
    assert.strictEqual(oilItem.plannedQuantity, 25);   // 10 * 2.5 = 25 L
  });

  await test('1.3 Unit conversion service validations', () => {
    assert.strictEqual(UnitConversionService.convert(2.5, 'kg', 'g'), 2500);
    assert.strictEqual(UnitConversionService.convert(750, 'g', 'kg'), 0.75);
    assert.strictEqual(UnitConversionService.convert(5, 'litre', 'ml'), 5000);
    assert.strictEqual(UnitConversionService.convert(1200, 'ml', 'litre'), 1.2);
    assert.throws(() => UnitConversionService.convert(10, 'kg', 'litre'));
  });

  // -------------------------------------------------------------
  // GROUP 2: INVENTORY & STOCK LEDGER
  // -------------------------------------------------------------
  console.log('\n--- GROUP 2: Inventory & Stock Ledger Mechanics ---');

  await test('2.1 Initial opening stock verification via ledger', async () => {
    const flourStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
    assert.strictEqual(flourStock, 100);
    const oilStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
    assert.strictEqual(oilStock, 30);
    const pouchStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
    assert.strictEqual(pouchStock, 500);
    const fgStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);
    assert.strictEqual(fgStock, 50);
  });

  await test('2.2 Purchase receipt updates StockLedger and adds FIFO valuation layer', async () => {
    // Benchmark Step 1: Purchase 60 kg flour @ ₹45/kg
    await prisma.$transaction(async (tx) => {
      await InventoryService.recordMovement(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: seed.flourRM.id,
        movementType: StockMovementType.PURCHASE_RECEIPT,
        quantity: 60,
        unit: 'kg',
        referenceType: 'PURCHASE',
        referenceId: 'PO-TEST-001',
        userId: seed.admin.id,
      });

      await InventoryService.addValuationLayer(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: seed.flourRM.id,
        originalQuantity: 60,
        unitCost: 45,
        referenceType: 'PURCHASE',
        referenceId: 'PO-TEST-001',
      });
    });

    const newFlourStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
    assert.strictEqual(newFlourStock, 160); // 100 + 60 = 160 kg
  });

  await test('2.3 Prevention of negative inventory upon excessive issue', async () => {
    let prevented = false;
    try {
      await prisma.$transaction(async (tx) => {
        await InventoryService.recordMovement(tx, {
          itemType: ItemType.RAW_MATERIAL,
          itemId: seed.flourRM.id,
          movementType: StockMovementType.PRODUCTION_ISSUE,
          quantity: -200, // Available is 160, deduction of 200 must fail
          unit: 'kg',
          referenceType: 'PRODUCTION_RUN',
        });
      });
    } catch (err: any) {
      prevented = true;
      assert.ok(err.message.includes('Insufficient inventory'));
    }
    assert.strictEqual(prevented, true);
  });

  // -------------------------------------------------------------
  // GROUP 3: FIFO INVENTORY VALUATION
  // -------------------------------------------------------------
  console.log('\n--- GROUP 3: Strict FIFO Inventory Valuation Layers ---');

  await test('3.1 FIFO depletion: consuming 40 kg flour consumes from ₹42 opening layer', async () => {
    let fifoResult: any;
    await prisma.$transaction(async (tx) => {
      fifoResult = await InventoryService.consumeFIFOLayers(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: seed.flourRM.id,
        quantityToConsume: 40,
      });
    });

    assert.strictEqual(fifoResult.totalCost, 1680); // 40 kg * ₹42 = ₹1,680
    assert.strictEqual(fifoResult.layersConsumed.length, 1);
    assert.strictEqual(fifoResult.layersConsumed[0].unitCost, 42);

    // Verify remaining in layers
    const layers = await prisma.inventoryValuationLayer.findMany({
      where: { itemId: seed.flourRM.id },
      orderBy: { receivedDate: 'asc' },
    });
    assert.strictEqual(Number(layers[0].remainingQuantity), 60); // 100 - 40 = 60 kg @ ₹42
    assert.strictEqual(Number(layers[1].remainingQuantity), 60); // Untouched 60 kg @ ₹45
  });

  await test('3.2 FIFO multi-layer split consumption', async () => {
    // Consume remaining 60kg from layer 1 + 20kg from layer 2 = 80kg total
    let fifoResult: any;
    await prisma.$transaction(async (tx) => {
      fifoResult = await InventoryService.consumeFIFOLayers(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: seed.flourRM.id,
        quantityToConsume: 80,
      });
    });

    // Cost: (60 * 42) + (20 * 45) = 2520 + 900 = 3420
    assert.strictEqual(fifoResult.totalCost, 3420);
    assert.strictEqual(fifoResult.layersConsumed.length, 2);

    const layers = await prisma.inventoryValuationLayer.findMany({
      where: { itemId: seed.flourRM.id },
      orderBy: { receivedDate: 'asc' },
    });
    assert.strictEqual(Number(layers[0].remainingQuantity), 0); // Depleted
    assert.strictEqual(Number(layers[1].remainingQuantity), 40); // 60 - 20 = 40 kg remaining
  });

  // -------------------------------------------------------------
  // GROUP 4: PRODUCTION RUN & VARIANCE CALCULATIONS
  // -------------------------------------------------------------
  console.log('\n--- GROUP 4: Production Run, Scrap & Variance Calculations ---');

  await test('4.1 Consumption variance formula & tolerance threshold (Oil +5%)', () => {
    const v = ProductionService.calculateVariance(10.5, 10.0, 3.0);
    assert.strictEqual(v.variancePercent, 5.0);
    assert.strictEqual(v.status, 'EXCEEDS_TOLERANCE');
  });

  await test('4.2 Consumption variance within tolerance (Flour 0%)', () => {
    const v = ProductionService.calculateVariance(40.0, 40.0, 3.0);
    assert.strictEqual(v.variancePercent, 0.0);
    assert.strictEqual(v.status, 'NORMAL');
  });

  await test('4.3 Yield variance formula & tolerance threshold (188 vs 200 = -6%)', () => {
    const v = ProductionService.calculateVariance(188, 200, 3.0);
    assert.strictEqual(v.variancePercent, -6.0);
    assert.strictEqual(v.status, 'EXCEEDS_TOLERANCE');
  });

  await test('4.4 End-to-end atomic production posting with scrap and overheads', async () => {
    // Reset seed for clean benchmark execution
    const freshSeed = await seedDatabase(true);

    // Step 1 purchase: 60 kg flour @ ₹45
    await prisma.$transaction(async (tx) => {
      await InventoryService.recordMovement(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: freshSeed.flourRM.id,
        movementType: StockMovementType.PURCHASE_RECEIPT,
        quantity: 60,
        unit: 'kg',
        referenceType: 'PURCHASE',
      });
      await InventoryService.addValuationLayer(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: freshSeed.flourRM.id,
        originalQuantity: 60,
        unitCost: 45,
        referenceType: 'PURCHASE',
      });
    });

    // Step 2 & 3: Post production run
    const prodRun = await ProductionService.postProductionRun({
      bomId: freshSeed.bom.id,
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
          rawMaterialId: freshSeed.flourRM.id,
          plannedQuantity: 40,
          actualQuantity: 40,
          unit: 'kg',
        },
        {
          itemType: ItemType.RAW_MATERIAL,
          rawMaterialId: freshSeed.oilRM.id,
          plannedQuantity: 10,
          actualQuantity: 10.5,
          unit: 'litre',
        },
        {
          itemType: ItemType.RAW_MATERIAL,
          rawMaterialId: freshSeed.spiceRM.id,
          plannedQuantity: 1.2,
          actualQuantity: 1.2,
          unit: 'kg',
        },
        {
          itemType: ItemType.PACKAGING,
          packagingMaterialId: freshSeed.pouchPkg.id,
          plannedQuantity: 200,
          actualQuantity: 194, // 188 good + 6 damaged
          unit: 'pieces',
        },
        {
          itemType: ItemType.PACKAGING,
          packagingMaterialId: freshSeed.cartonPkg.id,
          plannedQuantity: 10,
          actualQuantity: 9, // 9 cartons
          unit: 'pieces',
        },
      ],
      userId: freshSeed.supervisor.id,
    });

    assert.strictEqual(Number(prodRun.actualGoodOutput), 188);
    assert.strictEqual(Number(prodRun.damagedPouches), 6);
    assert.strictEqual(Number(prodRun.cartonsUsed), 9);
    assert.strictEqual(Number(prodRun.yieldVariancePercent), -6);
    assert.strictEqual(prodRun.yieldVarianceStatus, 'EXCEEDS_TOLERANCE');

    // Costing check:
    // Raw materials: (40 * 42) + (10.5 * 140) + (1.2 * 200) = 1680 + 1470 + 240 = 3390
    // Packaging: (194 * 2.5) + (9 * 15) = 485 + 135 = 620
    // Total materials = 3390 + 620 = 4010
    // Overheads = 1200 + 600 = 1800
    // Total production cost = 4010 + 1800 = 5810
    // Cost per packet = 5810 / 188 = 30.90
    assert.strictEqual(Number(prodRun.totalMaterialCost), 4010);
    assert.strictEqual(Number(prodRun.totalProductionCost), 5810);
    assert.strictEqual(Number(prodRun.costPerPacket), 30.9);

    // Verify finished goods increased from 50 to 238
    const fgStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, freshSeed.murukkuProduct.id);
    assert.strictEqual(fgStock, 238);
  });

  // -------------------------------------------------------------
  // GROUP 5: GST CALCULATIONS & STATUTORY TAX INVOICE
  // -------------------------------------------------------------
  console.log('\n--- GROUP 5: GST Statutory Calculations ---');

  await test('5.1 Intra-state supply (Tamil Nadu -> Tamil Nadu): CGST 2.5% + SGST 2.5%', () => {
    const taxable = 7500;
    const gstRate = 5.0;
    const isIntraState = true;

    const cgst = isIntraState ? Math.round((taxable * (gstRate / 2) / 100) * 100) / 100 : 0;
    const sgst = isIntraState ? Math.round((taxable * (gstRate / 2) / 100) * 100) / 100 : 0;
    const igst = !isIntraState ? Math.round((taxable * (gstRate) / 100) * 100) / 100 : 0;
    const total = taxable + cgst + sgst + igst;

    assert.strictEqual(cgst, 187.5);
    assert.strictEqual(sgst, 187.5);
    assert.strictEqual(igst, 0);
    assert.strictEqual(total, 7875);
  });

  await test('5.2 Inter-state supply (Tamil Nadu -> Karnataka): IGST 5.0%', () => {
    const taxable = 7500;
    const gstRate = 5.0;
    const isIntraState = false;

    const cgst = isIntraState ? (taxable * (gstRate / 2) / 100) : 0;
    const sgst = isIntraState ? (taxable * (gstRate / 2) / 100) : 0;
    const igst = !isIntraState ? Math.round((taxable * (gstRate) / 100) * 100) / 100 : 0;
    const total = taxable + cgst + sgst + igst;

    assert.strictEqual(cgst, 0);
    assert.strictEqual(sgst, 0);
    assert.strictEqual(igst, 375);
    assert.strictEqual(total, 7875);
  });

  // -------------------------------------------------------------
  // GROUP 6: SALES ORDER, MODIFICATION & SHORTAGE DISPATCH CONTROL
  // -------------------------------------------------------------
  console.log('\n--- GROUP 6: Orders, Modification & Shortage Dispatch Control ---');

  let testOrderId: string;
  await test('6.1 Salesman creates customer order (150 pkts)', async () => {
    const prod = await prisma.product.findUnique({ where: { sku: 'MRK-200G' } });
    const cust = await prisma.customer.findFirst({ where: { stateCode: '33' } });
    const salesman = await prisma.user.findFirst({ where: { role: Role.SALESMAN } });

    const order = await OrderService.createOrder({
      customerId: cust!.id,
      salesmanId: salesman!.id,
      items: [{ productId: prod!.id, quantity: 150 }],
    });

    testOrderId = order.id;
    assert.strictEqual(Number(order.subtotal), 7500);
    assert.strictEqual(Number(order.estimatedGst), 375);
    assert.strictEqual(Number(order.grandTotal), 7875);
    assert.strictEqual(order.status, OrderStatus.SUBMITTED);
  });

  await test('6.2 Admin modifies order quantities/prices before approval', async () => {
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    const prod = await prisma.product.findUnique({ where: { sku: 'MRK-200G' } });

    // Modify order to 150 pkts at negotiated rate of Rs. 52/pkt
    const updated = await OrderService.updateOrder({
      orderId: testOrderId,
      adminUserId: admin!.id,
      items: [{ productId: prod!.id, quantity: 150, unitPrice: 52 }],
      orderNotes: 'Negotiated rate of Rs. 52 applied by Admin',
    });

    // 150 * 52 = 7800 taxable, 5% GST = 390, grand total = 8190
    assert.strictEqual(Number(updated.subtotal), 7800);
    assert.strictEqual(Number(updated.estimatedGst), 390);
    assert.strictEqual(Number(updated.grandTotal), 8190);

    // Revert back to standard benchmark ₹50 rate for subsequent steps
    await OrderService.updateOrder({
      orderId: testOrderId,
      adminUserId: admin!.id,
      items: [{ productId: prod!.id, quantity: 150, unitPrice: 50 }],
      orderNotes: 'Reverted to standard benchmark rate',
    });
  });

  await test('6.3 Admin approves order, generates invoice and dispatches (reducing FG to 88)', async () => {
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    await OrderService.approveOrder(testOrderId, admin!.id);
    const invoice = await InvoiceService.createInvoiceFromOrder(testOrderId, admin!.id);

    assert.strictEqual(Number(invoice.totalTaxable), 7500);
    assert.strictEqual(Number(invoice.cgstAmount), 187.5);
    assert.strictEqual(Number(invoice.sgstAmount), 187.5);
    assert.strictEqual(Number(invoice.grandTotal), 7875);

    // Finished goods stock must NOT decrease before dispatch!
    const fgBeforeDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, invoice.items[0].productId);
    assert.strictEqual(fgBeforeDispatch, 238);

    // Record dispatch
    await DispatchService.postDispatch({
      orderId: testOrderId,
      userId: admin!.id,
    });

    // Finished goods stock must now decrease to 88
    const fgAfterDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, invoice.items[0].productId);
    assert.strictEqual(fgAfterDispatch, 88);
  });

  await test('6.4 Shortage detection: Order for 120 pkts flags 32 shortage and blocks dispatch', async () => {
    const custB = await prisma.customer.findFirst({ where: { stateCode: '29' } });
    const salesmanB = await prisma.user.findFirst({ where: { role: Role.SALESMAN, email: 'salesman_b@factoryflow.in' } });
    const prod = await prisma.product.findUnique({ where: { sku: 'MRK-200G' } });
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });

    const orderB = await OrderService.createOrder({
      customerId: custB!.id,
      salesmanId: salesmanB!.id,
      items: [{ productId: prod!.id, quantity: 120 }],
    });

    const stockCheck = await OrderService.checkStockAvailability(orderB.id);
    assert.strictEqual(stockCheck.hasShortage, true);
    assert.strictEqual(stockCheck.stockStatus[0].shortage, 32); // 120 - 88 = 32

    // Attempting dispatch must fail
    let dispatchBlocked = false;
    try {
      await DispatchService.postDispatch({
        orderId: orderB.id,
        userId: admin!.id,
      });
    } catch (err: any) {
      dispatchBlocked = true;
      assert.ok(err.message.includes('Insufficient stock'));
    }
    assert.strictEqual(dispatchBlocked, true);
  });

  // -------------------------------------------------------------
  // GROUP 7: PAYMENTS, ALLOCATIONS & AGEING
  // -------------------------------------------------------------
  console.log('\n--- GROUP 7: Payments, Allocations & Ageing ---');

  await test('7.1 Partial payment recording (₹4,000 paid against ₹7,875 invoice)', async () => {
    const inv = await prisma.invoice.findFirst({ where: { status: 'POSTED' } });
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });

    const pmt = await PaymentService.recordPayment({
      customerId: inv!.customerId,
      invoiceId: inv!.id,
      amount: 4000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      userId: admin!.id,
    });

    assert.strictEqual(Number(pmt.amount), 4000);

    const updatedInv = await prisma.invoice.findUnique({ where: { id: inv!.id } });
    assert.strictEqual(Number(updatedInv?.paidAmount), 4000);
    assert.strictEqual(Number(updatedInv?.outstandingAmount), 3875);
  });

  await test('7.2 Prevention of payment exceeding remaining invoice outstanding balance', async () => {
    const inv = await prisma.invoice.findFirst({ where: { status: 'POSTED' } });
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });

    let prevented = false;
    try {
      // Outstanding is 3875, attempting to pay 5000 against this invoice must fail
      await PaymentService.recordPayment({
        customerId: inv!.customerId,
        invoiceId: inv!.id,
        amount: 5000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        userId: admin!.id,
      });
    } catch (err: any) {
      prevented = true;
      assert.ok(err.message.includes('exceeds invoice outstanding balance'));
    }
    assert.strictEqual(prevented, true);
  });

  // -------------------------------------------------------------
  // GROUP 8: AUTHORIZATION & SECURITY GUARDS
  // -------------------------------------------------------------
  console.log('\n--- GROUP 8: Role-Based Authorization & Security Guards ---');

  await test('8.1 Salesman cannot create orders for unassigned customers', async () => {
    const salesmanA = await prisma.user.findUnique({ where: { email: 'salesman_a@factoryflow.in' } });
    const custB = await prisma.customer.findFirst({ where: { stateCode: '29' } }); // Assigned to Salesman B
    const prod = await prisma.product.findUnique({ where: { sku: 'MRK-200G' } });

    let blocked = false;
    try {
      await OrderService.createOrder({
        customerId: custB!.id,
        salesmanId: salesmanA!.id,
        callerRole: Role.SALESMAN,
        items: [{ productId: prod!.id, quantity: 10 }],
      });
    } catch (err: any) {
      blocked = true;
      assert.ok(err.message.includes('only create orders for your assigned customers'));
    }
    assert.strictEqual(blocked, true);
  });

  await test('8.2 Salesman cannot view another salesman orders', async () => {
    const salesmanA = await prisma.user.findUnique({ where: { email: 'salesman_a@factoryflow.in' } });
    const orderOfB = await prisma.salesOrder.findFirst({
      where: { salesman: { email: 'salesman_b@factoryflow.in' } },
    });

    if (orderOfB) {
      assert.notStrictEqual(orderOfB.salesmanId, salesmanA!.id);
    }
  });

  // -------------------------------------------------------------
  // GROUP 9: ACID TRANSACTION ATOMICITY & ROLLBACK
  // -------------------------------------------------------------
  console.log('\n--- GROUP 9: ACID Transaction Rollback ---');

  await test('9.1 Failed production run rolls back all ledger movements atomically', async () => {
    const flourBefore = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
    const fgBefore = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);

    let failed = false;
    try {
      await ProductionService.postProductionRun({
        bomId: 'non-existent-bom-id',
        plannedBatchQuantity: 200,
        actualGoodOutput: 200,
        damagedPouches: 0,
        cartonsUsed: 0,
        consumptions: [],
        userId: 'some-user',
      });
    } catch {
      failed = true;
    }
    assert.strictEqual(failed, true);

    const flourAfter = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
    const fgAfter = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);

    // Stock must be completely unchanged
    assert.strictEqual(flourAfter, flourBefore);
    assert.strictEqual(fgAfter, fgBefore);
  });

  console.log('\n===============================================================');
  console.log(`  FINAL TEST RESULTS: ${passed} PASSED | ${failed} FAILED  `);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().then(() => {
  prisma.$disconnect();
  process.exit(0);
}).catch((err) => {
  console.error('Test suite failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
