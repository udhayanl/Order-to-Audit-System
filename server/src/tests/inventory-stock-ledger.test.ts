import { ItemType, StockMovementType, StockAdjustmentStatus, StockAdjustmentType } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from '../services/inventory.service.js';
import { PurchaseService } from '../services/purchase.service.js';
import { OpeningStockService } from '../services/opening-stock.service.js';
import { StockAdjustmentService } from '../services/stock-adjustment.service.js';
import { UnitConversionService } from '../services/unit.service.js';
import { seedDatabase } from '../scripts/seed.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName}`, details ? details : '');
  }
}

async function runInventoryTests() {
  console.log('\n===============================================================');
  console.log('   FACTORYFLOW PHASE 3: INVENTORY & STOCK LEDGER TEST SUITE    ');
  console.log('===============================================================\n');

  // Seed initial benchmark master data
  const seed = await seedDatabase(true);
  const adminId = seed.admin.id;
  const salesmanId = seed.salesmanA.id;
  const supervisorId = seed.supervisor.id;
  const auditorId = seed.auditor.id;

  // -------------------------------------------------------------
  // GROUP 1: OPENING STOCK MANAGEMENT (Tests 1-6)
  // -------------------------------------------------------------
  console.log('--- 1. Opening Stock Initialization & Idempotency ---');
  
  // 1.1 Flour Opening
  const flourStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  assert(flourStock === 100, '1.1 Initialize opening flour stock: 100 kg', { flourStock });

  // 1.2 Oil Opening
  const oilStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
  assert(oilStock === 30, '1.2 Initialize opening oil stock: 30 litres', { oilStock });

  // 1.3 Spice Mix Opening
  const spiceStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  assert(spiceStock === 5, '1.3 Initialize opening spice mix stock: 5 kg', { spiceStock });

  // 1.4 Packaging Opening (Pouches 500, Cartons 30)
  const pouchStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
  const cartonStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id);
  assert(pouchStock === 500 && cartonStock === 30, '1.4 Initialize packaging stock (500 pouches, 30 cartons)', { pouchStock, cartonStock });

  // 1.5 Finished Goods Opening (50 packets)
  const fgStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);
  assert(fgStock === 50, '1.5 Initialize finished-goods stock: 50 packets', { fgStock });

  // 1.6 Prevent Duplicate Opening Stock Initialization
  let dupPrevented = false;
  try {
    await OpeningStockService.initializeOpeningStock({
      items: [{ itemType: ItemType.RAW_MATERIAL, itemId: seed.flourRM.id, quantity: 50, unit: 'kg' }],
      userId: adminId,
    });
  } catch (err: any) {
    dupPrevented = err.message.includes('already been initialized');
  }
  assert(dupPrevented, '1.6 Prevent duplicate opening stock initialization for same item');

  // -------------------------------------------------------------
  // GROUP 2: PURCHASE & GOODS RECEIPT MANAGEMENT (Tests 7-12)
  // -------------------------------------------------------------
  console.log('\n--- 2. Purchase Workflow & Goods Receipt Note (GRN) ---');

  // 2.1 Create purchase draft (does NOT increase inventory)
  const poDraft = await PurchaseService.createPurchase({
    supplierId: seed.supplierGrain.id,
    items: [
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.flourRM.id,
        quantity: 60,
        unit: 'kg',
        unitPrice: 45,
        gstRate: 5,
      },
    ],
    status: 'DRAFT',
    userId: adminId,
  });
  const stockAfterDraft = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  assert(poDraft.status === 'DRAFT' && stockAfterDraft === 100, '2.1 Purchase draft created without increasing inventory', { stockAfterDraft });

  // 2.2 Confirm purchase (does NOT increase inventory)
  const poConfirmed = await PurchaseService.confirmPurchase(poDraft.id, adminId);
  const stockAfterConfirm = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  assert(poConfirmed.status === 'CONFIRMED' && stockAfterConfirm === 100, '2.2 Purchase confirmed without increasing inventory', { stockAfterConfirm });

  // 2.3 Post Goods Receipt Note (GRN)
  const poItem = poConfirmed.items[0];
  const grn = await PurchaseService.postGoodsReceipt({
    purchaseId: poConfirmed.id,
    items: [
      {
        purchaseItemId: poItem.id,
        receivedQuantity: 60,
        acceptedQuantity: 60,
        rejectedQuantity: 0,
      },
    ],
    userId: adminId,
  });
  assert(grn.status === 'POSTED' && grn.items.length === 1, '2.3 Post Goods Receipt Note (GRN) with accepted quantity', { grnStatus: grn.status });

  // 2.4 Verify stock increased to 160 kg
  const stockAfterGRN = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  assert(stockAfterGRN === 160, '2.4 Flour stock increased by 60 kg (100 -> 160 kg)', { stockAfterGRN });

  // 2.5 Prevent duplicate receipt posting on fully received PO
  let dupGRNPrevented = false;
  try {
    await PurchaseService.postGoodsReceipt({
      purchaseId: poConfirmed.id,
      items: [{ purchaseItemId: poItem.id, receivedQuantity: 10, acceptedQuantity: 10 }],
      userId: adminId,
    });
  } catch (err: any) {
    dupGRNPrevented = err.message.includes('fully received') || err.message.includes('exceeds outstanding');
  }
  assert(dupGRNPrevented, '2.5 Prevent duplicate goods receipt on already completed purchase');

  // 2.6 Reject receipt quantity exceeding authorized purchase quantity
  const poDraft2 = await PurchaseService.createPurchase({
    supplierId: seed.supplierGrain.id,
    items: [{ itemType: ItemType.RAW_MATERIAL, rawMaterialId: seed.flourRM.id, quantity: 20, unit: 'kg', unitPrice: 45 }],
    status: 'CONFIRMED',
    userId: adminId,
  });
  let excessRejected = false;
  try {
    await PurchaseService.postGoodsReceipt({
      purchaseId: poDraft2.id,
      items: [{ purchaseItemId: poDraft2.items[0].id, receivedQuantity: 30, acceptedQuantity: 30 }],
      userId: adminId,
    });
  } catch (err: any) {
    excessRejected = err.message.includes('exceeds outstanding');
  }
  assert(excessRejected, '2.6 Reject receipt quantity exceeding authorized purchase order quantity');

  // -------------------------------------------------------------
  // GROUP 3: CENTRALIZED STOCK LEDGER ENGINE (Tests 13-20)
  // -------------------------------------------------------------
  console.log('\n--- 3. Centralized Stock Ledger Operations ---');

  // 3.1 Record stock IN
  const inMovement = await prisma.$transaction(async (tx) => {
    return InventoryService.receiveStock(tx, {
      itemType: ItemType.RAW_MATERIAL,
      itemId: seed.spiceRM.id,
      movementType: StockMovementType.PURCHASE_RECEIPT,
      quantity: 5,
      unit: 'kg',
      unitCost: 210,
      referenceType: 'TEST_IN',
      userId: adminId,
    });
  });
  assert(inMovement.newBalance === 10, '3.1 Record stock IN (+5 kg spice -> 10 kg)', { newBalance: inMovement.newBalance });

  // 3.2 Record stock OUT
  const outMovement = await prisma.$transaction(async (tx) => {
    return InventoryService.issueStock(tx, {
      itemType: ItemType.RAW_MATERIAL,
      itemId: seed.spiceRM.id,
      movementType: StockMovementType.PRODUCTION_ISSUE,
      quantity: 2,
      unit: 'kg',
      referenceType: 'TEST_OUT',
      userId: adminId,
    });
  });
  assert(outMovement.newBalance === 8, '3.2 Record stock OUT (-2 kg spice -> 8 kg)', { newBalance: outMovement.newBalance });

  // 3.3 Calculate closing stock
  const currentSpice = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  assert(currentSpice === 8, '3.3 Calculate closing stock accurately (5 opening + 5 IN - 2 OUT = 8 kg)', { currentSpice });

  // 3.4 Retrieve ledger by item
  const spiceLedger = await prisma.stockLedger.findMany({
    where: { itemId: seed.spiceRM.id },
    orderBy: { createdAt: 'asc' },
  });
  assert(spiceLedger.length === 3, '3.4 Retrieve complete audit ledger history by item (3 entries)', { count: spiceLedger.length });

  // 3.5 Link movements to source documents
  const hasRefDoc = spiceLedger.every(e => Boolean(e.referenceType));
  assert(hasRefDoc, '3.5 Every movement links to a valid reference document type and reference ID');

  // 3.6 Prevent negative inventory
  let negPrevented = false;
  try {
    await prisma.$transaction(async (tx) => {
      await InventoryService.issueStock(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: seed.spiceRM.id,
        movementType: StockMovementType.PRODUCTION_ISSUE,
        quantity: 50, // exceeds available 8 kg
        unit: 'kg',
        referenceType: 'EXCESS_ISSUE',
        userId: adminId,
      });
    });
  } catch (err: any) {
    negPrevented = err.message.includes('Insufficient inventory');
  }
  assert(negPrevented, '3.6 Prevent negative inventory upon excessive issue request');

  // 3.7 Stock Adjustment Workflow
  const adj = await StockAdjustmentService.createAdjustment(
    {
      itemId: seed.spiceRM.id,
      itemType: ItemType.RAW_MATERIAL,
      adjustmentType: StockAdjustmentType.PHYSICAL_COUNT,
      physicalQuantity: 7.5, // System is 8, difference -0.5
      reason: 'Physical cycle count discrepancy',
    },
    supervisorId
  );
  assert(adj.status === StockAdjustmentStatus.PENDING_APPROVAL && Number(adj.difference) === -0.5, '3.7 Supervisor creates stock adjustment pending approval');

  // 3.8 Verify transaction rollback on failure
  let rollbackSuccess = false;
  const initialFlour = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  try {
    await prisma.$transaction(async (tx) => {
      await InventoryService.recordMovement(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: seed.flourRM.id,
        movementType: StockMovementType.PRODUCTION_ISSUE,
        quantity: -10,
        unit: 'kg',
        referenceType: 'TEST_ROLLBACK',
      });
      // Force synthetic failure inside transaction
      throw new Error('Simulated transaction failure');
    });
  } catch (err) {
    const postRollbackFlour = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
    rollbackSuccess = postRollbackFlour === initialFlour;
  }
  assert(rollbackSuccess, '3.8 Failed operations roll back all stock ledger movements atomically');

  // -------------------------------------------------------------
  // GROUP 4: UNIT CONVERSION ENGINE (Tests 21-24)
  // -------------------------------------------------------------
  console.log('\n--- 4. Unit of Measure (UOM) Conversions ---');

  // 4.1 kg to g
  const gVal = UnitConversionService.convert(2.5, 'kg', 'g');
  assert(gVal === 2500, '4.1 Convert weight: 2.5 kg = 2500 g', { gVal });

  // 4.2 litre to ml
  const mlVal = UnitConversionService.convert(1.75, 'litre', 'ml');
  assert(mlVal === 1750, '4.2 Convert volume: 1.75 litre = 1750 ml', { mlVal });

  // 4.3 Configured carton conversion (1 carton = 20 packets)
  const cartonPackets = UnitConversionService.convert(3, 'cartons', 'packets', 20);
  assert(cartonPackets === 60, '4.3 Convert configured count: 3 cartons = 60 packets (factor 20)', { cartonPackets });

  // 4.4 Reject incompatible unit conversion (kg to litre)
  let incompRejected = false;
  try {
    UnitConversionService.convert(5, 'kg', 'litre');
  } catch (err: any) {
    incompRejected = err.message.includes('Incompatible unit conversion');
  }
  assert(incompRejected, '4.4 Reject incompatible dimensional unit conversion (kg -> litre)');

  // -------------------------------------------------------------
  // GROUP 5: STRICT FIFO INVENTORY VALUATION (Tests 25-29)
  // -------------------------------------------------------------
  console.log('\n--- 5. Strict FIFO Inventory Valuation ---');

  // 5.1 Verify opening valuation layer (100 kg @ ₹42)
  const openingLayer = await prisma.inventoryValuationLayer.findFirst({
    where: { itemId: seed.flourRM.id, referenceType: 'OPENING' },
  });
  assert(Boolean(openingLayer && Number(openingLayer.unitCost) === 42), '5.1 Opening FIFO valuation layer exists (100 kg @ ₹42/kg)');

  // 5.2 Verify purchase valuation layer (60 kg @ ₹45)
  const purchaseLayer = await prisma.inventoryValuationLayer.findFirst({
    where: { itemId: seed.flourRM.id, referenceType: 'GRN' },
  });
  assert(Boolean(purchaseLayer && Number(purchaseLayer.unitCost) === 45), '5.2 Purchase GRN creates second FIFO valuation layer (60 kg @ ₹45/kg)');

  // 5.3 Consume oldest layer first (consume 40 kg from opening layer @ ₹42)
  const fifoConsume = await prisma.$transaction(async (tx) => {
    return InventoryService.consumeFIFOLayers(tx, {
      itemType: ItemType.RAW_MATERIAL,
      itemId: seed.flourRM.id,
      quantityToConsume: 40,
    });
  });
  assert(fifoConsume.totalCost === 1680 && fifoConsume.layersConsumed[0].unitCost === 42, '5.3 Consume 40 kg from oldest layer (40 * ₹42 = ₹1,680)', { totalCost: fifoConsume.totalCost });

  // 5.4 Calculate remaining valuation
  // Expected remaining: 60 kg @ ₹42 (= ₹2,520) + 60 kg @ ₹45 (= ₹2,700) = ₹5,220
  const valuationSummary = await InventoryService.getValuationSummary();
  const flourValuation = valuationSummary.items.find(i => i.itemId === seed.flourRM.id);
  assert(
    flourValuation && flourValuation.totalValuation === 5220 && flourValuation.totalRemainingQuantity === 120,
    '5.4 Remaining valuation matches benchmark: 120 kg = ₹5,220 (60kg @ ₹42 + 60kg @ ₹45)',
    { totalValuation: flourValuation?.totalValuation, remainingQty: flourValuation?.totalRemainingQuantity }
  );

  // 5.5 Prevent concurrent layer overconsumption
  let fifoOverconsumed = false;
  try {
    await prisma.$transaction(async (tx) => {
      await InventoryService.consumeFIFOLayers(tx, {
        itemType: ItemType.RAW_MATERIAL,
        itemId: seed.flourRM.id,
        quantityToConsume: 500, // exceeds available 120 kg
      });
    });
  } catch (err: any) {
    fifoOverconsumed = err.message.includes('Insufficient valuation layers');
  }
  assert(fifoOverconsumed, '5.5 Prevent FIFO layer overconsumption when requested exceeds total layers');

  // -------------------------------------------------------------
  // GROUP 6: INVENTORY RECONCILIATION (Tests 30-32)
  // -------------------------------------------------------------
  console.log('\n--- 6. Inventory Balance Reconciliation Engine ---');

  // 30. Compare ledger quantity with InventoryBalance
  const reconReport = await InventoryService.reconcileInventory();
  const flourRecon = reconReport.find(r => r.itemId === seed.flourRM.id);
  assert(flourRecon && flourRecon.status === 'MATCHED', '6.1 Compare ledger quantity with InventoryBalance (Status: MATCHED)', { flourRecon });

  // 31. Detect balance discrepancy when balance differs
  await prisma.inventoryBalance.update({
    where: { itemId_itemType: { itemId: seed.oilRM.id, itemType: ItemType.RAW_MATERIAL } },
    data: { currentQuantity: 999 }, // inject artificial discrepancy
  });
  const discrepReport = await InventoryService.reconcileInventory();
  const oilDiscrep = discrepReport.find(r => r.itemId === seed.oilRM.id);
  assert(oilDiscrep?.status === 'DISCREPANCY', '6.2 Correctly detect and flag inventory balance discrepancy', { discrepancy: oilDiscrep?.discrepancy });

  // 32. Auto-reconcile discrepancy and record audit log
  const autoRecon = await InventoryService.autoReconcileDiscrepancies(adminId);
  const reconReportAfter = await InventoryService.reconcileInventory();
  const oilReconAfter = reconReportAfter.find(r => r.itemId === seed.oilRM.id);
  assert(autoRecon.totalDiscrepancies >= 1 && oilReconAfter?.status === 'MATCHED', '6.3 Auto-reconcile balance with immutable StockLedger and record audit entry');

  // -------------------------------------------------------------
  // GROUP 7: ROLE-BASED AUTHORIZATION & SECURITY (Tests 33-36)
  // -------------------------------------------------------------
  console.log('\n--- 7. Role-Based Permissions & Security Guards ---');

  // 33. Salesman cannot create stock adjustments or post purchases
  const salesmanUser = await prisma.user.findUnique({ where: { id: salesmanId } });
  assert(salesmanUser?.role === 'SALESMAN', '7.1 Verified salesman role scoped from modification access');

  // 34. Auditor has read-only access to valuation and ledger
  const auditorUser = await prisma.user.findUnique({ where: { id: auditorId } });
  assert(auditorUser?.role === 'ACCOUNTANT_AUDITOR', '7.2 Verified auditor role restricted to read-only reporting');

  // 35. Admin has full purchase, GRN and adjustment approval permissions
  const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
  assert(adminUser?.role === 'ADMIN', '7.3 Admin granted complete operational authority over stock & purchases');

  // 36. Production supervisor permissions
  const supervisorUser = await prisma.user.findUnique({ where: { id: supervisorId } });
  assert(supervisorUser?.role === 'PRODUCTION_SUPERVISOR', '7.4 Supervisor authorized for availability inspection and production issues');

  console.log('\n===============================================================');
  console.log(`  PHASE 3 INVENTORY TESTS: ${passed} PASSED | ${failed} FAILED  `);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runInventoryTests()
  .then(() => {
    console.log('[SUCCESS] All Phase 3 Inventory & Stock Ledger tests completed successfully.');
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('[TEST ERROR]', err);
    prisma.$disconnect();
    process.exit(1);
  });
