import bcrypt from 'bcryptjs';
import { Prisma, Role, CustomerType, ItemType, StockMovementType, OrderStatus, PaymentMethod, VarianceStatus, PaymentStatus } from '@prisma/client';
import prisma from '../db/client.js';

export async function importExtendedDataset() {
  console.log('===============================================================');
  console.log('   IMPORTING COMPREHENSIVE SOUTH INDIAN FOOD ENTERPRISE DATA   ');
  console.log('===============================================================\n');

  // 1. Ensure Roles & Users
  console.log('[Import] 1. Ensuring system demo users...');
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const salesPasswordHash = await bcrypt.hash('Sales@123', 10);
  const supPasswordHash = await bcrypt.hash('Supervisor@123', 10);
  const auditPasswordHash = await bcrypt.hash('Auditor@123', 10);
  const ownerPasswordHash = await bcrypt.hash('Owner@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@factoryflow.in' },
    update: {},
    create: {
      email: 'admin@factoryflow.in',
      passwordHash: adminPasswordHash,
      fullName: 'Ramesh Kumar (Factory Admin)',
      role: Role.ADMIN,
      phone: '+91 94431 10001',
    },
  });

  const salesmanA = await prisma.user.upsert({
    where: { email: 'salesman_a@factoryflow.in' },
    update: {},
    create: {
      email: 'salesman_a@factoryflow.in',
      passwordHash: salesPasswordHash,
      fullName: 'Senthil Nathan (Salesman A - TN Central)',
      role: Role.SALESMAN,
      phone: '+91 94431 10002',
    },
  });

  const salesmanB = await prisma.user.upsert({
    where: { email: 'salesman_b@factoryflow.in' },
    update: {},
    create: {
      email: 'salesman_b@factoryflow.in',
      passwordHash: salesPasswordHash,
      fullName: 'Vijay Anand (Salesman B - Interstate & Southern)',
      role: Role.SALESMAN,
      phone: '+91 94431 10003',
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@factoryflow.in' },
    update: {},
    create: {
      email: 'supervisor@factoryflow.in',
      passwordHash: supPasswordHash,
      fullName: 'Murugesan (Production Supervisor)',
      role: Role.PRODUCTION_SUPERVISOR,
      phone: '+91 94431 10004',
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@factoryflow.in' },
    update: {},
    create: {
      email: 'auditor@factoryflow.in',
      passwordHash: auditPasswordHash,
      fullName: 'Karthik Subramanian (Accountant & Auditor)',
      role: Role.ACCOUNTANT_AUDITOR,
      phone: '+91 94431 10005',
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@factoryflow.in' },
    update: {},
    create: {
      email: 'owner@factoryflow.in',
      passwordHash: ownerPasswordHash,
      fullName: 'Sundaram Pillai (Factory Owner)',
      role: Role.OWNER,
      phone: '+91 94431 10006',
    },
  });

  // 2. Customers
  console.log('[Import] 2. Importing rich Customer Master Registry (10 Retailers & Distributors)...');
  const customersData = [
    {
      name: 'Retailer A (Sri Krishna Sweets & Snacks)',
      type: CustomerType.RETAILER,
      gstin: '33AAAAA1111A1Z1',
      billingAddress: '14 West Bouleward Road, Tiruchirappalli, Tamil Nadu – 620002',
      shippingAddress: '14 West Bouleward Road, Tiruchirappalli, Tamil Nadu – 620002',
      city: 'Tiruchirappalli',
      district: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'K. Balasubramanian',
      contactNumber: '+91 98424 55001',
      email: 'retailer_a@krishnasnacks.com',
      creditLimit: 50000.0,
      paymentTerms: '30 Days',
      salesmanId: salesmanA.id,
    },
    {
      name: 'Distributor B (Cauvery Food Distributors)',
      type: CustomerType.DISTRIBUTOR,
      gstin: '29BBBBB2222B1Z2',
      billingAddress: '88 J.C. Road, Bengaluru, Karnataka – 560002',
      shippingAddress: 'Warehouse 4, Electronic City, Bengaluru, Karnataka – 560100',
      city: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      stateCode: '29',
      contactPerson: 'R. Keshava Murthy',
      contactNumber: '+91 98450 66002',
      email: 'distributor_b@cauveryfoods.com',
      creditLimit: 150000.0,
      paymentTerms: '45 Days',
      salesmanId: salesmanB.id,
    },
    {
      name: 'Grand Sweets & Traditional Snacks',
      type: CustomerType.RETAILER,
      gstin: '33AABCG1234F1Z9',
      billingAddress: '24 2nd Main Road, Gandhi Nagar, Adyar, Chennai, Tamil Nadu – 600020',
      shippingAddress: 'Central Warehouse, Guindy Industrial Estate, Chennai – 600032',
      city: 'Chennai',
      district: 'Chennai',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'S. Ramanathan',
      contactNumber: '+91 94440 12345',
      email: 'procurement@grandsweets.com',
      creditLimit: 120000.0,
      paymentTerms: '30 Days',
      salesmanId: salesmanA.id,
    },
    {
      name: 'Madurai Meenakshi Traditional Mixture Mart',
      type: CustomerType.RETAILER,
      gstin: '33AAACM5678K1ZQ',
      billingAddress: '102 West Tower Street, Madurai, Tamil Nadu – 625001',
      shippingAddress: '102 West Tower Street, Madurai, Tamil Nadu – 625001',
      city: 'Madurai',
      district: 'Madurai',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'P. Muthuvel',
      contactNumber: '+91 98421 88771',
      email: 'orders@meenakshimixture.com',
      creditLimit: 75000.0,
      paymentTerms: '15 Days',
      salesmanId: salesmanA.id,
    },
    {
      name: 'Coimbatore Kongu Agro & Food Mart',
      type: CustomerType.DISTRIBUTOR,
      gstin: '33AAACK9012L1ZS',
      billingAddress: '55 DB Road, RS Puram, Coimbatore, Tamil Nadu – 641002',
      shippingAddress: 'Peelamedu Logistics Park, Coimbatore, Tamil Nadu – 641004',
      city: 'Coimbatore',
      district: 'Coimbatore',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'V. Palanisamy',
      contactNumber: '+91 98940 33445',
      email: 'kongu.agro@gmail.com',
      creditLimit: 200000.0,
      paymentTerms: '45 Days',
      salesmanId: salesmanA.id,
    },
    {
      name: 'Malabar Spices & Traditional Treats',
      type: CustomerType.DISTRIBUTOR,
      gstin: '32AABCM3456M1ZX',
      billingAddress: '18 SM Street, Sweet Meat Street, Kozhikode, Kerala – 673001',
      shippingAddress: 'Beypore Port Road Godown, Kozhikode, Kerala – 673015',
      city: 'Kozhikode',
      district: 'Kozhikode',
      state: 'Kerala',
      stateCode: '32',
      contactPerson: 'Mohammed Ashraf',
      contactNumber: '+91 98470 55112',
      email: 'malabar.treats@keralatraders.in',
      creditLimit: 175000.0,
      paymentTerms: '30 Days',
      salesmanId: salesmanB.id,
    },
    {
      name: 'Deccan Delights Savoury Hub',
      type: CustomerType.DISTRIBUTOR,
      gstin: '36AABCD7890N1Z4',
      billingAddress: '4-1-898 Tilak Road, Abids, Hyderabad, Telangana – 500001',
      shippingAddress: 'Kattedan Industrial Area, Hyderabad, Telangana – 500077',
      city: 'Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      contactPerson: 'N. Venkat Reddy',
      contactNumber: '+91 99890 44221',
      email: 'deccan.delights@hyderabadfoods.com',
      creditLimit: 180000.0,
      paymentTerms: '45 Days',
      salesmanId: salesmanB.id,
    },
    {
      name: 'Tirunelveli Halwa & Mixture Corner',
      type: CustomerType.RETAILER,
      gstin: '33AAACT4567P1Z5',
      billingAddress: '22 Swamy Sannadhi Street, Tirunelveli, Tamil Nadu – 627001',
      shippingAddress: '22 Swamy Sannadhi Street, Tirunelveli, Tamil Nadu – 627001',
      city: 'Tirunelveli',
      district: 'Tirunelveli',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'M. Nellaiappan',
      contactNumber: '+91 94432 77119',
      email: 'nellaifoods@rediffmail.com',
      creditLimit: 60000.0,
      paymentTerms: '21 Days',
      salesmanId: salesmanA.id,
    },
    {
      name: 'Royal Andhra Pickles & Snacks Emporium',
      type: CustomerType.RETAILER,
      gstin: '37AABCR6789Q1Z6',
      billingAddress: '12-4-5 Governorpet, Vijayawada, Andhra Pradesh – 520002',
      shippingAddress: 'Autonagar Phase 2, Vijayawada, Andhra Pradesh – 520007',
      city: 'Vijayawada',
      district: 'NTR',
      state: 'Andhra Pradesh',
      stateCode: '37',
      contactPerson: 'B. Srinivasa Rao',
      contactNumber: '+91 98481 99223',
      email: 'andhrasnacks@royalfoods.in',
      creditLimit: 90000.0,
      paymentTerms: '30 Days',
      salesmanId: salesmanB.id,
    },
    {
      name: 'Salem Crispy Thattai & Murukku Stores',
      type: CustomerType.RETAILER,
      gstin: '33AAACS1234R1Z7',
      billingAddress: '45 Bazaar Street, Shevapet, Salem, Tamil Nadu – 636002',
      shippingAddress: '45 Bazaar Street, Shevapet, Salem, Tamil Nadu – 636002',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'T. Shanmugam',
      contactNumber: '+91 94433 88124',
      email: 'salemthattai@gmail.com',
      creditLimit: 55000.0,
      paymentTerms: '15 Days',
      salesmanId: salesmanA.id,
    },
  ];

  const createdCustomers: any[] = [];
  for (const c of customersData) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (existing) {
      createdCustomers.push(existing);
    } else {
      const created = await prisma.customer.create({
        data: {
          ...c,
          creditLimit: new Prisma.Decimal(c.creditLimit),
        },
      });
      createdCustomers.push(created);
    }
  }

  // 3. Suppliers
  console.log('[Import] 3. Importing verified Supplier Master Directory (8 Suppliers)...');
  const suppliersData = [
    {
      name: 'Sri Annapoorna Agri Mills',
      gstin: '33AAACA3333C1Z3',
      address: 'Industrial Estate, Madurai, Tamil Nadu – 625020',
      city: 'Madurai',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'Periasamy',
      contactNumber: '+91 94422 33441',
      email: 'sales@annapoornamills.com',
      paymentTerms: '30 Days',
    },
    {
      name: 'Pasumai Agro Oils Ltd.',
      gstin: '33AAACP4444P1Z4',
      address: 'Trichy Main Road, Karur, Tamil Nadu – 639002',
      city: 'Karur',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'Natarajan',
      contactNumber: '+91 94433 44552',
      email: 'orders@pasumaioils.com',
      paymentTerms: '30 Days',
    },
    {
      name: 'South India Spices Corp.',
      gstin: '33AAACS5555S1Z5',
      address: 'Spice Market, Theni, Tamil Nadu – 625531',
      city: 'Theni',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'Mani',
      contactNumber: '+91 94444 55663',
      email: 'sales@southindiaspices.in',
      paymentTerms: '15 Days',
    },
    {
      name: 'Sivakasi Packaging Works',
      gstin: '33AAACT6666T1Z6',
      address: 'Print City Road, Sivakasi, Tamil Nadu – 626123',
      city: 'Sivakasi',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'Annamalai',
      contactNumber: '+91 94455 66774',
      email: 'contact@sivakasipack.com',
      paymentTerms: '45 Days',
    },
    {
      name: 'Trichy Paper & Corrugated Box Mills',
      gstin: '33AAACT7777U1Z7',
      address: 'SIDCO Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu – 620015',
      city: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'K. Rajendran',
      contactNumber: '+91 94431 88990',
      email: 'sales@trichypack.in',
      paymentTerms: '30 Days',
    },
    {
      name: 'Malabar Coconut Agro Products',
      gstin: '32AABCM8888V1Z8',
      address: 'Coconut Industrial Park, Vatakara, Kozhikode, Kerala – 673101',
      city: 'Kozhikode',
      state: 'Kerala',
      stateCode: '32',
      contactPerson: 'C. Raghavan',
      contactNumber: '+91 98471 22334',
      email: 'malabar.copra@agromalabar.com',
      paymentTerms: '30 Days',
    },
    {
      name: 'Coimbatore Besan & Dal Processing Ltd.',
      gstin: '33AAACB9999W1Z9',
      address: 'Grain Market Road, Pollachi, Coimbatore, Tamil Nadu – 642001',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'G. Soundararajan',
      contactNumber: '+91 98422 66778',
      email: 'info@kongubesandal.com',
      paymentTerms: '30 Days',
    },
    {
      name: 'Salem Dairy & Ghee Federation',
      gstin: '33AAACS1112X1Z1',
      address: 'Dairy Road, Steel Plant Post, Salem, Tamil Nadu – 636013',
      city: 'Salem',
      state: 'Tamil Nadu',
      stateCode: '33',
      contactPerson: 'Dr. V. Elangovan',
      contactNumber: '+91 94434 55112',
      email: 'salemghee@salemdairy.coop',
      paymentTerms: '15 Days',
    },
  ];

  const createdSuppliers: any[] = [];
  for (const s of suppliersData) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (existing) {
      createdSuppliers.push(existing);
    } else {
      const created = await prisma.supplier.create({ data: s });
      createdSuppliers.push(created);
    }
  }

  // 4. Product Categories & Products
  console.log('[Import] 4. Importing Product Categories & Packaged Food Line-Up (6 Products)...');
  const catSavouries = await prisma.productCategory.upsert({
    where: { name: 'Traditional Savouries' },
    update: {},
    create: { name: 'Traditional Savouries', description: 'Authentic South Indian crispy deep-fried savouries' },
  });

  const catChips = await prisma.productCategory.upsert({
    where: { name: 'Specialty Chips & Crisps' },
    update: {},
    create: { name: 'Specialty Chips & Crisps', description: 'Traditional plantain and root vegetable crisps' },
  });

  const catSweets = await prisma.productCategory.upsert({
    where: { name: 'Sweets & Confectionery' },
    update: {},
    create: { name: 'Sweets & Confectionery', description: 'Traditional South Indian festival sweets and ghee treats' },
  });

  const productsData = [
    {
      sku: 'MRK-200G',
      name: 'Murukku 200 g',
      categoryId: catSavouries.id,
      packSize: '200 g',
      unit: 'packets',
      sellingPrice: 50.0,
      gstRate: 5.0,
      hsnCode: '1905',
      reorderLevel: 50.0,
      active: true,
    },
    {
      sku: 'MIX-250G',
      name: 'Madras Mixture 250 g',
      categoryId: catSavouries.id,
      packSize: '250 g',
      unit: 'packets',
      sellingPrice: 65.0,
      gstRate: 5.0,
      hsnCode: '1905',
      reorderLevel: 50.0,
      active: true,
    },
    {
      sku: 'RIB-200G',
      name: 'Ribbon Pakoda 200 g',
      categoryId: catSavouries.id,
      packSize: '200 g',
      unit: 'packets',
      sellingPrice: 55.0,
      gstRate: 5.0,
      hsnCode: '1905',
      reorderLevel: 40.0,
      active: true,
    },
    {
      sku: 'BND-200G',
      name: 'Kara Boondi 200 g',
      categoryId: catSavouries.id,
      packSize: '200 g',
      unit: 'packets',
      sellingPrice: 48.0,
      gstRate: 5.0,
      hsnCode: '1905',
      reorderLevel: 40.0,
      active: true,
    },
    {
      sku: 'CHP-150G',
      name: 'Kerala Banana Chips 150 g',
      categoryId: catChips.id,
      packSize: '150 g',
      unit: 'packets',
      sellingPrice: 70.0,
      gstRate: 5.0,
      hsnCode: '2008',
      reorderLevel: 30.0,
      active: true,
    },
    {
      sku: 'MSP-250G',
      name: 'Special Ghee Mysore Pak 250 g',
      categoryId: catSweets.id,
      packSize: '250 g',
      unit: 'packets',
      sellingPrice: 120.0,
      gstRate: 5.0,
      hsnCode: '2106',
      reorderLevel: 25.0,
      active: true,
    },
  ];

  const createdProducts: Record<string, any> = {};
  for (const p of productsData) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) {
      createdProducts[p.sku] = existing;
    } else {
      const created = await prisma.product.create({
        data: {
          ...p,
          sellingPrice: new Prisma.Decimal(p.sellingPrice),
          gstRate: new Prisma.Decimal(p.gstRate),
          reorderLevel: new Prisma.Decimal(p.reorderLevel),
        },
      });
      createdProducts[p.sku] = created;
    }
  }

  // 5. Raw Materials & Packaging Materials
  console.log('[Import] 5. Importing Raw Materials & Packaging Materials...');
  const rmData = [
    { code: 'RM-FLOUR', name: 'Flour (Rice & Urad Dhal)', uom: 'kg', openingStock: 100.0, reorderLevel: 25.0, purchasePrice: 42.0 },
    { code: 'RM-BESAN', name: 'Pure Gram Flour (Besan)', uom: 'kg', openingStock: 80.0, reorderLevel: 20.0, purchasePrice: 75.0 },
    { code: 'RM-OIL', name: 'Cooking Oil (Groundnut & Sesame Blend)', uom: 'litre', openingStock: 60.0, reorderLevel: 15.0, purchasePrice: 140.0 },
    { code: 'RM-SPICE', name: 'Salt & Spice Mix (Asafoetida, Cumin, Chilli)', uom: 'kg', openingStock: 15.0, reorderLevel: 3.0, purchasePrice: 200.0 },
    { code: 'RM-BANANA', name: 'Raw Nendran Banana Slices', uom: 'kg', openingStock: 70.0, reorderLevel: 20.0, purchasePrice: 45.0 },
    { code: 'RM-COCO-OIL', name: 'Pure Cold-Pressed Coconut Oil', uom: 'litre', openingStock: 40.0, reorderLevel: 10.0, purchasePrice: 210.0 },
    { code: 'RM-GHEE', name: 'Pure Cow Ghee', uom: 'kg', openingStock: 30.0, reorderLevel: 8.0, purchasePrice: 580.0 },
    { code: 'RM-SUGAR', name: 'Fine Granulated Sugar', uom: 'kg', openingStock: 50.0, reorderLevel: 15.0, purchasePrice: 44.0 },
  ];

  const createdRMs: Record<string, any> = {};
  for (const rm of rmData) {
    const existing = await prisma.rawMaterial.findUnique({ where: { code: rm.code } });
    if (existing) {
      createdRMs[rm.code] = existing;
    } else {
      const created = await prisma.rawMaterial.create({
        data: {
          ...rm,
          openingStock: new Prisma.Decimal(rm.openingStock),
          reorderLevel: new Prisma.Decimal(rm.reorderLevel),
          purchasePrice: new Prisma.Decimal(rm.purchasePrice),
        },
      });
      createdRMs[rm.code] = created;

      // Ensure balance and ledger layer
      await prisma.inventoryBalance.upsert({
        where: { itemId_itemType: { itemId: created.id, itemType: ItemType.RAW_MATERIAL } },
        update: {},
        create: {
          itemId: created.id,
          itemType: ItemType.RAW_MATERIAL,
          currentQuantity: new Prisma.Decimal(rm.openingStock),
          baseUnit: rm.uom,
        },
      });

      await prisma.inventoryValuationLayer.create({
        data: {
          itemType: ItemType.RAW_MATERIAL,
          itemId: created.id,
          originalQuantity: new Prisma.Decimal(rm.openingStock),
          remainingQuantity: new Prisma.Decimal(rm.openingStock),
          unitCost: new Prisma.Decimal(rm.purchasePrice),
          referenceType: 'OPENING',
          referenceId: 'OPN-INIT-2026',
        },
      });

      await prisma.stockLedger.create({
        data: {
          itemType: ItemType.RAW_MATERIAL,
          itemId: created.id,
          movementType: StockMovementType.OPENING_BALANCE,
          quantity: new Prisma.Decimal(rm.openingStock),
          balanceAfter: new Prisma.Decimal(rm.openingStock),
          unit: rm.uom,
          direction: 'IN',
          unitRate: new Prisma.Decimal(rm.purchasePrice),
          totalValue: new Prisma.Decimal(rm.openingStock * rm.purchasePrice),
          referenceType: 'OPENING',
          referenceId: 'OPN-INIT-2026',
          notes: `Initial opening stock for ${rm.name}`,
          userId: admin.id,
        },
      });
    }
  }

  const pkgData = [
    { code: 'PKG-POUCH-200G', name: '200 g Printed Food-Grade Pouch', uom: 'pieces', openingStock: 600.0, purchasePrice: 2.50 },
    { code: 'PKG-POUCH-250G', name: '250 g Printed Food-Grade Pouch', uom: 'pieces', openingStock: 500.0, purchasePrice: 2.80 },
    { code: 'PKG-POUCH-150G', name: '150 g Foil Metallic Nitrogen Pouch', uom: 'pieces', openingStock: 400.0, purchasePrice: 3.10 },
    { code: 'PKG-BOX-250G', name: '250 g Rigid Sweet Gift Box', uom: 'pieces', openingStock: 200.0, purchasePrice: 8.50 },
    { code: 'PKG-CARTON-20', name: 'Corrugated Master Carton (20 pkts capacity)', uom: 'pieces', openingStock: 40.0, purchasePrice: 15.00 },
    { code: 'PKG-CARTON-50', name: 'Heavy Duty Master Carton (50 pkts capacity)', uom: 'pieces', openingStock: 30.0, purchasePrice: 28.00 },
  ];

  const createdPKGs: Record<string, any> = {};
  for (const pkg of pkgData) {
    const existing = await prisma.packagingMaterial.findUnique({ where: { code: pkg.code } });
    if (existing) {
      createdPKGs[pkg.code] = existing;
    } else {
      const created = await prisma.packagingMaterial.create({
        data: {
          ...pkg,
          openingStock: new Prisma.Decimal(pkg.openingStock),
          purchasePrice: new Prisma.Decimal(pkg.purchasePrice),
        },
      });
      createdPKGs[pkg.code] = created;

      await prisma.inventoryBalance.upsert({
        where: { itemId_itemType: { itemId: created.id, itemType: ItemType.PACKAGING } },
        update: {},
        create: {
          itemId: created.id,
          itemType: ItemType.PACKAGING,
          currentQuantity: new Prisma.Decimal(pkg.openingStock),
          baseUnit: pkg.uom,
        },
      });

      await prisma.inventoryValuationLayer.create({
        data: {
          itemType: ItemType.PACKAGING,
          itemId: created.id,
          originalQuantity: new Prisma.Decimal(pkg.openingStock),
          remainingQuantity: new Prisma.Decimal(pkg.openingStock),
          unitCost: new Prisma.Decimal(pkg.purchasePrice),
          referenceType: 'OPENING',
          referenceId: 'OPN-INIT-2026',
        },
      });

      await prisma.stockLedger.create({
        data: {
          itemType: ItemType.PACKAGING,
          itemId: created.id,
          movementType: StockMovementType.OPENING_BALANCE,
          quantity: new Prisma.Decimal(pkg.openingStock),
          balanceAfter: new Prisma.Decimal(pkg.openingStock),
          unit: pkg.uom,
          direction: 'IN',
          unitRate: new Prisma.Decimal(pkg.purchasePrice),
          totalValue: new Prisma.Decimal(pkg.openingStock * pkg.purchasePrice),
          referenceType: 'OPENING',
          referenceId: 'OPN-INIT-2026',
          notes: `Initial opening stock for ${pkg.name}`,
          userId: admin.id,
        },
      });
    }
  }

  // Ensure Finished Goods Initial Balance
  for (const sku of Object.keys(createdProducts)) {
    const prod = createdProducts[sku];
    const existingBal = await prisma.inventoryBalance.findUnique({
      where: { itemId_itemType: { itemId: prod.id, itemType: ItemType.FINISHED_GOOD } },
    });
    if (!existingBal) {
      const initQty = sku === 'MRK-200G' ? 50 : 30;
      await prisma.inventoryBalance.create({
        data: {
          itemId: prod.id,
          itemType: ItemType.FINISHED_GOOD,
          currentQuantity: new Prisma.Decimal(initQty),
          baseUnit: 'packets',
        },
      });
      await prisma.inventoryValuationLayer.create({
        data: {
          itemType: ItemType.FINISHED_GOOD,
          itemId: prod.id,
          originalQuantity: new Prisma.Decimal(initQty),
          remainingQuantity: new Prisma.Decimal(initQty),
          unitCost: new Prisma.Decimal(Number(prod.sellingPrice) * 0.6),
          referenceType: 'OPENING',
          referenceId: 'OPN-INIT-2026',
        },
      });
      await prisma.stockLedger.create({
        data: {
          itemType: ItemType.FINISHED_GOOD,
          itemId: prod.id,
          movementType: StockMovementType.OPENING_BALANCE,
          quantity: new Prisma.Decimal(initQty),
          balanceAfter: new Prisma.Decimal(initQty),
          unit: 'packets',
          direction: 'IN',
          unitRate: new Prisma.Decimal(Number(prod.sellingPrice) * 0.6),
          totalValue: new Prisma.Decimal(initQty * Number(prod.sellingPrice) * 0.6),
          referenceType: 'OPENING',
          referenceId: 'OPN-INIT-2026',
          notes: `Opening inventory for ${prod.name}`,
          userId: admin.id,
        },
      });
    }
  }

  // 6. Recipe BOMs
  console.log('[Import] 6. Creating Recipe BOMs for products...');
  const bomDefinitions = [
    {
      productId: createdProducts['MRK-200G'].id,
      name: 'Standard Murukku 200g Recipe',
      batchSize: 200.0,
      batchUnit: 'packets',
      expectedYield: 200.0,
      yieldUnit: 'packets',
      items: [
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-FLOUR'].id, standardQuantity: 40.0, unit: 'kg' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-OIL'].id, standardQuantity: 10.0, unit: 'litre' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-SPICE'].id, standardQuantity: 1.2, unit: 'kg' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-POUCH-200G'].id, standardQuantity: 200.0, unit: 'pieces' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-CARTON-20'].id, standardQuantity: 10.0, unit: 'pieces' },
      ],
    },
    {
      productId: createdProducts['MIX-250G'].id,
      name: 'Special Madras Mixture 250g Recipe',
      batchSize: 200.0,
      batchUnit: 'packets',
      expectedYield: 200.0,
      yieldUnit: 'packets',
      items: [
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-BESAN'].id, standardQuantity: 32.0, unit: 'kg' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-FLOUR'].id, standardQuantity: 8.0, unit: 'kg' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-OIL'].id, standardQuantity: 12.0, unit: 'litre' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-SPICE'].id, standardQuantity: 2.0, unit: 'kg' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-POUCH-250G'].id, standardQuantity: 200.0, unit: 'pieces' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-CARTON-20'].id, standardQuantity: 10.0, unit: 'pieces' },
      ],
    },
    {
      productId: createdProducts['CHP-150G'].id,
      name: 'Kerala Nendran Banana Chips 150g Recipe',
      batchSize: 150.0,
      batchUnit: 'packets',
      expectedYield: 150.0,
      yieldUnit: 'packets',
      items: [
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-BANANA'].id, standardQuantity: 38.0, unit: 'kg' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-COCO-OIL'].id, standardQuantity: 8.0, unit: 'litre' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-SPICE'].id, standardQuantity: 0.8, unit: 'kg' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-POUCH-150G'].id, standardQuantity: 150.0, unit: 'pieces' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-CARTON-20'].id, standardQuantity: 8.0, unit: 'pieces' },
      ],
    },
    {
      productId: createdProducts['RIB-200G'].id,
      name: 'Crispy Ribbon Pakoda 200g Recipe',
      batchSize: 200.0,
      batchUnit: 'packets',
      expectedYield: 200.0,
      yieldUnit: 'packets',
      items: [
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-BESAN'].id, standardQuantity: 24.0, unit: 'kg' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-FLOUR'].id, standardQuantity: 16.0, unit: 'kg' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-OIL'].id, standardQuantity: 11.0, unit: 'litre' },
        { itemType: ItemType.RAW_MATERIAL, rawMaterialId: createdRMs['RM-SPICE'].id, standardQuantity: 1.5, unit: 'kg' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-POUCH-200G'].id, standardQuantity: 200.0, unit: 'pieces' },
        { itemType: ItemType.PACKAGING, packagingMaterialId: createdPKGs['PKG-CARTON-20'].id, standardQuantity: 10.0, unit: 'pieces' },
      ],
    },
  ];

  for (const b of bomDefinitions) {
    const existing = await prisma.bOM.findFirst({ where: { name: b.name } });
    if (!existing) {
      await prisma.bOM.create({
        data: {
          productId: b.productId,
          name: b.name,
          version: 'v1.0',
          batchSize: new Prisma.Decimal(b.batchSize),
          batchUnit: b.batchUnit,
          expectedYield: new Prisma.Decimal(b.expectedYield),
          yieldUnit: b.yieldUnit,
          active: true,
          items: {
            create: b.items.map((it) => ({
              itemType: it.itemType,
              rawMaterialId: (it as any).rawMaterialId || null,
              packagingMaterialId: (it as any).packagingMaterialId || null,
              standardQuantity: new Prisma.Decimal(it.standardQuantity),
              unit: it.unit,
            })),
          },
        },
      });
    }
  }

  // 7. Realistic Orders and Invoices
  console.log('[Import] 7. Generating realistic Sales Orders & Invoices...');
  const ordersSeed = [
    {
      customer: createdCustomers[2], // Grand Sweets
      salesman: salesmanA,
      notes: 'Festival special stock for Adyar branch',
      items: [
        { product: createdProducts['MRK-200G'], quantity: 100, price: 50.0 },
        { product: createdProducts['MIX-250G'], quantity: 80, price: 65.0 },
      ],
    },
    {
      customer: createdCustomers[5], // Malabar Treats (Kerala)
      salesman: salesmanB,
      notes: 'Interstate export batch to Kozhikode',
      items: [
        { product: createdProducts['CHP-150G'], quantity: 120, price: 70.0 },
        { product: createdProducts['RIB-200G'], quantity: 60, price: 55.0 },
      ],
    },
    {
      customer: createdCustomers[3], // Madurai Meenakshi
      salesman: salesmanA,
      notes: 'Weekly consignment for central bus stand depot',
      items: [
        { product: createdProducts['MIX-250G'], quantity: 50, price: 65.0 },
        { product: createdProducts['BND-200G'], quantity: 50, price: 48.0 },
      ],
    },
  ];

  let orderSeq = 101;
  for (const od of ordersSeed) {
    const orderNumber = `SO-2026-${orderSeq++}`;
    let order = await prisma.salesOrder.findUnique({
      where: { orderNumber },
    });
    if (!order) {
      let subtotal = 0;
      let totalTax = 0;

      const orderItemsData = od.items.map((item) => {
        const lineTaxable = item.quantity * item.price;
        const gstRate = 5.0;
        const lineTax = lineTaxable * (gstRate / 100);
        subtotal += lineTaxable;
        totalTax += lineTax;
        return {
          productId: item.product.id,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.price),
          gstRate: new Prisma.Decimal(gstRate),
          taxableAmount: new Prisma.Decimal(lineTaxable),
          gstAmount: new Prisma.Decimal(lineTax),
          totalAmount: new Prisma.Decimal(lineTaxable + lineTax),
        };
      });

      const grandTotal = subtotal + totalTax;

      order = await prisma.salesOrder.create({
        data: {
          orderNumber,
          customerId: od.customer.id,
          salesmanId: od.salesman.id,
          orderNotes: od.notes,
          status: OrderStatus.APPROVED,
          subtotal: new Prisma.Decimal(subtotal),
          estimatedGst: new Prisma.Decimal(totalTax),
          grandTotal: new Prisma.Decimal(grandTotal),
          approvedById: admin.id,
          approvedAt: new Date(),
          items: {
            create: orderItemsData,
          },
        },
      });

      // Generate Invoice
      const isIntraState = od.customer.stateCode === '33';
      const cgst = isIntraState ? totalTax / 2 : 0;
      const sgst = isIntraState ? totalTax / 2 : 0;
      const igst = isIntraState ? 0 : totalTax;
      const invoiceNumber = `INV-2026-${orderSeq + 800}`;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          financialYear: '2026-27',
          orderId: order.id,
          customerId: od.customer.id,
          billingAddress: od.customer.billingAddress,
          shippingAddress: od.customer.shippingAddress,
          placeOfSupply: `${od.customer.state} (${od.customer.stateCode})`,
          totalTaxable: new Prisma.Decimal(subtotal),
          cgstAmount: new Prisma.Decimal(cgst),
          sgstAmount: new Prisma.Decimal(sgst),
          igstAmount: new Prisma.Decimal(igst),
          grandTotal: new Prisma.Decimal(grandTotal),
          paidAmount: new Prisma.Decimal(grandTotal * 0.5), // 50% part paid
          outstandingAmount: new Prisma.Decimal(grandTotal * 0.5),
          status: 'PARTIALLY_PAID',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdById: admin.id,
          items: {
            create: od.items.map((item) => ({
              productId: item.product.id,
              hsnCode: item.product.hsnCode || '1905',
              description: item.product.name,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.price),
              taxableAmount: new Prisma.Decimal(item.quantity * item.price),
              gstRate: new Prisma.Decimal(5.0),
              cgstAmount: new Prisma.Decimal(isIntraState ? (item.quantity * item.price * 0.025) : 0),
              sgstAmount: new Prisma.Decimal(isIntraState ? (item.quantity * item.price * 0.025) : 0),
              igstAmount: new Prisma.Decimal(isIntraState ? 0 : (item.quantity * item.price * 0.05)),
              totalAmount: new Prisma.Decimal(item.quantity * item.price * 1.05),
            })),
          },
        },
      });

      // Dispatch
      await prisma.dispatch.create({
        data: {
          dispatchNumber: `DSP-2026-${orderSeq + 500}`,
          orderId: order.id,
          invoiceId: invoice.id,
          vehicleNumber: 'TN-45-AZ-4412',
          driverName: 'K. Murugan',
          dispatchDate: new Date(),
          remarks: `Dispatched to ${od.customer.name}`,
          createdById: admin.id,
          items: {
            create: od.items.map((it) => ({
              productId: it.product.id,
              quantity: new Prisma.Decimal(it.quantity),
            })),
          },
        },
      });

      // Customer Payment Receipt
      await prisma.payment.create({
        data: {
          paymentNumber: `PMT-2026-${orderSeq + 200}`,
          customerId: od.customer.id,
          amount: new Prisma.Decimal(grandTotal * 0.5),
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          referenceNumber: `NEFT-SBIN-${Math.floor(10000000 + Math.random() * 90000000)}`,
          paymentDate: new Date(),
          status: PaymentStatus.POSTED,
          notes: `50% Advance received for ${invoiceNumber}`,
          createdById: admin.id,
          allocations: {
            create: [
              {
                invoiceId: invoice.id,
                amount: new Prisma.Decimal(grandTotal * 0.5),
              },
            ],
          },
        },
      });
    }
  }

  // 8. Food Safety Compliance Inspection Records
  console.log('[Import] 8. Creating statutory FSSAI Food Safety inspections...');
  const fssaiRecords = [
    {
      checkNumber: 'FSSAI-2026-0003',
      checkDate: new Date('2026-11-20T08:30:00Z'),
      category: 'OIL_POLAR_COMPOUNDS' as any,
      standardRequired: 'Total Polar Compounds (TPM) <= 25.0% as per FSSAI Section 16 Regulation',
      actualObserved: '17.5% TPM measured using Testo 270 electronic oil tester',
      isCompliant: true,
      remarks: 'Oil quality fresh and safe for high-temperature batch frying.',
    },
    {
      checkNumber: 'FSSAI-2026-0004',
      checkDate: new Date('2026-11-20T11:00:00Z'),
      category: 'TEMPERATURE' as any,
      standardRequired: 'Frying kettle temperature maintained between 175°C - 185°C',
      actualObserved: 'Digital probe registered 178.5°C steady thermal profile',
      isCompliant: true,
      remarks: 'Uniform heat distribution; optimal for crispiness.',
    },
    {
      checkNumber: 'FSSAI-2026-0005',
      checkDate: new Date('2026-11-20T14:30:00Z'),
      category: 'MOISTURE' as any,
      standardRequired: 'Finished snack moisture content <= 3.0% w/w',
      actualObserved: 'Moisture analyzer reported 2.1% w/w',
      isCompliant: true,
      remarks: 'Snacks sealed immediately in nitrogen-flushed pouch packaging.',
    },
    {
      checkNumber: 'FSSAI-2026-0006',
      checkDate: new Date('2026-11-20T16:00:00Z'),
      category: 'PEST_CONTROL' as any,
      standardRequired: 'Monthly pest control audit with zero ingress',
      actualObserved: 'Zero rodent/insect activity; traps inspected & perimeter intact',
      isCompliant: true,
      remarks: 'Certificate #PC-2026-99 issued by certified pest management agency.',
    },
  ];

  for (const fs of fssaiRecords) {
    const existing = await prisma.foodSafetyCompliance.findUnique({
      where: { checkNumber: fs.checkNumber },
    });
    if (!existing) {
      await prisma.foodSafetyCompliance.create({
        data: {
          ...fs,
          inspectorId: auditor.id,
        },
      });
    }
  }

  console.log('\n===============================================================');
  console.log('   DATASET IMPORT COMPLETED SUCCESSFULLY!                      ');
  console.log('   - 10 Customers across TN, KA, KL, TS, AP                    ');
  console.log('   - 8 Suppliers across Flour, Oil, Spices, Boxes, Sivakasi     ');
  console.log('   - 6 Products with standard selling prices and HSN codes     ');
  console.log('   - 8 Raw Materials & 6 Packaging Materials with Stock Layers ');
  console.log('   - 4 Recipe BOMs with standard batch recipes                 ');
  console.log('   - Active Orders, GST Invoices, Dispatches & Payments        ');
  console.log('   - Statutory FSSAI Food Safety compliance logs               ');
  console.log('===============================================================\n');

  return {
    customersCount: createdCustomers.length,
    suppliersCount: createdSuppliers.length,
    productsCount: Object.keys(createdProducts).length,
  };
}

if (require.main === module || process.argv[1]?.endsWith('import-extended-dataset.ts')) {
  importExtendedDataset()
    .then(() => {
      prisma.$disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Import failed:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
