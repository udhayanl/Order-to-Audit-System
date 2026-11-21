import assert from 'node:assert';
import prisma from '../db/client.js';
import { MasterController } from '../controllers/master.controller.js';
import { UnitConversionService } from '../services/unit.service.js';
import { seedDatabase } from '../scripts/seed.js';
import { Role, CustomerType, ItemType } from '@prisma/client';

async function runMasterCrudTests() {
  console.log('\n===============================================================');
  console.log('       FACTORYFLOW PHASE 2: MASTER DATA CRUD TEST SUITE        ');
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

  // Seed baseline
  const seed = await seedDatabase(true);

  // Helper mocks for Express req/res
  const createMockReqRes = (user: any, body: any = {}, params: any = {}, query: any = {}) => {
    let responseData: any = null;
    let statusCode = 200;

    const req: any = { user, body, params, query };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    };
    const next = (err: any) => {
      if (err) throw err;
    };

    return {
      req,
      res,
      next,
      getData: () => responseData,
      getStatus: () => statusCode,
    };
  };

  // --------------------------------------------------------------------------
  // 1. PRODUCT CATEGORIES CRUD
  // --------------------------------------------------------------------------
  console.log('--- 1. Product Categories CRUD & Constraints ---');

  let testCatId = '';
  await test('1.1 Create new product category', async () => {
    const { req, res, next, getData, getStatus } = createMockReqRes(
      seed.admin,
      { name: 'Traditional Sweets', description: 'Fresh ghee and milk sweets' }
    );
    await MasterController.createCategory(req, res, next);
    const data = getData();
    assert.strictEqual(getStatus(), 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.name, 'Traditional Sweets');
    testCatId = data.data.id;
  });

  await test('1.2 Update product category', async () => {
    const { req, res, next, getData } = createMockReqRes(
      seed.admin,
      { description: 'Premium artisanal South Indian sweets' },
      { id: testCatId }
    );
    await MasterController.updateCategory(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.description, 'Premium artisanal South Indian sweets');
  });

  await test('1.3 Delete empty product category (Allowed)', async () => {
    const { req, res, next, getData } = createMockReqRes(
      seed.admin,
      {},
      { id: testCatId }
    );
    await MasterController.deleteCategory(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);
  });

  await test('1.4 Prevent deletion of category with existing products', async () => {
    // Find Traditional Savouries category which has Murukku
    const savouries = await prisma.productCategory.findFirst({ where: { name: 'Traditional Savouries' } });
    assert.ok(savouries);
    const { req, res, next } = createMockReqRes(seed.admin, {}, { id: savouries.id });
    await assert.rejects(
      async () => await MasterController.deleteCategory(req, res, next),
      /Cannot delete category 'Traditional Savouries' as it contains/
    );
  });

  // --------------------------------------------------------------------------
  // 2. PRODUCTS CRUD
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Products CRUD & Reference Protection ---');

  let testProdId = '';
  await test('2.1 Create new product with pack size & selling price', async () => {
    const { req, res, next, getData, getStatus } = createMockReqRes(
      seed.admin,
      {
        sku: 'R-MIX-500',
        name: 'Special Ribbon Pakoda',
        packSize: '500 g',
        unit: 'packets',
        sellingPrice: 120.0,
        gstRate: 5.0,
        hsnCode: '1905',
        reorderLevel: 50,
      }
    );
    await MasterController.createProduct(req, res, next);
    const data = getData();
    assert.strictEqual(getStatus(), 201);
    assert.strictEqual(data.data.sku, 'R-MIX-500');
    assert.strictEqual(Number(data.data.sellingPrice), 120.0);
    testProdId = data.data.id;
  });

  await test('2.2 Update product price and reorder level', async () => {
    const { req, res, next, getData } = createMockReqRes(
      seed.admin,
      { sellingPrice: 125.0, reorderLevel: 60 },
      { id: testProdId }
    );
    await MasterController.updateProduct(req, res, next);
    const data = getData();
    assert.strictEqual(Number(data.data.sellingPrice), 125.0);
    assert.strictEqual(Number(data.data.reorderLevel), 60);
  });

  await test('2.3 Delete unused product (Allowed)', async () => {
    const { req, res, next, getData } = createMockReqRes(seed.admin, {}, { id: testProdId });
    await MasterController.deleteProduct(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);
  });

  await test('2.4 Prevent deletion of benchmark product referenced in BOM', async () => {
    const { req, res, next } = createMockReqRes(seed.admin, {}, { id: seed.murukkuProduct.id });
    await assert.rejects(
      async () => await MasterController.deleteProduct(req, res, next),
      /Cannot delete product 'Murukku 200 g' as it is referenced in transactions/
    );
  });

  // --------------------------------------------------------------------------
  // 3. CUSTOMERS CRUD
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Customers CRUD & Salesman Scoping ---');

  let testCustId = '';
  await test('3.1 Create new customer with GSTIN and credit limit', async () => {
    const { req, res, next, getData, getStatus } = createMockReqRes(
      seed.admin,
      {
        name: 'Kaveri Sweet Stall',
        type: CustomerType.RETAILER,
        gstin: '33AAACK8888M1Z9',
        billingAddress: '14 Gandhi Road, Salem',
        state: 'Tamil Nadu',
        stateCode: '33',
        contactNumber: '+91 94432 99887',
        creditLimit: 25000,
        salesmanId: seed.salesmanA.id,
      }
    );
    await MasterController.createCustomer(req, res, next);
    const data = getData();
    assert.strictEqual(getStatus(), 201);
    assert.strictEqual(data.data.name, 'Kaveri Sweet Stall');
    testCustId = data.data.id;
  });

  await test('3.2 Update customer credit limit and address', async () => {
    const { req, res, next, getData } = createMockReqRes(
      seed.admin,
      { creditLimit: 30000, billingAddress: '14-B Gandhi Road, New Fairlands, Salem' },
      { id: testCustId }
    );
    await MasterController.updateCustomer(req, res, next);
    const data = getData();
    assert.strictEqual(Number(data.data.creditLimit), 30000);
  });

  await test('3.3 Delete unused customer (Allowed)', async () => {
    const { req, res, next, getData } = createMockReqRes(seed.admin, {}, { id: testCustId });
    await MasterController.deleteCustomer(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);
  });

  await test('3.4 Prevent deletion of customer with existing transactions', async () => {
    // Retailer A has orders in benchmark
    const { req, res, next } = createMockReqRes(seed.admin, {}, { id: seed.retailerA.id });
    await prisma.salesOrder.create({
      data: {
        orderNumber: 'SO-TEST-PREVENT-01',
        customerId: seed.retailerA.id,
        salesmanId: seed.salesmanA.id,
        subtotal: 1000,
        estimatedGst: 50,
        grandTotal: 1050,
      },
    });

    await assert.rejects(
      async () => await MasterController.deleteCustomer(req, res, next),
      /Cannot delete customer 'Retailer A/
    );
  });

  // --------------------------------------------------------------------------
  // 4. SUPPLIERS CRUD
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Suppliers CRUD & Purchase Protection ---');

  let testSuppId = '';
  await test('4.1 Create new supplier', async () => {
    const { req, res, next, getData, getStatus } = createMockReqRes(
      seed.admin,
      {
        name: 'Trichy Masala Traders',
        gstin: '33AABCT5555M1ZP',
        address: '5 Rockfort Bazaar, Tiruchirappalli',
        contactPerson: 'K. Balaji',
        contactNumber: '+91 94433 22110',
      }
    );
    await MasterController.createSupplier(req, res, next);
    const data = getData();
    assert.strictEqual(getStatus(), 201);
    assert.strictEqual(data.data.name, 'Trichy Masala Traders');
    testSuppId = data.data.id;
  });

  await test('4.2 Update supplier contact person', async () => {
    const { req, res, next, getData } = createMockReqRes(
      seed.admin,
      { contactPerson: 'K. Balaji (Managing Partner)' },
      { id: testSuppId }
    );
    await MasterController.updateSupplier(req, res, next);
    const data = getData();
    assert.strictEqual(data.data.contactPerson, 'K. Balaji (Managing Partner)');
  });

  await test('4.3 Delete unused supplier (Allowed)', async () => {
    const { req, res, next, getData } = createMockReqRes(seed.admin, {}, { id: testSuppId });
    await MasterController.deleteSupplier(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);
  });

  await test('4.4 Prevent deletion of supplier with recorded purchases', async () => {
    const { req, res, next } = createMockReqRes(seed.admin, {}, { id: seed.supplierGrain.id });
    await prisma.purchase.create({
      data: {
        purchaseNumber: 'PO-TEST-009',
        supplierId: seed.supplierGrain.id,
        totalTaxable: 1000,
        totalGst: 50,
        grandTotal: 1050,
        createdById: seed.admin.id,
      },
    });

    await assert.rejects(
      async () => await MasterController.deleteSupplier(req, res, next),
      /Cannot delete supplier 'Sri Annapoorna Agri Mills' as they have/
    );
  });

  // --------------------------------------------------------------------------
  // 5. RAW MATERIALS & PACKAGING MATERIALS CRUD
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Raw & Packaging Materials CRUD with Opening Balances ---');

  let testRmId = '';
  await test('5.1 Create raw material with opening balance initializes ledger and FIFO layer', async () => {
    const { req, res, next, getData, getStatus } = createMockReqRes(
      seed.admin,
      {
        code: 'RM-SES-01',
        name: 'White Sesame Seeds',
        uom: 'kg',
        openingStock: 25.0,
        reorderLevel: 5.0,
        purchasePrice: 180.0,
      }
    );
    await MasterController.createRawMaterial(req, res, next);
    const data = getData();
    assert.strictEqual(getStatus(), 201);
    testRmId = data.data.id;

    // Verify ledger entry
    const ledger = await prisma.stockLedger.findFirst({
      where: { itemId: testRmId, itemType: ItemType.RAW_MATERIAL },
    });
    assert.ok(ledger);
    assert.strictEqual(Number(ledger.quantity), 25.0);

    // Verify valuation layer
    const layer = await prisma.inventoryValuationLayer.findFirst({
      where: { itemId: testRmId, itemType: ItemType.RAW_MATERIAL },
    });
    assert.ok(layer);
    assert.strictEqual(Number(layer.unitCost), 180.0);
  });

  await test('5.2 Delete unused raw material and clean opening entries', async () => {
    const { req, res, next, getData } = createMockReqRes(seed.admin, {}, { id: testRmId });
    await MasterController.deleteRawMaterial(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);

    const check = await prisma.rawMaterial.findUnique({ where: { id: testRmId } });
    assert.strictEqual(check, null);
  });

  await test('5.3 Prevent deletion of raw material referenced in BOM', async () => {
    const { req, res, next } = createMockReqRes(seed.admin, {}, { id: seed.flourRM.id });
    await assert.rejects(
      async () => await MasterController.deleteRawMaterial(req, res, next),
      /Cannot delete raw material 'Flour/
    );
  });

  // --------------------------------------------------------------------------
  // 6. BILL OF MATERIALS (BOM) CRUD & MULTI-MATERIAL FORMULATIONS
  // --------------------------------------------------------------------------
  console.log('\n--- 6. BOM CRUD, Versions & Formulation Management ---');

  let testBomId = '';
  await test('6.1 Create new BOM recipe with multiple ingredients and packaging', async () => {
    const { req, res, next, getData, getStatus } = createMockReqRes(
      seed.admin,
      {
        productId: seed.murukkuProduct.id,
        name: 'Murukku 200g - Festival Batch Recipe',
        version: 'v2.0',
        batchSize: 400,
        batchUnit: 'packets',
        expectedYield: 400,
        yieldUnit: 'packets',
        notes: 'Special Deepavali high-yield formulation',
        items: [
          { itemType: ItemType.RAW_MATERIAL, rawMaterialId: seed.flourRM.id, standardQuantity: 80, unit: 'kg' },
          { itemType: ItemType.RAW_MATERIAL, rawMaterialId: seed.oilRM.id, standardQuantity: 20, unit: 'litre' },
          { itemType: ItemType.RAW_MATERIAL, rawMaterialId: seed.spiceRM.id, standardQuantity: 2.5, unit: 'kg' },
          { itemType: ItemType.PACKAGING, packagingMaterialId: seed.pouchPkg.id, standardQuantity: 400, unit: 'pieces' },
          { itemType: ItemType.PACKAGING, packagingMaterialId: seed.cartonPkg.id, standardQuantity: 20, unit: 'pieces' },
        ],
      }
    );
    await MasterController.createBOM(req, res, next);
    const data = getData();
    assert.strictEqual(getStatus(), 201);
    assert.strictEqual(data.data.name, 'Murukku 200g - Festival Batch Recipe');
    assert.strictEqual(data.data.items.length, 5);
    testBomId = data.data.id;
  });

  await test('6.2 Update BOM version and notes', async () => {
    const { req, res, next, getData } = createMockReqRes(
      seed.admin,
      { version: 'v2.1', notes: 'Optimized crispness formulation' },
      { id: testBomId }
    );
    await MasterController.updateBOM(req, res, next);
    const data = getData();
    assert.strictEqual(data.data.version, 'v2.1');
    assert.strictEqual(data.data.notes, 'Optimized crispness formulation');
  });

  await test('6.3 Delete unused BOM (Allowed)', async () => {
    const { req, res, next, getData } = createMockReqRes(seed.admin, {}, { id: testBomId });
    await MasterController.deleteBOM(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);
  });

  await test('6.4 Prevent deletion of BOM used in historical production runs', async () => {
    // Create a production run using benchmark BOM
    await prisma.productionRun.create({
      data: {
        runNumber: 'PR-TEST-LOCK-01',
        bomId: seed.bom.id,
        productId: seed.murukkuProduct.id,
        plannedBatchQuantity: 200,
        expectedOutput: 200,
        actualGoodOutput: 190,
        totalProductionCost: 5000,
        costPerPacket: 26.31,
        createdById: seed.supervisor.id,
      },
    });

    const { req, res, next } = createMockReqRes(seed.admin, {}, { id: seed.bom.id });
    await assert.rejects(
      async () => await MasterController.deleteBOM(req, res, next),
      /Cannot delete BOM 'Standard Murukku 200g Recipe' because it has been used in/
    );
  });

  // --------------------------------------------------------------------------
  // 7. UNIT OF MEASURE & CONVERSIONS
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Unit of Measure & Conversions ---');

  await test('7.1 Get supported UOM catalog', async () => {
    const { req, res, next, getData } = createMockReqRes(seed.admin);
    await MasterController.getUOMs(req, res, next);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.units.includes('kg'));
    assert.ok(data.data.units.includes('litre'));
    assert.ok(data.data.units.includes('packets'));
  });

  await test('7.2 Convert valid compatible units (kg -> g, litre -> ml)', async () => {
    const { req, res, next, getData } = createMockReqRes(
      seed.admin,
      { quantity: 4.5, fromUnit: 'kg', toUnit: 'g' }
    );
    await MasterController.convertUOM(req, res, next);
    const data = getData();
    assert.strictEqual(data.data.convertedQuantity, 4500);

    const { req: reqVol, res: resVol, next: nextVol, getData: getVolData } = createMockReqRes(
      seed.admin,
      { quantity: 2.2, fromUnit: 'litre', toUnit: 'ml' }
    );
    await MasterController.convertUOM(reqVol, resVol, nextVol);
    assert.strictEqual(getVolData().data.convertedQuantity, 2200);
  });

  await test('7.3 Reject incompatible unit conversion (kg -> litre)', async () => {
    const { req, res, next } = createMockReqRes(
      seed.admin,
      { quantity: 10, fromUnit: 'kg', toUnit: 'litre' }
    );
    await assert.rejects(
      async () => await MasterController.convertUOM(req, res, next),
      /Incompatible unit conversion/
    );
  });

  console.log('\n===============================================================');
  console.log(`  PHASE 2 MASTER DATA TESTS: ${passed} PASSED | ${failed} FAILED  `);
  console.log('===============================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Master Data test suite.`);
  }
}

runMasterCrudTests()
  .then(() => {
    console.log('[SUCCESS] Phase 2 Master Data Verification completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[ERROR] Phase 2 Test Runner failed:', err);
    process.exit(1);
  });
