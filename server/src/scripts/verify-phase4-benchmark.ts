import { ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from '../services/inventory.service.js';
import { ProductionOrderService } from '../services/production-order.service.js';
import { ProductionPlanningService } from '../services/production-planning.service.js';
import { MaterialIssueService } from '../services/material-issue.service.js';
import { ProductionExecutionService } from '../services/production-execution.service.js';
import { QualityControlService } from '../services/quality-control.service.js';
import { BatchTraceabilityService } from '../services/batch-traceability.service.js';
import { ProductionService } from '../services/production.service.js';
import { seedDatabase } from './seed.js';

async function runPhase4Benchmark() {
  console.log('\n================================================================================');
  console.log('   NIT TRICHY BENCHMARK: PHASE 4 MANUFACTURING EXECUTION & COSTING (188 PKTS)   ');
  console.log('================================================================================\n');

  // Seed baseline data
  const seed = await seedDatabase(true);
  const adminId = seed.admin.id;
  const supervisorId = seed.supervisor.id;
  const productId = seed.murukkuProduct.id;
  const bomId = seed.murukkuBOM.id;

  console.log('--- 1. INITIAL INVENTORY STATUS ---');
  const flourInitial = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  const oilInitial = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
  const spiceInitial = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  const pouchInitial = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
  const cartonInitial = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id);
  const fgInitial = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, productId);

  console.log(`- Flour: ${flourInitial} kg (@ ₹42/kg)`);
  console.log(`- Oil: ${oilInitial} L (@ ₹140/L)`);
  console.log(`- Spice Mix: ${spiceInitial} kg (@ ₹200/kg)`);
  console.log(`- Pouches: ${pouchInitial} pcs (@ ₹2.50/pc)`);
  console.log(`- Cartons: ${cartonInitial} pcs (@ ₹15.00/pc)`);
  console.log(`- Murukku 200g Opening Stock: ${fgInitial} packets\n`);

  console.log('--- 2. PRODUCTION ORDER PLANNING & IMMUTABLE BOM SNAPSHOT ---');
  const order = await ProductionOrderService.createOrder({
    productId,
    bomId,
    plannedOutputQuantity: 200,
    supervisorId,
    notes: 'NIT Trichy Benchmark Production Run - Murukku 200g (200 pkts)',
  }, adminId);

  console.log(`- Production Order Created: ${order.orderNumber}`);
  console.log(`- Planned Output: ${order.plannedOutputQuantity} pkts`);
  console.log(`- BOM Version: ${order.bomVersion}`);

  // Material Requirements check
  const reqs = await ProductionPlanningService.calculateMaterialRequirements(bomId, 200);
  console.log('Standard Requirements for 200 packets:');
  for (const item of reqs.items) {
    console.log(`  * ${item.name} (${item.code}): Standard ${item.standardQuantity} ${item.unit} -> Scaled: ${item.scaledQuantity} ${item.unit} (Current: ${item.currentStock}, Shortage: ${item.shortageQuantity})`);
  }

  // Submit and approve order
  await ProductionOrderService.submitOrder(order.id, adminId);
  await ProductionOrderService.approveOrder(order.id, adminId);
  console.log('- Order Submitted and Approved by Admin.');

  // Material Reservations
  await ProductionOrderService.reserveMaterials(order.id, adminId);
  console.log('- Materials Reserved without touching physical stock ledger.\n');

  console.log('--- 3. MATERIAL ISSUE & FIFO DEPLETION ---');
  const issue = await MaterialIssueService.createMaterialIssue({
    productionOrderId: order.id,
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
        issuedQuantity: 10.5, // Benchmark actual: 10.5L (+5% overconsumption)
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
        issuedQuantity: 194, // Benchmark actual: 194 pcs used
        unit: 'pcs',
      },
      {
        itemType: ItemType.PACKAGING,
        packagingMaterialId: seed.cartonPkg.id,
        requestedQuantity: 8,
        issuedQuantity: 9, // Benchmark actual: 9 cartons used
        unit: 'pcs',
      },
    ],
    userId: supervisorId,
  });

  console.log(`- Material Issue Created: ${issue.issueNumber}`);
  let totalRMCost = 0;
  let totalPMCost = 0;

  for (const it of issue.items) {
    const cost = Number(it.totalCost);
    const rate = Number(it.unitCost);
    if (it.itemType === ItemType.RAW_MATERIAL) totalRMCost += cost;
    if (it.itemType === ItemType.PACKAGING) totalPMCost += cost;
    console.log(`  * Issued ${it.issuedQuantity} ${it.unit} @ ₹${rate}/${it.unit} = ₹${cost.toFixed(2)}`);
  }

  console.log(`\n- Raw Material Subtotal: ₹${totalRMCost.toFixed(2)} (Expected: ₹3,390.00)`);
  console.log(`- Packaging Material Subtotal: ₹${totalPMCost.toFixed(2)} (Expected: ₹620.00)`);
  console.log(`- Total Material Cost: ₹${(totalRMCost + totalPMCost).toFixed(2)} (Expected: ₹4,010.00)\n`);

  console.log('--- 4. PRODUCTION EXECUTION ---');
  const execution = await ProductionExecutionService.startExecution({
    productionOrderId: order.id,
    lineOrWorkstation: 'Line 1 - Frying & Packing',
    userId: supervisorId,
  });
  console.log(`- Batch Started: ${execution.batchNumber} (Status: ${execution.status})\n`);

  console.log('--- 5. PRODUCTION OUTPUT, YIELD & COSTING ---');
  // Planned: 200, Actual: 188 good, 6 damaged pouches, 6 rejected burnt
  const outputResult = await ProductionExecutionService.postProductionOutput({
    productionOrderId: order.id,
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

  console.log(`- Good Packets Produced: ${outputResult.productionOutput.goodPackets}`);
  console.log(`- Damaged Packets (Pouches): ${outputResult.productionOutput.damagedPackets}`);
  console.log(`- Rejected Packets (Burnt): ${outputResult.productionOutput.rejectedPackets}`);
  console.log(`- Production Loss: ${outputResult.productionLoss} packets`);
  console.log(`- Actual Yield: ${outputResult.yieldPercentage}% (Expected: 94.0%)`);
  console.log(`- Actual Production Loss: ${outputResult.lossPercentage}% (Expected: 6.0%)`);
  console.log(`- Labour + Power + Other Overheads: ₹500.00`);
  console.log(`- Total Production Cost: ₹${outputResult.totalProductionCost.toFixed(2)} (Expected: ₹4,510.00)`);
  console.log(`- Cost Per Packet: ₹${outputResult.costPerPacket.toFixed(2)} (Expected: ₹23.99)\n`);

  console.log('--- 6. QUALITY CONTROL INSPECTION ---');
  const qc = await QualityControlService.recordInspection({
    batchNumber: execution.batchNumber,
    productionOrderId: order.id,
    productId,
    inspectedQuantity: 188,
    acceptedQuantity: 188,
    rejectedQuantity: 0,
    qualityStatus: 'PASSED',
    weightConsistency: '199.5g - 201.2g (Within ±2g specification)',
    packagingCondition: 'Hermetically sealed, nitrogen flushed',
    appearance: 'Crisp spiral ring, golden yellow',
    notes: 'NIT Trichy Batch QA Approved',
    inspectorId: supervisorId,
  });
  console.log(`- Quality Certificate: ${qc.inspectionNumber} -> Status: ${qc.qualityStatus}\n`);

  console.log('--- 7. END-TO-END BATCH TRACEABILITY ---');
  const trace = await BatchTraceabilityService.traceBatch(execution.batchNumber);
  console.log(`- Batch: ${trace.batchNumber}`);
  console.log(`- Product: ${trace.product.name} (SKU: ${trace.product.sku})`);
  console.log(`- Production Order: ${trace.productionOrder.orderNumber}`);
  console.log(`- Total Material Issues: ${trace.materialIssues.length}`);
  console.log(`- Total FG Outputs: ${trace.productionOutputs.length} (Good: ${trace.productionOutputs[0].goodPackets})`);
  console.log(`- Quality Status: ${trace.qualityInspections[0].qualityStatus}`);
  console.log(`- Actual Cost Breakdown: RM ₹${trace.costAnalysis.rawMaterialCost}, PM ₹${trace.costAnalysis.packagingCost}, Overheads ₹${trace.costAnalysis.overheadsTotal}`);
  console.log(`- Unit Cost per Good Packet: ₹${trace.costAnalysis.costPerPacket}\n`);

  console.log('--- 8. NUMERICAL VERIFICATION AUDIT ---');
  const checks = [
    { name: 'Raw Material Cost == ₹3,390.00', pass: totalRMCost === 3390, actual: `₹${totalRMCost}` },
    { name: 'Packaging Material Cost == ₹620.00', pass: totalPMCost === 620, actual: `₹${totalPMCost}` },
    { name: 'Total Production Cost == ₹4,510.00', pass: outputResult.totalProductionCost === 4510, actual: `₹${outputResult.totalProductionCost}` },
    { name: 'Yield Percentage == 94.0%', pass: outputResult.yieldPercentage === 94.0, actual: `${outputResult.yieldPercentage}%` },
    { name: 'Production Loss Percentage == 6.0%', pass: outputResult.lossPercentage === 6.0, actual: `${outputResult.lossPercentage}%` },
    { name: 'Cost Per Good Packet == ₹23.99', pass: outputResult.costPerPacket === 23.99, actual: `₹${outputResult.costPerPacket}` },
    { name: 'Murukku FG Usable Stock Delta == +188 pkts', pass: (await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, productId)) === fgInitial + 188, actual: `+${(await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, productId)) - fgInitial}` },
    { name: 'Oil Consumption Variance == +5.0% (Exceeds tolerance)', pass: ProductionService.calculateVariance(10.5, 10.0, 3.0).variancePercent === 5.0, actual: `+5.0%` },
    { name: 'Flour Consumption Variance == 0.0% (Within tolerance)', pass: ProductionService.calculateVariance(40, 40, 3.0).variancePercent === 0.0, actual: `0.0%` },
    { name: 'Quality Inspection Status == PASSED', pass: qc.qualityStatus === 'PASSED', actual: qc.qualityStatus },
    { name: 'End-to-End Batch Traceability Verified', pass: Boolean(trace.productionOrder && trace.materialIssues.length > 0 && trace.qualityInspections.length > 0), actual: 'Complete Graph Verified' },
  ];

  let passedAll = true;
  for (const c of checks) {
    if (c.pass) {
      console.log(`  [PASS] ${c.name} (Actual: ${c.actual})`);
    } else {
      passedAll = false;
      console.error(`  [FAIL] ${c.name} (Actual: ${c.actual})`);
    }
  }

  console.log('\n================================================================================');
  if (passedAll) {
    console.log('   NIT TRICHY BENCHMARK PHASE 4: ALL 11 CHECKS VERIFIED WITH 100% PRECISION     ');
    console.log('================================================================================\n');
  } else {
    console.error('   NIT TRICHY BENCHMARK PHASE 4: VERIFICATION FAILED                             ');
    console.log('================================================================================\n');
    process.exit(1);
  }
}

runPhase4Benchmark()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[BENCHMARK ERROR]', err);
    process.exit(1);
  });
