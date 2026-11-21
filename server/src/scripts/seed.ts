import bcrypt from 'bcryptjs';
import { Prisma, Role, CustomerType, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from '../services/inventory.service.js';

export async function seedDatabase(isReset = true) {
  console.log('[Seed] Starting FactoryFlow Benchmark Database Seed...');

  if (isReset) {
    console.log('[Seed] Cleaning existing data...');
    // Delete in reverse dependency order
    await prisma.auditLog.deleteMany();
    await prisma.paymentAllocation.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.creditNote.deleteMany();
    await prisma.dispatchItem.deleteMany();
    await prisma.dispatch.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.salesOrderItem.deleteMany();
    await prisma.salesOrder.deleteMany();
    await prisma.productionConsumption.deleteMany();
    await prisma.productionRun.deleteMany();
    await prisma.goodsReceiptItem.deleteMany();
    await prisma.goodsReceipt.deleteMany();
    await prisma.purchaseItem.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.stockAdjustment.deleteMany();
    await prisma.openingStockRecord.deleteMany();
    await prisma.inventoryBalance.deleteMany();
    await prisma.stockLedger.deleteMany();
    await prisma.inventoryValuationLayer.deleteMany();
    await prisma.bOMItem.deleteMany();
    await prisma.bOM.deleteMany();
    await prisma.product.deleteMany();
    await prisma.productCategory.deleteMany();
    await prisma.rawMaterial.deleteMany();
    await prisma.packagingMaterial.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.user.deleteMany();
  }

  // 1. Create Seed Users
  console.log('[Seed] Creating demo users for all 5 roles...');
  const passwordHash = await bcrypt.hash('Password@123', 10);
  const salesPasswordHash = await bcrypt.hash('Sales@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const supPasswordHash = await bcrypt.hash('Supervisor@123', 10);
  const auditPasswordHash = await bcrypt.hash('Auditor@123', 10);
  const ownerPasswordHash = await bcrypt.hash('Owner@123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@factoryflow.in',
      passwordHash: adminPasswordHash,
      fullName: 'Ramesh Kumar (Factory Admin)',
      role: Role.ADMIN,
      phone: '+91 94431 10001',
    },
  });

  const salesmanA = await prisma.user.create({
    data: {
      email: 'salesman_a@factoryflow.in',
      passwordHash: salesPasswordHash,
      fullName: 'Senthil Nathan (Salesman A)',
      role: Role.SALESMAN,
      phone: '+91 94431 10002',
    },
  });

  const salesmanB = await prisma.user.create({
    data: {
      email: 'salesman_b@factoryflow.in',
      passwordHash: salesPasswordHash,
      fullName: 'Vijay Anand (Salesman B)',
      role: Role.SALESMAN,
      phone: '+91 94431 10003',
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      email: 'supervisor@factoryflow.in',
      passwordHash: supPasswordHash,
      fullName: 'Murugesan (Production Supervisor)',
      role: Role.PRODUCTION_SUPERVISOR,
      phone: '+91 94431 10004',
    },
  });

  const auditor = await prisma.user.create({
    data: {
      email: 'auditor@factoryflow.in',
      passwordHash: auditPasswordHash,
      fullName: 'Karthik Subramanian (Accountant & Auditor)',
      role: Role.ACCOUNTANT_AUDITOR,
      phone: '+91 94431 10005',
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: 'owner@factoryflow.in',
      passwordHash: ownerPasswordHash,
      fullName: 'Sundaram Pillai (Factory Owner)',
      role: Role.OWNER,
      phone: '+91 94431 10006',
    },
  });

  // 2. Customers
  console.log('[Seed] Creating customers...');
  const retailerA = await prisma.customer.create({
    data: {
      name: 'Retailer A (Sri Krishna Sweets & Snacks)',
      type: CustomerType.RETAILER,
      gstin: '33AAAAA1111A1Z1',
      billingAddress: '14 West Bouleward Road, Tiruchirappalli, Tamil Nadu – 620002',
      shippingAddress: '14 West Bouleward Road, Tiruchirappalli, Tamil Nadu – 620002',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactNumber: '+91 98424 55001',
      email: 'retailer_a@krishnasnacks.com',
      creditLimit: new Prisma.Decimal(50000.0),
      salesmanId: salesmanA.id,
    },
  });

  const distributorB = await prisma.customer.create({
    data: {
      name: 'Distributor B (Cauvery Food Distributors)',
      type: CustomerType.DISTRIBUTOR,
      gstin: '29BBBBB2222B1Z2',
      billingAddress: '88 J.C. Road, Bengaluru, Karnataka – 560002',
      shippingAddress: 'Warehouse 4, Electronic City, Bengaluru, Karnataka – 560100',
      state: 'Karnataka',
      stateCode: '29',
      contactNumber: '+91 98450 66002',
      email: 'distributor_b@cauveryfoods.com',
      creditLimit: new Prisma.Decimal(150000.0),
      salesmanId: salesmanB.id,
    },
  });

  // 3. Suppliers
  console.log('[Seed] Creating suppliers...');
  const supplierGrain = await prisma.supplier.create({
    data: {
      name: 'Sri Annapoorna Agri Mills',
      gstin: '33AAACA3333C1Z3',
      address: 'Industrial Estate, Madurai, Tamil Nadu – 625020',
      contactPerson: 'Periasamy',
      contactNumber: '+91 94422 33441',
      email: 'sales@annapoornamills.com',
    },
  });

  const supplierOil = await prisma.supplier.create({
    data: {
      name: 'Pasumai Agro Oils Ltd.',
      gstin: '33AAACP4444P1Z4',
      address: 'Trichy Main Road, Karur, Tamil Nadu – 639002',
      contactPerson: 'Natarajan',
      contactNumber: '+91 94433 44552',
      email: 'orders@pasumaioils.com',
    },
  });

  const supplierSpice = await prisma.supplier.create({
    data: {
      name: 'South India Spices Corp.',
      gstin: '33AAACS5555S1Z5',
      address: 'Spice Market, Theni, Tamil Nadu – 625531',
      contactPerson: 'Mani',
      contactNumber: '+91 94444 55663',
      email: 'sales@southindiaspices.in',
    },
  });

  const supplierPkg = await prisma.supplier.create({
    data: {
      name: 'Sivakasi Packaging Works',
      gstin: '33AAACT6666T1Z6',
      address: 'Print City Road, Sivakasi, Tamil Nadu – 626123',
      contactPerson: 'Annamalai',
      contactNumber: '+91 94455 66774',
      email: 'contact@sivakasipack.com',
    },
  });

  // 4. Products & Categories
  console.log('[Seed] Creating product categories & products...');
  const snacksCategory = await prisma.productCategory.create({
    data: { name: 'Traditional Savouries', description: 'Authentic South Indian crispy snacks' },
  });

  const murukkuProduct = await prisma.product.create({
    data: {
      sku: 'MRK-200G',
      name: 'Murukku 200 g',
      categoryId: snacksCategory.id,
      packSize: '200 g',
      unit: 'packets',
      sellingPrice: new Prisma.Decimal(50.0),
      gstRate: new Prisma.Decimal(5.0),
      hsnCode: '1905',
      reorderLevel: new Prisma.Decimal(50.0),
      active: true,
    },
  });

  // Extra realistic products for catalog richness
  const mixtureProduct = await prisma.product.create({
    data: {
      sku: 'MIX-250G',
      name: 'Madras Mixture 250 g',
      categoryId: snacksCategory.id,
      packSize: '250 g',
      unit: 'packets',
      sellingPrice: new Prisma.Decimal(65.0),
      gstRate: new Prisma.Decimal(5.0),
      hsnCode: '1905',
      reorderLevel: new Prisma.Decimal(50.0),
      active: true,
    },
  });

  // 5. Raw Materials & Opening Inventory
  console.log('[Seed] Creating raw materials and opening inventory...');
  // Benchmark Raw Materials:
  // - Flour: 100 kg opening @ ₹42/kg
  // - Cooking oil: 30 litres @ ₹140/litre
  // - Spice mix: 5 kg @ ₹200/kg
  const flourRM = await prisma.rawMaterial.create({
    data: {
      code: 'RM-FLOUR',
      name: 'Flour (Rice & Urad Dhal)',
      uom: 'kg',
      openingStock: new Prisma.Decimal(100.0),
      reorderLevel: new Prisma.Decimal(25.0),
      purchasePrice: new Prisma.Decimal(42.0),
    },
  });

  const oilRM = await prisma.rawMaterial.create({
    data: {
      code: 'RM-OIL',
      name: 'Cooking Oil (Groundnut & Sesame Blend)',
      uom: 'litre',
      openingStock: new Prisma.Decimal(30.0),
      reorderLevel: new Prisma.Decimal(10.0),
      purchasePrice: new Prisma.Decimal(140.0),
    },
  });

  const spiceRM = await prisma.rawMaterial.create({
    data: {
      code: 'RM-SPICE',
      name: 'Salt and Spice Mix (Asafoetida, Cumin, Chilli)',
      uom: 'kg',
      openingStock: new Prisma.Decimal(5.0),
      reorderLevel: new Prisma.Decimal(2.0),
      purchasePrice: new Prisma.Decimal(200.0),
    },
  });

  // 6. Packaging Materials & Opening Inventory
  // - Pouches: 500 pieces @ ₹2.50
  // - Cartons: 30 pieces @ ₹15.00
  const pouchPkg = await prisma.packagingMaterial.create({
    data: {
      code: 'PKG-POUCH-200G',
      name: '200 g Printed Food-Grade Pouch',
      uom: 'pieces',
      openingStock: new Prisma.Decimal(500.0),
      purchasePrice: new Prisma.Decimal(2.50),
    },
  });

  const cartonPkg = await prisma.packagingMaterial.create({
    data: {
      code: 'PKG-CARTON-20',
      name: 'Corrugated Master Carton (20 pkts capacity)',
      uom: 'pieces',
      openingStock: new Prisma.Decimal(30.0),
      purchasePrice: new Prisma.Decimal(15.00),
    },
  });

  // 7. Seed Stock Ledgers & FIFO Valuation Layers for Opening Inventory
  console.log('[Seed] Recording opening balances in immutable StockLedger and FIFO layers...');
  const openingDoc = await prisma.openingStockRecord.create({
    data: {
      recordNumber: 'OPN-2026-0001',
      notes: 'Initial NIT Trichy Benchmark Opening Stock Record',
      status: 'POSTED',
      createdById: admin.id,
    },
  });

  // Flour
  await prisma.stockLedger.create({
    data: {
      itemType: ItemType.RAW_MATERIAL,
      itemId: flourRM.id,
      movementType: StockMovementType.OPENING_BALANCE,
      quantity: new Prisma.Decimal(100.0),
      balanceAfter: new Prisma.Decimal(100.0),
      unit: 'kg',
      direction: 'IN',
      unitRate: new Prisma.Decimal(42.0),
      totalValue: new Prisma.Decimal(4200.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
      notes: 'Initial opening stock audit',
      userId: admin.id,
    },
  });
  await prisma.inventoryValuationLayer.create({
    data: {
      itemType: ItemType.RAW_MATERIAL,
      itemId: flourRM.id,
      originalQuantity: new Prisma.Decimal(100.0),
      remainingQuantity: new Prisma.Decimal(100.0),
      unitCost: new Prisma.Decimal(42.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      itemId: flourRM.id,
      itemType: ItemType.RAW_MATERIAL,
      currentQuantity: new Prisma.Decimal(100.0),
      baseUnit: 'kg',
    },
  });

  // Oil
  await prisma.stockLedger.create({
    data: {
      itemType: ItemType.RAW_MATERIAL,
      itemId: oilRM.id,
      movementType: StockMovementType.OPENING_BALANCE,
      quantity: new Prisma.Decimal(30.0),
      balanceAfter: new Prisma.Decimal(30.0),
      unit: 'litre',
      direction: 'IN',
      unitRate: new Prisma.Decimal(140.0),
      totalValue: new Prisma.Decimal(4200.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
      notes: 'Initial opening stock audit',
      userId: admin.id,
    },
  });
  await prisma.inventoryValuationLayer.create({
    data: {
      itemType: ItemType.RAW_MATERIAL,
      itemId: oilRM.id,
      originalQuantity: new Prisma.Decimal(30.0),
      remainingQuantity: new Prisma.Decimal(30.0),
      unitCost: new Prisma.Decimal(140.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      itemId: oilRM.id,
      itemType: ItemType.RAW_MATERIAL,
      currentQuantity: new Prisma.Decimal(30.0),
      baseUnit: 'litre',
    },
  });

  // Spice
  await prisma.stockLedger.create({
    data: {
      itemType: ItemType.RAW_MATERIAL,
      itemId: spiceRM.id,
      movementType: StockMovementType.OPENING_BALANCE,
      quantity: new Prisma.Decimal(5.0),
      balanceAfter: new Prisma.Decimal(5.0),
      unit: 'kg',
      direction: 'IN',
      unitRate: new Prisma.Decimal(200.0),
      totalValue: new Prisma.Decimal(1000.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
      notes: 'Initial opening stock audit',
      userId: admin.id,
    },
  });
  await prisma.inventoryValuationLayer.create({
    data: {
      itemType: ItemType.RAW_MATERIAL,
      itemId: spiceRM.id,
      originalQuantity: new Prisma.Decimal(5.0),
      remainingQuantity: new Prisma.Decimal(5.0),
      unitCost: new Prisma.Decimal(200.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      itemId: spiceRM.id,
      itemType: ItemType.RAW_MATERIAL,
      currentQuantity: new Prisma.Decimal(5.0),
      baseUnit: 'kg',
    },
  });

  // Pouches
  await prisma.stockLedger.create({
    data: {
      itemType: ItemType.PACKAGING,
      itemId: pouchPkg.id,
      movementType: StockMovementType.OPENING_BALANCE,
      quantity: new Prisma.Decimal(500.0),
      balanceAfter: new Prisma.Decimal(500.0),
      unit: 'pieces',
      direction: 'IN',
      unitRate: new Prisma.Decimal(2.50),
      totalValue: new Prisma.Decimal(1250.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
      notes: 'Initial opening stock audit',
      userId: admin.id,
    },
  });
  await prisma.inventoryValuationLayer.create({
    data: {
      itemType: ItemType.PACKAGING,
      itemId: pouchPkg.id,
      originalQuantity: new Prisma.Decimal(500.0),
      remainingQuantity: new Prisma.Decimal(500.0),
      unitCost: new Prisma.Decimal(2.50),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      itemId: pouchPkg.id,
      itemType: ItemType.PACKAGING,
      currentQuantity: new Prisma.Decimal(500.0),
      baseUnit: 'pieces',
    },
  });

  // Cartons
  await prisma.stockLedger.create({
    data: {
      itemType: ItemType.PACKAGING,
      itemId: cartonPkg.id,
      movementType: StockMovementType.OPENING_BALANCE,
      quantity: new Prisma.Decimal(30.0),
      balanceAfter: new Prisma.Decimal(30.0),
      unit: 'pieces',
      direction: 'IN',
      unitRate: new Prisma.Decimal(15.00),
      totalValue: new Prisma.Decimal(450.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
      notes: 'Initial opening stock audit',
      userId: admin.id,
    },
  });
  await prisma.inventoryValuationLayer.create({
    data: {
      itemType: ItemType.PACKAGING,
      itemId: cartonPkg.id,
      originalQuantity: new Prisma.Decimal(30.0),
      remainingQuantity: new Prisma.Decimal(30.0),
      unitCost: new Prisma.Decimal(15.00),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      itemId: cartonPkg.id,
      itemType: ItemType.PACKAGING,
      currentQuantity: new Prisma.Decimal(30.0),
      baseUnit: 'pieces',
    },
  });

  // Finished Goods Opening: Murukku 200 g: 50 packets
  await prisma.stockLedger.create({
    data: {
      itemType: ItemType.FINISHED_GOOD,
      itemId: murukkuProduct.id,
      movementType: StockMovementType.OPENING_BALANCE,
      quantity: new Prisma.Decimal(50.0),
      balanceAfter: new Prisma.Decimal(50.0),
      unit: 'packets',
      direction: 'IN',
      unitRate: new Prisma.Decimal(30.0),
      totalValue: new Prisma.Decimal(1500.0),
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
      notes: 'Initial opening stock audit (50 packets)',
      userId: admin.id,
    },
  });
  await prisma.inventoryValuationLayer.create({
    data: {
      itemType: ItemType.FINISHED_GOOD,
      itemId: murukkuProduct.id,
      originalQuantity: new Prisma.Decimal(50.0),
      remainingQuantity: new Prisma.Decimal(50.0),
      unitCost: new Prisma.Decimal(30.0), // Nominal opening valuation
      referenceType: 'OPENING',
      referenceId: openingDoc.recordNumber,
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      itemId: murukkuProduct.id,
      itemType: ItemType.FINISHED_GOOD,
      currentQuantity: new Prisma.Decimal(50.0),
      baseUnit: 'packets',
    },
  });

  // 8. Create Benchmark BOM for Murukku 200 g
  // One batch = 200 expected packets
  // - Flour: 40 kg
  // - Cooking oil: 10 litre
  // - Salt & spice mix: 1.2 kg
  // - 200 g pouch: 200 pieces
  // - Carton: 10 pieces
  console.log('[Seed] Creating Benchmark BOM for Murukku 200 g...');
  const bom = await prisma.bOM.create({
    data: {
      productId: murukkuProduct.id,
      name: 'Standard Murukku 200g Recipe',
      version: 'v1.0',
      batchSize: new Prisma.Decimal(200.0),
      batchUnit: 'packets',
      expectedYield: new Prisma.Decimal(200.0),
      yieldUnit: 'packets',
      effectiveDate: new Date(),
      active: true,
      notes: 'Standard benchmark production recipe: 200 packets per batch',
      items: {
        create: [
          {
            itemType: ItemType.RAW_MATERIAL,
            rawMaterialId: flourRM.id,
            standardQuantity: new Prisma.Decimal(40.0),
            unit: 'kg',
          },
          {
            itemType: ItemType.RAW_MATERIAL,
            rawMaterialId: oilRM.id,
            standardQuantity: new Prisma.Decimal(10.0),
            unit: 'litre',
          },
          {
            itemType: ItemType.RAW_MATERIAL,
            rawMaterialId: spiceRM.id,
            standardQuantity: new Prisma.Decimal(1.2),
            unit: 'kg',
          },
          {
            itemType: ItemType.PACKAGING,
            packagingMaterialId: pouchPkg.id,
            standardQuantity: new Prisma.Decimal(200.0),
            unit: 'pieces',
          },
          {
            itemType: ItemType.PACKAGING,
            packagingMaterialId: cartonPkg.id,
            standardQuantity: new Prisma.Decimal(10.0),
            unit: 'pieces',
          },
        ],
      },
    },
  });

  console.log('[Seed] Database successfully seeded with benchmark master data and opening balances.');
  return {
    admin,
    salesmanA,
    salesmanB,
    supervisor,
    auditor,
    owner,
    retailerA,
    distributorB,
    flourRM,
    oilRM,
    spiceRM,
    pouchPkg,
    cartonPkg,
    supplierGrain,
    supplierOil,
    supplierSpice,
    supplierPkg,
    murukkuProduct,
    bom,
  };
}

if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase(true).then(() => {
    console.log('[Seed] Finished. Disconnecting client...');
    prisma.$disconnect();
    process.exit(0);
  }).catch((err) => {
    console.error('[Seed Error]', err);
    prisma.$disconnect();
    process.exit(1);
  });
}
