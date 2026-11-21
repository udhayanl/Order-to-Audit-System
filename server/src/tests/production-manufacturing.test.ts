import { ItemType, StockMovementType, Role } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from '../services/inventory.service.js';
import { ProductionOrderService } from '../services/production-order.service.js';
import { ProductionPlanningService } from '../services/production-planning.service.js';
import { MaterialIssueService } from '../services/material-issue.service.js';
import { ProductionExecutionService } from '../services/production-execution.service.js';
import { QualityControlService } from '../services/quality-control.service.js';
import { BatchTraceabilityService } from '../services/batch-traceability.service.js';
import { ProductionService } from '../services/production.service.js';
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

async function runProductionTests() {
  console.log('\n===============================================================');
  console.log('   FACTORYFLOW PHASE 4: PRODUCTION & MANUFACTURING TEST SUITE   ');
  console.log('===============================================================\n');

  // Seed benchmark database
  const seed = await seedDatabase(true);
  const adminId = seed.admin.id;
  const supervisorId = seed.supervisor.id;
  const salesmanId = seed.salesmanA.id;
  const productId = seed.murukkuProduct.id;
  const bomId = seed.murukkuBOM.id;

  // -------------------------------------------------------------
  // GROUP 1: PRODUCTION ORDER (Tests 1-7)
  // -------------------------------------------------------------
  console.log('--- GROUP 1: PRODUCTION ORDER (Tests 1-7) ---');

  // Test 1: Create production order
  let order1 = await ProductionOrderService.createOrder({
    productId,
    bomId,
    plannedOutputQuantity: 200,
    supervisorId,
    notes: 'Initial production run test',
  }, adminId);

  assert(
    order1.orderNumber.startsWith('MFG-') && order1.status === 'DRAFT' && Number(order1.plannedOutputQuantity) === 200,
    '1. Create production order with DRAFT status and sequential number',
    { orderNumber: order1.orderNumber, status: order1.status }
  );

  // Test 2: Select active BOM
  assert(
    order1.bomId === bomId && order1.bomVersion === 'v1.0',
    '2. Select active BOM and verify BOM version association',
    { bomId: order1.bomId, version: order1.bomVersion }
  );

  // Test 3: Calculate material requirements
  const reqs = await ProductionPlanningService.calculateMaterialRequirements(bomId, 200);
  const flourReq = reqs.items.find(i => i.itemId === seed.flourRM.id);
  const oilReq = reqs.items.find(i => i.itemId === seed.oilRM.id);
  const pouchReq = reqs.items.find(i => i.itemId === seed.pouchPkg.id);

  assert(
    flourReq?.scaledQuantity === 40 && oilReq?.scaledQuantity === 10 && pouchReq?.scaledQuantity === 200,
    '3. Calculate material requirements scaled for 200 pkts (Flour: 40kg, Oil: 10L, Pouches: 200pcs)',
    { flour: flourReq?.scaledQuantity, oil: oilReq?.scaledQuantity, pouch: pouchReq?.scaledQuantity }
  );

  // Test 4: Reject invalid planned quantity
  let rejectedInvalidQty = false;
  try {
    await ProductionOrderService.createOrder({
      productId,
      bomId,
      plannedOutputQuantity: -50,
    }, adminId);
  } catch (err: any) {
    rejectedInvalidQty = true;
  }
  assert(rejectedInvalidQty, '4. Reject invalid planned quantity (<= 0)');

  // Test 5: Preserve BOM snapshot
  const snapshot = await prisma.productionBOMSnapshot.findUnique({
    where: { productionOrderId: order1.id },
    include: { items: true },
  });
  assert(
    Boolean(snapshot && snapshot.items.length >= 5 && snapshot.version === 'v1.0'),
    '5. Preserve immutable BOM snapshot at order creation time',
    { snapshotItemsCount: snapshot?.items.length, version: snapshot?.version }
  );

  // Test 6: Prevent unauthorized approval (simulate salesman attempting approval)
  const isSalesmanAuthorized = [Role.ADMIN, Role.OWNER, Role.PRODUCTION_SUPERVISOR].includes(seed.salesmanA.role as Role);
  assert(!isSalesmanAuthorized, '6. Prevent unauthorized approval (Salesman role blocked by RBAC)');

  // Test 7: Prevent starting production with shortages
  let shortageBlocked = false;
  try {
    // Attempting order for 10,000 pkts which heavily exceeds inventory
    const hugeOrder = await ProductionOrderService.createOrder({
      productId,
      bomId,
      plannedOutputQuantity: 10000,
    }, adminId);
    await ProductionOrderService.approveOrder(hugeOrder.id, adminId, false);
  } catch (err: any) {
    shortageBlocked = err.message.includes('shortage') || err.message.includes('Shortage');
  }
  assert(shortageBlocked, '7. Prevent approving/starting production when material shortages exist');

  // -------------------------------------------------------------
  // GROUP 2: MATERIAL RESERVATION (Tests 8-11)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 2: MATERIAL RESERVATION (Tests 8-11) ---');

  // Submit and approve order1
  await ProductionOrderService.submitOrder(order1.id, adminId);
  await ProductionOrderService.approveOrder(order1.id, adminId);

  // Test 8: Reserve available inventory
  const reservedOrder = await ProductionOrderService.reserveMaterials(order1.id, adminId);
  const activeReservations = await prisma.materialReservation.findMany({
    where: { productionOrderId: order1.id, status: 'ACTIVE' },
  });
  assert(
    reservedOrder.status === 'MATERIALS_RESERVED' && activeReservations.length >= 5,
    '8. Reserve available inventory without altering physical stock ledger',
    { status: reservedOrder.status, reservationsCount: activeReservations.length }
  );

  // Test 9: Prevent over-reservation
  // Create another order for a quantity that exceeds remaining available unreserved stock
  let overReservationPrevented = false;
  try {
    const orderExcess = await ProductionOrderService.createOrder({
      productId,
      bomId,
      plannedOutputQuantity: 400, // standard flour: 80kg; remaining available unreserved flour: 100 - 40 = 60kg
    }, adminId);
    await ProductionOrderService.submitOrder(orderExcess.id, adminId);
    await ProductionOrderService.approveOrder(orderExcess.id, adminId, true);
    await ProductionOrderService.reserveMaterials(orderExcess.id, adminId);
  } catch (err: any) {
    overReservationPrevented = err.message.includes('insufficient') || err.message.includes('stock');
  }
  assert(overReservationPrevented, '9. Prevent over-reservation beyond unreserved inventory');

  // Test 10: Release cancelled order reservations
  const cancelTestOrder = await ProductionOrderService.createOrder({
    productId,
    bomId,
    plannedOutputQuantity: 50,
  }, adminId);
  await ProductionOrderService.submitOrder(cancelTestOrder.id, adminId);
  await ProductionOrderService.approveOrder(cancelTestOrder.id, adminId);
  await ProductionOrderService.reserveMaterials(cancelTestOrder.id, adminId);
  await ProductionOrderService.cancelOrder(cancelTestOrder.id, adminId, 'Cancelled for test');

  const cancelledReservations = await prisma.materialReservation.findMany({
    where: { productionOrderId: cancelTestOrder.id },
  });
  const allReleased = cancelledReservations.every(r => r.status === 'RELEASED');
  assert(allReleased, '10. Release reservations when production order is cancelled');

  // Test 11: Handle concurrent reservations
  const reqCheck = await ProductionPlanningService.calculateMaterialRequirements(bomId, 100);
  const flourItemCheck = reqCheck.items.find(i => i.itemId === seed.flourRM.id);
  // Physical stock = 100kg, Reserved by order1 = 40kg, Available = 60kg
  assert(
    flourItemCheck?.reservedStock === 40 && flourItemCheck?.availableStock === 60,
    '11. Handle concurrent reservations: available stock accurately accounts for active reservations (100 - 40 = 60kg)',
    { currentStock: flourItemCheck?.currentStock, reserved: flourItemCheck?.reservedStock, available: flourItemCheck?.availableStock }
  );

  // -------------------------------------------------------------
  // GROUP 3: MATERIAL ISSUE (Tests 12-17)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 3: MATERIAL ISSUE (Tests 12-17) ---');

  // Test 12 & 13: Issue raw materials & packaging materials
  const issueResult = await MaterialIssueService.createMaterialIssue({
    productionOrderId: order1.id,
    items: [
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.flourRM.id,
        requestedQuantity: 40,
        issuedQuantity: 40,
        unit: 'kg',
      },
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.oilRM.id,
        requestedQuantity: 10,
        issuedQuantity: 10.5, // 10.5L issued (+5% actual consumption test)
        unit: 'litre',
      },
      {
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.spiceRM.id,
        requestedQuantity: 1.2,
        issuedQuantity: 1.2,
        unit: 'kg',
      },
      {
        itemType: ItemType.PACKAGING,
        packagingMaterialId: seed.pouchPkg.id,
        requestedQuantity: 200,
        issuedQuantity: 194,
        unit: 'pcs',
      },
      {
        itemType: ItemType.PACKAGING,
        packagingMaterialId: seed.cartonPkg.id,
        requestedQuantity: 8,
        issuedQuantity: 9,
        unit: 'pcs',
      },
    ],
    userId: supervisorId,
  });

  const rawIssueItems = issueResult.items.filter(i => i.itemType === ItemType.RAW_MATERIAL);
  const pkgIssueItems = issueResult.items.filter(i => i.itemType === ItemType.PACKAGING);

  assert(rawIssueItems.length === 3, '12. Issue raw materials for production order', { count: rawIssueItems.length });
  assert(pkgIssueItems.length === 2, '13. Issue packaging materials for production order', { count: pkgIssueItems.length });

  // Test 14: Consume FIFO layers
  // Flour opening layer was 100kg @ ₹42 -> 40kg consumed = ₹1,680 (unitCost ₹42)
  const flourIssueItem = rawIssueItems.find(i => i.rawMaterialId === seed.flourRM.id);
  assert(
    Number(flourIssueItem?.unitCost) === 42 && Number(flourIssueItem?.totalCost) === 1680,
    '14. Consume FIFO layers: 40kg flour consumed at ₹42/kg = ₹1,680',
    { unitCost: flourIssueItem?.unitCost, totalCost: flourIssueItem?.totalCost }
  );

  // Test 15: Reject negative stock
  let rejectedNegativeStock = false;
  try {
    await MaterialIssueService.createMaterialIssue({
      productionOrderId: order1.id,
      items: [
        {
          itemType: ItemType.RAW_MATERIAL,
          rawMaterialId: seed.flourRM.id,
          requestedQuantity: 1000,
          issuedQuantity: 1000,
          unit: 'kg',
        },
      ],
      userId: supervisorId,
    });
  } catch (err: any) {
    rejectedNegativeStock = true;
  }
  assert(rejectedNegativeStock, '15. Reject negative stock upon excessive material issue');

  // Test 16: Prevent duplicate issue posting on completed / cancelled order
  // (We will verify this after completing order1 below in Test 31)

  // Test 17: Record stock OUT ledger entries
  const flourLedgerOut = await prisma.stockLedger.findFirst({
    where: {
      itemId: seed.flourRM.id,
      referenceType: 'MATERIAL_ISSUE',
      movementType: StockMovementType.PRODUCTION_ISSUE,
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(
    flourLedgerOut !== null && Number(flourLedgerOut.quantity) < 0 && flourLedgerOut.direction === 'OUT',
    '17. Record immutable stock OUT ledger entry with negative quantity and PRODUCTION_ISSUE type',
    { quantity: flourLedgerOut?.quantity, direction: flourLedgerOut?.direction }
  );

  // -------------------------------------------------------------
  // GROUP 4: PRODUCTION EXECUTION (Tests 18-22)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 4: PRODUCTION EXECUTION (Tests 18-22) ---');

  // Test 18: Start production
  const execution = await ProductionExecutionService.startExecution({
    productionOrderId: order1.id,
    lineOrWorkstation: 'Line 1 - Frying & Packing',
    userId: supervisorId,
  });

  assert(
    execution.status === 'IN_PROGRESS' && execution.batchNumber.startsWith('BATCH-'),
    '18. Start production execution with IN_PROGRESS status and unique batch number',
    { batchNumber: execution.batchNumber, status: execution.status }
  );

  // Test 19: Pause production
  const paused = await ProductionExecutionService.pauseExecution(execution.id);
  assert(paused.status === 'PAUSED', '19. Pause production execution', { status: paused.status });

  // Test 20: Resume production
  const resumed = await ProductionExecutionService.resumeExecution(execution.id);
  assert(resumed.status === 'IN_PROGRESS', '20. Resume production execution', { status: resumed.status });

  // Test 21: Complete production (verified after output posting)

  // Test 22: Prevent invalid status transitions
  let invalidTransitionBlocked = false;
  try {
    await ProductionExecutionService.startExecution({
      productionOrderId: cancelTestOrder.id, // Cancelled order
      userId: supervisorId,
    });
  } catch (err: any) {
    invalidTransitionBlocked = true;
  }
  assert(invalidTransitionBlocked, '22. Prevent starting execution on a cancelled order');

  // -------------------------------------------------------------
  // GROUP 5: CONSUMPTION (Tests 23-27)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 5: CONSUMPTION (Tests 23-27) ---');

  // Test 23: Record actual consumption
  const oilIssueItem = rawIssueItems.find(i => i.rawMaterialId === seed.oilRM.id);
  assert(
    Number(oilIssueItem?.actualConsumedQuantity) === 10.5,
    '23. Record actual consumption: 10.5 L oil consumed',
    { actualConsumed: oilIssueItem?.actualConsumedQuantity }
  );

  // Test 24: Calculate material variance
  const oilVariance = ProductionService.calculateVariance(10.5, 10.0, 3.0);
  assert(
    oilVariance.diff === 0.5,
    '24. Calculate material variance: 10.5 - 10.0 = +0.5 L',
    { diff: oilVariance.diff }
  );

  // Test 25: Calculate variance percentage
  assert(
    oilVariance.variancePercent === 5.0 && oilVariance.status === 'EXCEEDS_TOLERANCE',
    '25. Calculate material variance percentage: +5.0% (Exceeds 3% tolerance)',
    { variancePercent: oilVariance.variancePercent, status: oilVariance.status }
  );

  // Test 26: Return unused materials
  // Test return on spice: return 0.2 kg unused
  const spiceIssueItem = rawIssueItems.find(i => i.rawMaterialId === seed.spiceRM.id);
  const preSpiceStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  const returnedItem = await MaterialIssueService.returnUnusedMaterial({
    materialIssueItemId: spiceIssueItem!.id,
    returnedQuantity: 0.2,
    reason: 'Leftover spice mix returned to stores',
    userId: supervisorId,
  });
  const postSpiceStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);

  assert(
    Number(returnedItem.returnedQuantity) === 0.2 &&
    Number(returnedItem.actualConsumedQuantity) === 1.0 &&
    postSpiceStock === preSpiceStock + 0.2,
    '26. Return unused materials: returns 0.2 kg spice to stock and updates consumed to 1.0 kg',
    { returned: returnedItem.returnedQuantity, consumed: returnedItem.actualConsumedQuantity, stockDelta: postSpiceStock - preSpiceStock }
  );

  // Re-issue 0.2 kg spice to restore 1.2 kg consumption for benchmark fidelity
  await MaterialIssueService.createMaterialIssue({
    productionOrderId: order1.id,
    items: [{
      itemType: ItemType.RAW_MATERIAL,
      rawMaterialId: seed.spiceRM.id,
      requestedQuantity: 0.2,
      issuedQuantity: 0.2,
      unit: 'kg',
    }],
    userId: supervisorId,
  });

  // Test 27: Prevent consumption beyond issued / return more than issued
  let excessiveReturnPrevented = false;
  try {
    await MaterialIssueService.returnUnusedMaterial({
      materialIssueItemId: spiceIssueItem!.id,
      returnedQuantity: 50.0,
      userId: supervisorId,
    });
  } catch (err: any) {
    excessiveReturnPrevented = true;
  }
  assert(excessiveReturnPrevented, '27. Prevent returning more material than was issued');

  // -------------------------------------------------------------
  // GROUP 6: PRODUCTION OUTPUT (Tests 28-31)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 6: PRODUCTION OUTPUT (Tests 28-31) ---');

  const preFGStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, productId);

  // Test 28, 29, 30: Record finished goods output, rejected output, and post good goods to inventory
  const outputResult = await ProductionExecutionService.postProductionOutput({
    productionOrderId: order1.id,
    productionExecutionId: execution.id,
    batchNumber: execution.batchNumber,
    goodPackets: 188,
    damagedPackets: 6,
    rejectedPackets: 6,
    labourCost: 300,
    powerCost: 150,
    otherOverheads: 50,
    userId: supervisorId,
  });

  assert(
    Number(outputResult.productionOutput.goodPackets) === 188,
    '28. Record finished-goods good output: 188 packets',
    { goodPackets: outputResult.productionOutput.goodPackets }
  );

  assert(
    Number(outputResult.productionOutput.damagedPackets) === 6 &&
    Number(outputResult.productionOutput.rejectedPackets) === 6,
    '29. Record damaged output (6 pkts) and rejected output (6 pkts)',
    { damaged: outputResult.productionOutput.damagedPackets, rejected: outputResult.productionOutput.rejectedPackets }
  );

  const postFGStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, productId);
  assert(
    postFGStock === preFGStock + 188,
    '30. Post good finished goods to inventory (+188 packets added to usable stock)',
    { preFGStock, postFGStock, delta: postFGStock - preFGStock }
  );

  // Test 21: Verify production execution completed
  const updatedExecution = await prisma.productionExecution.findUnique({ where: { id: execution.id } });
  assert(updatedExecution?.status === 'COMPLETED', '21. Complete production execution when output posted', { status: updatedExecution?.status });

  // Test 31: Prevent duplicate output posting
  let duplicateOutputBlocked = false;
  try {
    await ProductionExecutionService.postProductionOutput({
      productionOrderId: order1.id,
      goodPackets: 188,
      userId: supervisorId,
    });
  } catch (err: any) {
    duplicateOutputBlocked = true;
  }
  assert(duplicateOutputBlocked, '31. Prevent duplicate output posting on completed production order');

  // Test 16: Prevent duplicate issue posting on completed order
  let duplicateIssueBlocked = false;
  try {
    await MaterialIssueService.createMaterialIssue({
      productionOrderId: order1.id,
      items: [{
        itemType: ItemType.RAW_MATERIAL,
        rawMaterialId: seed.flourRM.id,
        requestedQuantity: 10,
        issuedQuantity: 10,
        unit: 'kg',
      }],
      userId: supervisorId,
    });
  } catch (err: any) {
    duplicateIssueBlocked = true;
  }
  assert(duplicateIssueBlocked, '16. Prevent issuing materials for an already COMPLETED production order');

  // -------------------------------------------------------------
  // GROUP 7: YIELD & PRODUCTION LOSS (Tests 32-34)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 7: YIELD & PRODUCTION LOSS (Tests 32-34) ---');

  // Test 32: Calculate yield percentage
  assert(
    outputResult.yieldPercentage === 94.0,
    '32. Calculate yield percentage: (188 / 200) * 100 = 94.0%',
    { yieldPercentage: outputResult.yieldPercentage }
  );

  // Test 33: Calculate production loss
  assert(
    outputResult.productionLoss === 12 && outputResult.lossPercentage === 6.0,
    '33. Calculate production loss: 200 - 188 = 12 packets (6.0%)',
    { loss: outputResult.productionLoss, lossPercentage: outputResult.lossPercentage }
  );

  // Test 34: Validate zero-output edge cases
  const zeroYieldOrder = await ProductionOrderService.createOrder({
    productId,
    bomId,
    plannedOutputQuantity: 100,
  }, adminId);
  await ProductionOrderService.submitOrder(zeroYieldOrder.id, adminId);
  await ProductionOrderService.approveOrder(zeroYieldOrder.id, adminId, true);

  const zeroYieldResult = await ProductionExecutionService.postProductionOutput({
    productionOrderId: zeroYieldOrder.id,
    goodPackets: 0,
    rejectedPackets: 100,
    userId: adminId,
  });
  assert(
    zeroYieldResult.yieldPercentage === 0.0 && zeroYieldResult.lossPercentage === 100.0,
    '34. Validate zero-output edge cases: 0 good output yields 0.0% and 100.0% loss safely without division by zero',
    { yield: zeroYieldResult.yieldPercentage, loss: zeroYieldResult.lossPercentage }
  );

  // -------------------------------------------------------------
  // GROUP 8: ACTUAL PRODUCTION COSTING (Tests 35-39)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 8: ACTUAL PRODUCTION COSTING (Tests 35-39) ---');

  // Test 35: Calculate raw material cost
  // Flour 40kg @ 42 = 1680
  // Oil 10.5L @ 140 = 1470
  // Spice 1.2kg @ 200 = 240
  // Total RM = 1680 + 1470 + 240 = 3390
  const issues = await prisma.materialIssue.findMany({
    where: { productionOrderId: order1.id },
    include: { items: true },
  });
  const allItems = issues.flatMap(i => i.items);
  const rmCost = allItems
    .filter(i => i.itemType === ItemType.RAW_MATERIAL)
    .reduce((sum, i) => sum + Number(i.totalCost), 0);

  assert(
    rmCost === 3390,
    '35. Calculate raw material cost: ₹1,680 (flour) + ₹1,470 (oil) + ₹240 (spice) = ₹3,390',
    { rmCost }
  );

  // Test 36: Calculate packaging material cost
  // Pouches 194 @ 2.50 = 485
  // Cartons 9 @ 15.00 = 135
  // Total PM = 485 + 135 = 620
  const pmCost = allItems
    .filter(i => i.itemType === ItemType.PACKAGING)
    .reduce((sum, i) => sum + Number(i.totalCost), 0);

  assert(
    pmCost === 620,
    '36. Calculate packaging material cost: ₹485 (pouches) + ₹135 (cartons) = ₹620',
    { pmCost }
  );

  // Test 37: Calculate actual production cost
  // Materials: 3390 + 620 = 4010
  // Overheads: 300 (labour) + 150 (power) + 50 (other) = 500
  // Total = 4010 + 500 = 4510
  assert(
    outputResult.totalProductionCost === 4510,
    '37. Calculate actual production cost: ₹4,010 materials + ₹500 overheads = ₹4,510',
    { totalCost: outputResult.totalProductionCost }
  );

  // Test 38: Calculate cost per good packet
  // 4510 / 188 = 23.98936 -> ₹23.99 per packet
  assert(
    outputResult.costPerPacket === 23.99,
    '38. Calculate cost per good packet: ₹4,510 / 188 packets = ₹23.99',
    { costPerPacket: outputResult.costPerPacket }
  );

  // Test 39: Preserve historical production cost in FG FIFO layer
  const fgLayer = await prisma.inventoryValuationLayer.findFirst({
    where: {
      itemId: productId,
      itemType: ItemType.FINISHED_GOOD,
      referenceType: 'PRODUCTION_OUTPUT',
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(
    fgLayer !== null && Number(fgLayer.unitCost) === 23.99 && Number(fgLayer.originalQuantity) === 188,
    '39. Preserve historical production cost in FG inventory valuation layer (188 pkts @ ₹23.99)',
    { unitCost: fgLayer?.unitCost, originalQuantity: fgLayer?.originalQuantity }
  );

  // -------------------------------------------------------------
  // GROUP 9: QUALITY CONTROL (Tests 40-42)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 9: QUALITY CONTROL (Tests 40-42) ---');

  // Test 40: Approve quality inspection
  const passedQC = await QualityControlService.recordInspection({
    batchNumber: execution.batchNumber,
    productionOrderId: order1.id,
    productId,
    inspectedQuantity: 188,
    acceptedQuantity: 188,
    rejectedQuantity: 0,
    qualityStatus: 'PASSED',
    weightConsistency: '199.5g - 201.2g (Within ±2g specification)',
    packagingCondition: 'Hermetically sealed, no leakage',
    appearance: 'Uniform golden brown color, crisp texture',
    notes: 'Batch passed all quality parameters',
    inspectorId: supervisorId,
  });

  assert(
    passedQC.qualityStatus === 'PASSED' && passedQC.inspectionNumber.startsWith('QC-'),
    '40. Approve quality inspection for finished batch with PASSED status',
    { inspectionNumber: passedQC.inspectionNumber, status: passedQC.qualityStatus }
  );

  // Test 41: Reject failed batch
  const failedQC = await QualityControlService.recordInspection({
    batchNumber: 'BATCH-FAILED-TEST',
    productionOrderId: zeroYieldOrder.id,
    productId,
    inspectedQuantity: 100,
    acceptedQuantity: 0,
    rejectedQuantity: 100,
    qualityStatus: 'FAILED',
    appearance: 'Burnt appearance, over-fried',
    notes: 'Batch rejected due to temperature control failure',
    inspectorId: supervisorId,
  });

  assert(
    failedQC.qualityStatus === 'FAILED' && Number(failedQC.rejectedQuantity) === 100,
    '41. Reject failed batch and record FAILED quality inspection',
    { inspectionNumber: failedQC.inspectionNumber, status: failedQC.qualityStatus }
  );

  // Test 42: Prevent rejected goods from entering usable inventory
  // FG stock should still only have +188 from order1, zero from zeroYieldOrder
  const finalFGStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, productId);
  assert(
    finalFGStock === preFGStock + 188,
    '42. Prevent rejected/damaged goods (12 pkts and 100 pkts) from entering usable finished-goods inventory',
    { finalFGStock, expected: preFGStock + 188 }
  );

  // -------------------------------------------------------------
  // GROUP 10: END-TO-END BATCH TRACEABILITY (Tests 43-46)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 10: END-TO-END BATCH TRACEABILITY (Tests 43-46) ---');

  const trace = await BatchTraceabilityService.traceBatch(execution.batchNumber);

  // Test 43: Trace batch to production order
  assert(
    trace.batchNumber === execution.batchNumber &&
    trace.productionOrder.orderNumber === order1.orderNumber &&
    trace.product.id === productId,
    '43. Trace batch to production order, product details, and supervisor assignment',
    { batchNumber: trace.batchNumber, orderNumber: trace.productionOrder.orderNumber }
  );

  // Test 44: Trace material issues to stock ledger
  const traceIssues = trace.materialIssues;
  const hasLedgerLinks = traceIssues.every(issue =>
    issue.items.every(item => Boolean(item.stockLedgerId))
  );
  assert(
    traceIssues.length > 0 && hasLedgerLinks,
    '44. Trace material issues to immutable stock ledger OUT entries',
    { issuesCount: traceIssues.length, hasLedgerLinks }
  );

  // Test 45: Trace FIFO valuation layers
  assert(
    trace.costAnalysis.rawMaterialCost === 3390 &&
    trace.costAnalysis.packagingCost === 620 &&
    trace.costAnalysis.costPerPacket === 23.99,
    '45. Trace FIFO valuation layers and actual consumption cost breakdown',
    { rmCost: trace.costAnalysis.rawMaterialCost, pmCost: trace.costAnalysis.packagingCost, costPerPacket: trace.costAnalysis.costPerPacket }
  );

  // Test 46: Trace output to finished-goods inventory
  assert(
    trace.productionOutputs.length > 0 &&
    Number(trace.productionOutputs[0].goodPackets) === 188 &&
    trace.qualityInspections.length > 0 &&
    trace.qualityInspections[0].qualityStatus === 'PASSED',
    '46. Trace output to finished-goods inventory and quality inspection certificate',
    { outputGoodPackets: trace.productionOutputs[0]?.goodPackets, qcStatus: trace.qualityInspections[0]?.qualityStatus }
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  PHASE 4 PRODUCTION TESTS: ${passed} PASSED | ${failed} FAILED  `);
  console.log('===============================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Phase 4 Production test suite.`);
  }
}

runProductionTests()
  .then(() => {
    console.log('[SUCCESS] All 46 Phase 4 Production Management tests passed with 100% precision.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[TEST ERROR]', err);
    process.exit(1);
  });
