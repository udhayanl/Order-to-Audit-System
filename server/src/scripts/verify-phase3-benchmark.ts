import { ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from '../services/inventory.service.js';
import { PurchaseService } from '../services/purchase.service.js';
import { seedDatabase } from './seed.js';

async function runPhase3Benchmark() {
  console.log('\n===============================================================');
  console.log('   NIT TRICHY BENCHMARK: PHASE 3 INVENTORY & STOCK LEDGER      ');
  console.log('===============================================================\n');

  // Seed benchmark opening data
  const seed = await seedDatabase(true);
  const adminId = seed.admin.id;

  console.log('--- INITIAL BENCHMARK OPENING INVENTORY ---');
  const flourOpen = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  const oilOpen = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id);
  const spiceOpen = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id);
  const pouchOpen = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id);
  const cartonOpen = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id);
  const fgOpen = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, seed.murukkuProduct.id);

  console.log(`Flour Opening: ${flourOpen} kg (₹42/kg)`);
  console.log(`Oil Opening: ${oilOpen} L (₹140/L)`);
  console.log(`Spice Opening: ${spiceOpen} kg (₹200/kg)`);
  console.log(`Pouches Opening: ${pouchOpen} pcs (₹2.50/pc)`);
  console.log(`Cartons Opening: ${cartonOpen} pcs (₹15/pc)`);
  console.log(`Finished Murukku 200g Opening: ${fgOpen} packets`);

  console.log('\n--- EXECUTING BENCHMARK PURCHASE: 60 kg Flour @ ₹45/kg ---');
  await PurchaseService.recordPurchase({
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
    userId: adminId,
  });

  const flourPostPurchase = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id);
  const valSummaryPostPurchase = await InventoryService.getValuationSummary();
  const flourValPostPurchase = valSummaryPostPurchase.items.find(i => i.itemId === seed.flourRM.id);

  console.log(`Flour Stock after purchase: ${flourPostPurchase} kg (Expected: 160 kg)`);
  console.log(`Flour Total Valuation: ₹${flourValPostPurchase?.totalValuation} (Expected: ₹6,900)`);

  console.log('\n--- SIMULATING TEST PRODUCTION ISSUE (Rolled Back Simulation) ---');
  // Prompt instruction: "Use a separate test database or fully rolled-back test transaction for this simulation."
  const verificationResults: any[] = [];

  await prisma.$transaction(async (tx) => {
    // Test issue:
    // Flour: 40 kg
    // Oil: 10.5 litres
    // Spice mix: 1.2 kg
    // Pouches: 194 pieces
    // Cartons: 9 pieces
    const flourIssue = await InventoryService.issueStock(tx, {
      itemType: ItemType.RAW_MATERIAL,
      itemId: seed.flourRM.id,
      movementType: StockMovementType.PRODUCTION_ISSUE,
      quantity: 40,
      unit: 'kg',
      referenceType: 'TEST_PRODUCTION_SIM',
      consumeFIFO: true,
      userId: adminId,
    });

    await InventoryService.issueStock(tx, {
      itemType: ItemType.RAW_MATERIAL,
      itemId: seed.oilRM.id,
      movementType: StockMovementType.PRODUCTION_ISSUE,
      quantity: 10.5,
      unit: 'litre',
      referenceType: 'TEST_PRODUCTION_SIM',
      userId: adminId,
    });

    await InventoryService.issueStock(tx, {
      itemType: ItemType.RAW_MATERIAL,
      itemId: seed.spiceRM.id,
      movementType: StockMovementType.PRODUCTION_ISSUE,
      quantity: 1.2,
      unit: 'kg',
      referenceType: 'TEST_PRODUCTION_SIM',
      userId: adminId,
    });

    await InventoryService.issueStock(tx, {
      itemType: ItemType.PACKAGING,
      itemId: seed.pouchPkg.id,
      movementType: StockMovementType.PRODUCTION_ISSUE,
      quantity: 194,
      unit: 'pieces',
      referenceType: 'TEST_PRODUCTION_SIM',
      userId: adminId,
    });

    await InventoryService.issueStock(tx, {
      itemType: ItemType.PACKAGING,
      itemId: seed.cartonPkg.id,
      movementType: StockMovementType.PRODUCTION_ISSUE,
      quantity: 9,
      unit: 'pieces',
      referenceType: 'TEST_PRODUCTION_SIM',
      userId: adminId,
    });

    // Check balances inside the transaction
    const flourBal = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.flourRM.id, tx);
    const oilBal = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.oilRM.id, tx);
    const spiceBal = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, seed.spiceRM.id, tx);
    const pouchBal = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.pouchPkg.id, tx);
    const cartonBal = await InventoryService.getCurrentStock(ItemType.PACKAGING, seed.cartonPkg.id, tx);

    const flourVal = await InventoryService.getValuationSummary(tx);
    const flourValItem = flourVal.items.find(i => i.itemId === seed.flourRM.id);

    verificationResults.push(
      { item: 'Flour Stock (Post-Purchase)', actual: `${flourPostPurchase} kg`, expected: '160 kg', pass: flourPostPurchase === 160 },
      { item: 'Flour Valuation (Post-Purchase)', actual: `₹${flourValPostPurchase?.totalValuation}`, expected: '₹6900', pass: flourValPostPurchase?.totalValuation === 6900 },
      { item: 'Flour Stock (Post-Issue)', actual: `${flourBal} kg`, expected: '120 kg', pass: flourBal === 120 },
      { item: 'Oil Stock (Post-Issue)', actual: `${oilBal} L`, expected: '19.5 L', pass: oilBal === 19.5 },
      { item: 'Spice Mix Stock (Post-Issue)', actual: `${spiceBal} kg`, expected: '3.8 kg', pass: spiceBal === 3.8 },
      { item: 'Pouches Stock (Post-Issue)', actual: `${pouchBal} pcs`, expected: '306 pcs', pass: pouchBal === 306 },
      { item: 'Cartons Stock (Post-Issue)', actual: `${cartonBal} pcs`, expected: '21 pcs', pass: cartonBal === 21 },
      { item: 'FIFO Flour Remaining Value', actual: `₹${flourValItem?.totalValuation}`, expected: '₹5220', pass: flourValItem?.totalValuation === 5220 },
      { item: 'FIFO Layer 1 Consumed', actual: `${flourIssue.fifoResult?.layersConsumed[0].quantity} kg @ ₹${flourIssue.fifoResult?.layersConsumed[0].unitCost}`, expected: '40 kg @ ₹42', pass: flourIssue.fifoResult?.layersConsumed[0].quantity === 40 }
    );

    // Rollback test simulation to leave clean benchmark demonstration state
    throw new Error('ROLLBACK_SIMULATION');
  }).catch((err) => {
    if (err.message !== 'ROLLBACK_SIMULATION') throw err;
  });

  console.log('\n===============================================================');
  console.log('         PHASE 3 BENCHMARK VERIFICATION RESULTS                ');
  console.log('===============================================================');
  console.table(verificationResults);

  const allPassed = verificationResults.every(r => r.pass);
  if (allPassed) {
    console.log('\n>>> ALL PHASE 3 BENCHMARK NUMERICAL VERIFICATIONS PASSED WITH 100% PRECISION! <<<\n');
  } else {
    console.error('\n>>> SOME BENCHMARK CHECKS FAILED! <<<\n');
    process.exit(1);
  }
}

runPhase3Benchmark()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
