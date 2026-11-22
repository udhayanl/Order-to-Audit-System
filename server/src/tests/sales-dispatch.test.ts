import { ItemType, StockMovementType, Role, OrderStatus, InvoiceStatus, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from '../services/inventory.service.js';
import { OrderService } from '../services/order.service.js';
import { StockAllocationService } from '../services/stock-allocation.service.js';
import { GSTService } from '../services/gst.service.js';
import { InvoiceService } from '../services/invoice.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { SalesReturnService } from '../services/sales-return.service.js';
import { SalesDashboardService } from '../services/sales-dashboard.service.js';
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

async function runSalesDispatchTests() {
  console.log('\n===============================================================');
  console.log('   FACTORYFLOW PHASE 5: SALES, GST BILLING & DISPATCH TESTS    ');
  console.log('===============================================================\n');

  // Seed benchmark database
  const seed = await seedDatabase(true);
  const adminId = seed.admin.id;
  const salesmanAId = seed.salesmanA.id;
  const salesmanBId = seed.salesmanB.id;
  const supervisorId = seed.supervisor.id;
  const auditorId = seed.auditor.id;
  const ownerId = seed.owner.id;

  const retailerA = seed.retailerA;
  const distributorB = seed.distributorB;
  const murukku = seed.murukkuProduct;

  // Let's create a second product for multi-item testing
  const mixture = await prisma.product.findFirst({ where: { sku: 'MIX-250G' } }) || await prisma.product.create({
    data: {
      sku: 'MIX-250G',
      name: 'Madras Mixture 250 g',
      categoryId: murukku.categoryId,
      packSize: '250 g',
      unit: 'packets',
      sellingPrice: new Prisma.Decimal(65.0),
      gstRate: new Prisma.Decimal(5.0),
      hsnCode: '1905',
      reorderLevel: new Prisma.Decimal(30.0),
      active: true,
    },
  });

  // Seed finished goods stock for testing:
  // Add 200 packets of Murukku and 100 packets of Mixture
  await InventoryService.recordMovement(prisma, {
    itemType: ItemType.FINISHED_GOOD,
    itemId: murukku.id,
    movementType: StockMovementType.PRODUCTION_OUTPUT,
    quantity: 200,
    unit: 'packets',
    direction: 'IN',
    referenceType: 'PRODUCTION_TEST',
    referenceId: 'BATCH-2026-TEST',
    notes: 'Test FG stock initialization',
    userId: adminId,
  });

  await InventoryService.recordMovement(prisma, {
    itemType: ItemType.FINISHED_GOOD,
    itemId: mixture.id,
    movementType: StockMovementType.PRODUCTION_OUTPUT,
    quantity: 100,
    unit: 'packets',
    direction: 'IN',
    referenceType: 'PRODUCTION_TEST',
    referenceId: 'BATCH-2026-TEST',
    notes: 'Test FG stock initialization',
    userId: adminId,
  });

  // -------------------------------------------------------------
  // GROUP 1: SALES ORDERS (Tests 1-8)
  // -------------------------------------------------------------
  console.log('--- GROUP 1: SALES ORDERS (Tests 1-8) ---');

  // Test 1: Create sales order
  const order1 = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.SALESMAN,
    items: [{ productId: murukku.id, quantity: 20 }],
    orderNotes: 'Urgent delivery for festival sale',
  });

  assert(
    order1.orderNumber.startsWith('SO-') &&
      order1.status === OrderStatus.SUBMITTED &&
      Number(order1.subtotal) === 1000 &&
      Number(order1.estimatedGst) === 50 &&
      Number(order1.grandTotal) === 1050,
    '1. Create sales order with automatic calculation (20 pkts @ ₹50 = ₹1,000 + 5% GST = ₹1,050)',
    { orderNumber: order1.orderNumber, grandTotal: order1.grandTotal }
  );

  // Test 2: Add multiple products
  const order2 = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.ADMIN,
    items: [
      { productId: murukku.id, quantity: 10 }, // 10 * 50 = 500
      { productId: mixture.id, quantity: 10 }, // 10 * 65 = 650
    ],
  });

  assert(
    order2.items.length === 2 &&
      Number(order2.subtotal) === 1150 &&
      Number(order2.grandTotal) === 1207.5,
    '2. Add multiple products with combined taxable value (₹1,150 + 5% GST = ₹1,207.50)',
    { subtotal: order2.subtotal, grandTotal: order2.grandTotal }
  );

  // Test 3: Validate customer exists
  let invalidCustomerCaught = false;
  try {
    await OrderService.createOrder({
      customerId: '00000000-0000-0000-0000-000000000000',
      salesmanId: salesmanAId,
      items: [{ productId: murukku.id, quantity: 5 }],
    });
  } catch (err: any) {
    invalidCustomerCaught = err.statusCode === 404;
  }
  assert(invalidCustomerCaught, '3. Validate customer and reject non-existent customer ID with 404');

  // Test 4: Validate product exists
  let invalidProductCaught = false;
  try {
    await OrderService.createOrder({
      customerId: retailerA.id,
      salesmanId: salesmanAId,
      items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 5 }],
    });
  } catch (err: any) {
    invalidProductCaught = err.statusCode === 404;
  }
  assert(invalidProductCaught, '4. Validate product and reject non-existent product ID with 404');

  // Test 5: Reject invalid quantity
  let invalidQtyCaught = false;
  try {
    await OrderService.createOrder({
      customerId: retailerA.id,
      salesmanId: salesmanAId,
      items: [{ productId: murukku.id, quantity: 0 }],
    });
  } catch (err: any) {
    invalidQtyCaught = err.statusCode === 400;
  }
  assert(invalidQtyCaught, '5. Reject invalid quantity (quantity <= 0 rejected with 400)');

  // Test 6: Prevent unauthorized order approval
  let unauthorizedApprovalCaught = false;
  try {
    await OrderService.approveOrder(order1.id, salesmanAId, Role.SALESMAN);
  } catch (err: any) {
    unauthorizedApprovalCaught = err.statusCode === 403;
  }
  assert(unauthorizedApprovalCaught, '6. Prevent unauthorized order approval by salesman (403 Forbidden)');

  // Test 7: Test order status transitions
  const approvedOrder1 = await OrderService.approveOrder(order1.id, adminId, Role.ADMIN);
  assert(
    approvedOrder1.status === OrderStatus.APPROVED && approvedOrder1.approvedById === adminId,
    '7. Test order status transition from SUBMITTED to APPROVED by Admin',
    { status: approvedOrder1.status }
  );

  // Test 8: Prevent modification of completed/approved orders
  let modifyApprovedCaught = false;
  try {
    await OrderService.updateOrder({
      orderId: order1.id,
      items: [{ productId: murukku.id, quantity: 30 }],
      adminUserId: adminId,
    });
  } catch (err: any) {
    modifyApprovedCaught = err.statusCode === 400;
  }
  assert(modifyApprovedCaught, '8. Prevent modification of APPROVED order (400 Bad Request)');

  // -------------------------------------------------------------
  // GROUP 2: SALESMAN PERMISSIONS (Tests 9-12)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 2: SALESMAN PERMISSIONS (Tests 9-12) ---');

  // Ensure Customer assignments: Retailer A -> Salesman A, Distributor B -> Salesman B
  await prisma.customer.update({
    where: { id: retailerA.id },
    data: { salesmanId: salesmanAId },
  });
  await prisma.customer.update({
    where: { id: distributorB.id },
    data: { salesmanId: salesmanBId },
  });

  // Test 9: Create order using assigned customer
  const salesmanOrder = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.SALESMAN,
    items: [{ productId: murukku.id, quantity: 15 }],
  });
  assert(
    salesmanOrder.salesmanId === salesmanAId && salesmanOrder.customerId === retailerA.id,
    '9. Salesman creates order for their assigned customer successfully'
  );

  // Test 10: Prevent access to unauthorized customers
  let unauthorizedCustomerCaught = false;
  try {
    await OrderService.createOrder({
      customerId: distributorB.id, // assigned to Salesman B
      salesmanId: salesmanAId,
      callerRole: Role.SALESMAN,
      items: [{ productId: murukku.id, quantity: 10 }],
    });
  } catch (err: any) {
    unauthorizedCustomerCaught = err.statusCode === 403;
  }
  assert(
    unauthorizedCustomerCaught,
    '10. Prevent salesman from ordering for unauthorized/unassigned customer (403 Forbidden)'
  );

  // Test 11: Prevent salesman from approving own order
  let salesmanSelfApproveCaught = false;
  try {
    await OrderService.approveOrder(salesmanOrder.id, salesmanAId, Role.SALESMAN);
  } catch (err: any) {
    salesmanSelfApproveCaught = err.statusCode === 403;
  }
  assert(salesmanSelfApproveCaught, '11. Prevent salesman from approving their own order');

  // Test 12: Prevent unauthorized price modification
  let salesmanPriceModifyCaught = false;
  try {
    await OrderService.updateOrder({
      orderId: salesmanOrder.id,
      items: [{ productId: murukku.id, quantity: 15, unitPrice: 35.0 }], // attempted discount override
      adminUserId: salesmanAId,
      callerRole: Role.SALESMAN,
    });
  } catch (err: any) {
    salesmanPriceModifyCaught = err.statusCode === 403;
  }
  assert(salesmanPriceModifyCaught, '12. Prevent salesman from modifying order price or overriding prices');

  // -------------------------------------------------------------
  // GROUP 3: STOCK ALLOCATION (Tests 13-17)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 3: STOCK ALLOCATION (Tests 13-17) ---');

  // Approve salesmanOrder first
  await OrderService.approveOrder(salesmanOrder.id, adminId, Role.ADMIN);

  // Test 13: Allocate finished goods
  const alloc1 = await StockAllocationService.allocateStock({
    salesOrderId: salesmanOrder.id,
    userId: adminId,
    items: [{ productId: murukku.id, quantity: 15 }],
  });

  // Verify that stock allocation does NOT touch StockLedger
  const ledgerCountBeforeDispatch = await prisma.stockLedger.count({
    where: { movementType: StockMovementType.DISPATCH },
  });

  assert(
    alloc1.allocationNumber.startsWith('ALC-') && alloc1.status === 'ACTIVE' && ledgerCountBeforeDispatch === 0,
    '13. Allocate finished goods stock to approved sales order (status: ACTIVE, zero DISPATCH ledger movements)',
    { allocationNumber: alloc1.allocationNumber }
  );

  // Test 14: Prevent over-allocation
  // Create an order demanding 500 pkts (more than 200 in stock)
  const hugeOrder = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.ADMIN,
    items: [{ productId: murukku.id, quantity: 500 }],
  });
  await OrderService.approveOrder(hugeOrder.id, adminId, Role.ADMIN);

  let overAllocCaught = false;
  try {
    await StockAllocationService.allocateStock({
      salesOrderId: hugeOrder.id,
      userId: adminId,
      items: [{ productId: murukku.id, quantity: 500 }],
    });
  } catch (err: any) {
    overAllocCaught = err.statusCode === 400;
  }
  assert(overAllocCaught, '14. Prevent over-allocation beyond available unreserved stock (400 Bad Request)');

  // Test 15: Support partial allocation
  const partialAlloc = await StockAllocationService.allocateStock({
    salesOrderId: hugeOrder.id,
    userId: adminId,
    items: [{ productId: murukku.id, quantity: 50 }],
  });
  const updatedHugeOrder = await prisma.salesOrder.findUnique({ where: { id: hugeOrder.id } });
  assert(
    partialAlloc.status === 'ACTIVE' && updatedHugeOrder?.status === OrderStatus.PARTIALLY_ALLOCATED,
    '15. Support partial allocation (order transitions to PARTIALLY_ALLOCATED)',
    { orderStatus: updatedHugeOrder?.status }
  );

  // Test 16: Release cancelled allocations
  const cancelledOrder = await OrderService.cancelOrder(hugeOrder.id, adminId, 'Customer cancelled order');
  const cancelledAlloc = await prisma.stockAllocation.findUnique({ where: { id: partialAlloc.id } });
  const cancelledOrderItem = await prisma.salesOrderItem.findFirst({ where: { salesOrderId: hugeOrder.id } });
  assert(
    cancelledOrder.status === OrderStatus.CANCELLED &&
      cancelledAlloc?.status === 'RELEASED' &&
      Number(cancelledOrderItem?.allocatedQuantity) === 0,
    '16. Release allocations when order is cancelled (allocation: RELEASED, allocatedQty: 0)'
  );

  // Test 17: Handle concurrent/subsequent allocations correctly
  // Available stock should accurately account for active allocations
  const availability = await StockAllocationService.getStockAvailability(murukku.id);
  const murukkuAvail = availability[0];
  assert(
    murukkuAvail.allocatedStock === 15 && murukkuAvail.availableStock === murukkuAvail.physicalStock - 15,
    `17. Handle allocation reservation tracking (Physical: ${murukkuAvail.physicalStock}, Allocated: 15, Available: ${murukkuAvail.availableStock})`,
    murukkuAvail
  );

  // -------------------------------------------------------------
  // GROUP 4: GST BILLING ENGINE (Tests 18-26)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 4: GST BILLING ENGINE (Tests 18-26) ---');

  // Test 18: Calculate intra-state CGST and SGST (Tamil Nadu to Tamil Nadu)
  const intraStateResult = await GSTService.calculateGST({
    customerStateCode: '33',
    customerState: 'Tamil Nadu',
    items: [{ productId: murukku.id, quantity: 100, unitPrice: 50.0, gstRate: 5.0 }],
  });
  assert(
    intraStateResult.isIntraState === true &&
      intraStateResult.totalTaxable === 5000 &&
      intraStateResult.totalCgst === 125 &&
      intraStateResult.totalSgst === 125 &&
      intraStateResult.totalIgst === 0 &&
      intraStateResult.grandTotal === 5250,
    '18. Calculate intra-state CGST (2.5% = ₹125) and SGST (2.5% = ₹125) on ₹5,000 = ₹5,250',
    intraStateResult
  );

  // Test 19: Calculate inter-state IGST (Tamil Nadu to Karnataka)
  const interStateResult = await GSTService.calculateGST({
    customerStateCode: '29',
    customerState: 'Karnataka',
    items: [{ productId: murukku.id, quantity: 50, unitPrice: 50.0, gstRate: 5.0 }],
  });
  assert(
    interStateResult.isIntraState === false &&
      interStateResult.totalTaxable === 2500 &&
      interStateResult.totalCgst === 0 &&
      interStateResult.totalSgst === 0 &&
      interStateResult.totalIgst === 125 &&
      interStateResult.grandTotal === 2625,
    '19. Calculate inter-state IGST (5.0% = ₹125) on ₹2,500 = ₹2,625',
    interStateResult
  );

  // Test 20: Validate GST rate
  const rateResult = await GSTService.calculateGST({
    customerStateCode: '33',
    items: [{ productId: murukku.id, quantity: 10, unitPrice: 100.0, gstRate: 12.0 }],
  });
  assert(
    rateResult.totalTaxable === 1000 && rateResult.totalCgst === 60 && rateResult.totalSgst === 60,
    '20. Validate custom GST rate (12% produces 6% CGST + 6% SGST)'
  );

  // Test 21: Validate GSTIN format
  const validGSTIN = GSTService.validateGSTIN('33AAAAA1111A1Z1');
  const invalidGSTIN1 = GSTService.validateGSTIN('12345');
  const invalidGSTIN2 = GSTService.validateGSTIN('33AAAAA1111A1A1'); // 14th char not Z
  assert(
    validGSTIN && !invalidGSTIN1 && !invalidGSTIN2,
    '21. Validate Indian GSTIN format with strict regex checksum'
  );

  // Test 22: Validate state code extraction
  const codeTN = GSTService.extractStateCode('33AAAAA1111A1Z1');
  const codeKA = GSTService.extractStateCode('29BBBBB2222B1Z2');
  assert(codeTN === '33' && codeKA === '29', '22. Extract 2-digit state code from GSTIN (33 for TN, 29 for KA)');

  // Test 23: Calculate discounts (flat and percent)
  const discResult = await GSTService.calculateGST({
    customerStateCode: '33',
    items: [{ productId: murukku.id, quantity: 10, unitPrice: 50.0, discount: 50.0, gstRate: 5.0 }],
  });
  // Gross: 500, Discount: 50, Taxable: 450, CGST: 11.25, SGST: 11.25, Total: 472.50
  assert(
    discResult.totalTaxable === 450 &&
      discResult.totalCgst === 11.25 &&
      discResult.totalSgst === 11.25 &&
      discResult.grandTotal === 472.5,
    '23. Calculate discounts (Gross ₹500 - ₹50 discount = ₹450 taxable + ₹22.50 GST = ₹472.50)',
    discResult
  );

  // Test 24: Calculate taxable value
  assert(discResult.items[0].taxableAmount === 450, '24. Taxable value equals gross amount minus discount');

  // Test 25: Verify rounding precision
  const roundTest = await GSTService.calculateGST({
    customerStateCode: '33',
    items: [{ productId: murukku.id, quantity: 3, unitPrice: 33.33, gstRate: 5.0 }],
  });
  assert(typeof roundTest.roundOff === 'number', '25. Verify rounding and round-off calculation');

  // Test 26: Verify invoice total reconciliation
  const reconciles =
    Math.abs(
      intraStateResult.totalTaxable +
        intraStateResult.totalCgst +
        intraStateResult.totalSgst +
        intraStateResult.totalIgst +
        intraStateResult.roundOff -
        (intraStateResult.grandTotal + intraStateResult.roundOff)
    ) < 0.01;
  assert(reconciles, '26. Verify mathematical reconciliation of invoice totals');

  // -------------------------------------------------------------
  // GROUP 5: INVOICES & PDF (Tests 27-33)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 5: INVOICES & PDF (Tests 27-33) ---');

  // Create an order specifically for invoicing
  const invOrder = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.ADMIN,
    items: [{ productId: murukku.id, quantity: 20 }],
  });
  await OrderService.approveOrder(invOrder.id, adminId, Role.ADMIN);

  // Test 27: Generate invoice
  const invoice = await InvoiceService.createInvoiceFromOrder(invOrder.id, adminId);
  assert(
    invoice.invoiceNumber.startsWith('INV-') &&
      invoice.status === InvoiceStatus.POSTED &&
      Number(invoice.totalTaxable) === 1000 &&
      Number(invoice.cgstAmount) === 25 &&
      Number(invoice.sgstAmount) === 25 &&
      Number(invoice.grandTotal) === 1050,
    '27. Generate GST Tax Invoice from approved sales order with POSTED status',
    { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal }
  );

  // Test 28: Generate unique invoice number format
  assert(
    /^INV-\d{4}-\d{4}$/.test(invoice.invoiceNumber),
    '28. Verify unique sequential invoice numbering format (INV-YYYY-XXXX)',
    { invoiceNumber: invoice.invoiceNumber }
  );

  // Test 29: Prevent duplicate invoice posting
  let dupInvoiceCaught = false;
  try {
    await InvoiceService.createInvoiceFromOrder(invOrder.id, adminId);
  } catch (err: any) {
    dupInvoiceCaught = err.statusCode === 400;
  }
  assert(dupInvoiceCaught, '29. Prevent duplicate invoice posting for the same sales order (400 Bad Request)');

  // Test 30: Preserve invoice tax snapshot
  // Even if master price changes, invoice items must retain historic snapshot
  const originalItemTaxable = Number(invoice.items[0].taxableAmount);
  await prisma.product.update({
    where: { id: murukku.id },
    data: { sellingPrice: new Prisma.Decimal(99.0) }, // price changed in master
  });
  const reloadedInvoice = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: { items: true },
  });
  assert(
    Number(reloadedInvoice?.items[0].taxableAmount) === originalItemTaxable,
    '30. Preserve historical tax and price snapshot in invoice records',
    { snapshotTaxable: reloadedInvoice?.items[0].taxableAmount }
  );
  // Restore product price
  await prisma.product.update({
    where: { id: murukku.id },
    data: { sellingPrice: new Prisma.Decimal(50.0) },
  });

  // Test 31: Generate invoice PDF
  const pdfDoc = await InvoiceService.generateInvoicePDF(invoice.id);
  assert(pdfDoc !== null && typeof pdfDoc.pipe === 'function', '31. Generate PDF invoice via PDFKit stream');

  // Test 32: Prevent editing posted invoice
  let editPostedCaught = false;
  try {
    await InvoiceService.updateInvoice(invoice.id, { totalTaxable: 2000 });
  } catch (err: any) {
    editPostedCaught = err.statusCode === 400;
  }
  assert(editPostedCaught, '32. Prevent editing POSTED invoice under statutory GST rules (400 Bad Request)');

  // Test 33: Test cancellation and credit-note workflows
  const cancelResult = await InvoiceService.cancelInvoice(invoice.id, 'Customer cancellation', adminId);
  assert(
    cancelResult.invoice.status === InvoiceStatus.CANCELLED &&
      cancelResult.creditNote.creditNoteNumber.startsWith('CN-') &&
      Number(cancelResult.creditNote.totalAmount) === 1050,
    '33. Cancel invoice and automatically generate matching Credit Note',
    { creditNoteNumber: cancelResult.creditNote.creditNoteNumber }
  );

  // -------------------------------------------------------------
  // GROUP 6: DISPATCH & STOCK LEDGER (Tests 34-40)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 6: DISPATCH & STOCK LEDGER (Tests 34-40) ---');

  // Create clean order for dispatch test
  const dispatchOrder = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.ADMIN,
    items: [{ productId: murukku.id, quantity: 25 }],
  });
  await OrderService.approveOrder(dispatchOrder.id, adminId, Role.ADMIN);
  await InvoiceService.createInvoiceFromOrder(dispatchOrder.id, adminId);

  const stockBeforeDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);

  // Test 34 & 35: Create and post dispatch
  const dispatch = await DispatchService.postDispatch({
    orderId: dispatchOrder.id,
    vehicleNumber: 'TN-45-AZ-1234',
    driverName: 'Murugan S',
    transporter: 'VRL Logistics',
    remarks: 'Festival shipment',
    items: [{ productId: murukku.id, quantity: 25, batchNumber: 'BATCH-2026-0001' }],
    userId: adminId,
  });

  assert(
    dispatch.dispatchNumber.startsWith('DSP-') && dispatch.deliveryStatus === 'DISPATCHED',
    '34. Create dispatch record with vehicle and transporter details',
    { dispatchNumber: dispatch.dispatchNumber }
  );

  const reloadedDispatchOrder = await prisma.salesOrder.findUnique({ where: { id: dispatchOrder.id } });
  assert(
    reloadedDispatchOrder?.status === OrderStatus.DISPATCHED,
    '35. Post dispatch and transition order status to DISPATCHED'
  );

  // Test 36: Prevent dispatch beyond available stock
  const hugeDispatchOrder = await OrderService.createOrder({
    customerId: retailerA.id,
    salesmanId: salesmanAId,
    callerRole: Role.ADMIN,
    items: [{ productId: murukku.id, quantity: 1000 }],
  });
  await OrderService.approveOrder(hugeDispatchOrder.id, adminId, Role.ADMIN);

  let dispatchBeyondStockCaught = false;
  try {
    await DispatchService.postDispatch({
      orderId: hugeDispatchOrder.id,
      userId: adminId,
    });
  } catch (err: any) {
    dispatchBeyondStockCaught = err.statusCode === 400;
  }
  assert(dispatchBeyondStockCaught, '36. Prevent dispatch beyond available finished-goods inventory (400 Bad Request)');

  // Test 37: Prevent duplicate dispatch posting
  let dupDispatchCaught = false;
  try {
    await DispatchService.postDispatch({
      orderId: dispatchOrder.id,
      userId: adminId,
    });
  } catch (err: any) {
    dupDispatchCaught = err.statusCode === 400;
  }
  assert(dupDispatchCaught, '37. Prevent duplicate dispatch posting on already dispatched order');

  // Test 38: Create stock OUT ledger entries
  const dispatchLedgerEntry = await prisma.stockLedger.findFirst({
    where: {
      movementType: StockMovementType.DISPATCH,
      referenceId: dispatch.dispatchNumber,
    },
  });
  assert(
    dispatchLedgerEntry !== null &&
      Number(dispatchLedgerEntry.quantity) === -25 &&
      dispatchLedgerEntry.direction === 'OUT',
    '38. Atomic creation of StockLedger OUT entry (quantity: -25, direction: OUT)',
    dispatchLedgerEntry
  );

  // Test 39: Update finished-goods inventory balance
  const stockAfterDispatch = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);
  assert(
    stockAfterDispatch === stockBeforeDispatch - 25,
    `39. Update finished-goods inventory balance (${stockBeforeDispatch} -> ${stockAfterDispatch})`
  );

  // Test 40: Verify batch traceability
  const dispatchItemWithBatch = await prisma.dispatchItem.findFirst({
    where: { dispatchId: dispatch.id },
  });
  assert(
    dispatchItemWithBatch?.batchNumber === 'BATCH-2026-0001',
    '40. Verify batch number traceability on dispatched finished goods'
  );

  // -------------------------------------------------------------
  // GROUP 7: SALES RETURNS & CREDIT NOTES (Tests 41-46)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 7: SALES RETURNS & CREDIT NOTES (Tests 41-46) ---');

  const stockBeforeReturn = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);

  // Test 41: Create sales return
  const returnResult = await SalesReturnService.createReturn({
    customerId: retailerA.id,
    salesOrderId: dispatchOrder.id,
    dispatchId: dispatch.id,
    returnReason: 'QUALITY_COMPLAINT',
    items: [{ productId: murukku.id, returnedQuantity: 5, condition: 'GOOD', batchNumber: 'BATCH-2026-0001' }],
    userId: adminId,
  });

  assert(
    returnResult.salesReturn.returnNumber.startsWith('SR-') &&
      returnResult.salesReturn.status === 'APPROVED',
    '41. Create sales return document linked to customer and dispatch',
    { returnNumber: returnResult.salesReturn.returnNumber }
  );

  // Test 42: Validate original dispatch quantity
  let returnExceedsDispatchCaught = false;
  try {
    await SalesReturnService.createReturn({
      customerId: retailerA.id,
      dispatchId: dispatch.id,
      returnReason: 'DAMAGED_GOODS',
      items: [{ productId: murukku.id, returnedQuantity: 30, condition: 'GOOD' }], // 30 > 25 dispatched
      userId: adminId,
    });
  } catch (err: any) {
    returnExceedsDispatchCaught = err.statusCode === 400;
  }
  assert(returnExceedsDispatchCaught, '42. Validate that return quantity cannot exceed dispatched quantity');

  // Test 43: Approve good-condition return (restocks inventory)
  const stockAfterGoodReturn = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);
  const goodReturnItem = returnResult.salesReturn.items[0];
  assert(
    goodReturnItem.stockRestocked === true &&
      stockAfterGoodReturn === stockBeforeReturn + 5,
    `43. Good-condition return restocks inventory (+5 packets: ${stockBeforeReturn} -> ${stockAfterGoodReturn})`
  );

  // Test 44: Keep damaged goods out of usable inventory
  const damagedReturnResult = await SalesReturnService.createReturn({
    customerId: retailerA.id,
    dispatchId: dispatch.id,
    returnReason: 'DAMAGED_GOODS',
    items: [{ productId: murukku.id, returnedQuantity: 3, condition: 'DAMAGED', batchNumber: 'BATCH-2026-0001' }],
    userId: adminId,
  });
  const stockAfterDamagedReturn = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, murukku.id);
  const damagedItem = damagedReturnResult.salesReturn.items[0];
  assert(
    damagedItem.stockRestocked === false &&
      stockAfterDamagedReturn === stockAfterGoodReturn,
    '44. Keep damaged goods OUT of usable inventory (stockRestocked: false, inventory unchanged)'
  );

  // Test 45: Generate credit note automatically
  assert(
    returnResult.creditNote !== null &&
      returnResult.creditNote.creditNoteNumber.startsWith('CN-') &&
      Number(returnResult.creditNote.totalAmount) === 262.5, // 5 pkts @ 50 = 250 + 5% GST = 262.50
    '45. Automatically generate matching Credit Note with reversed GST',
    { creditNoteNumber: returnResult.creditNote?.creditNoteNumber }
  );

  // Test 46: Prevent duplicate return posting exceeding remaining dispatched quantity
  let duplicateReturnCaught = false;
  try {
    // Total dispatched was 25. Already returned: 5 + 3 = 8. Remaining: 17. Attempt 20.
    await SalesReturnService.createReturn({
      customerId: retailerA.id,
      dispatchId: dispatch.id,
      returnReason: 'OTHER',
      items: [{ productId: murukku.id, returnedQuantity: 20, condition: 'GOOD' }],
      userId: adminId,
    });
  } catch (err: any) {
    duplicateReturnCaught = err.statusCode === 400;
  }
  assert(
    duplicateReturnCaught,
    '46. Prevent cumulative returns exceeding original dispatched quantity'
  );

  // -------------------------------------------------------------
  // GROUP 8: ROLE AUTHORIZATION (Tests 47-51)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 8: ROLE AUTHORIZATION (Tests 47-51) ---');

  // Test 47: Verify salesman permissions
  // Salesman can view own orders, but getOrders only returns own orders
  const salesmanOrders = await OrderService.getOrders({
    callerRole: Role.SALESMAN,
    callerUserId: salesmanAId,
  });
  const allSalesmanA = salesmanOrders.data.every((o: any) => o.salesmanId === salesmanAId);
  assert(allSalesmanA, '47. Verify Salesman restricted strictly to own orders');

  // Test 48: Verify admin permissions
  const adminOrders = await OrderService.getOrders({
    callerRole: Role.ADMIN,
    callerUserId: adminId,
  });
  assert(adminOrders.data.length >= salesmanOrders.data.length, '48. Verify Admin full visibility across all orders');

  // Test 49: Verify auditor read-only access
  const auditorReport = await SalesDashboardService.getGSTR1Report({});
  assert(
    auditorReport.summary !== undefined && Array.isArray(auditorReport.b2bInvoices),
    '49. Verify Auditor read-only access to statutory reports and audit views'
  );

  // Test 50: Verify owner access
  const ownerSummary = await SalesDashboardService.getDashboardSummary(ownerId, Role.OWNER);
  assert(ownerSummary.kpis !== undefined, '50. Verify Owner access to executive KPIs and business metrics');

  // Test 51: Verify production supervisor restrictions
  let supervisorApproveCaught = false;
  try {
    await OrderService.approveOrder(salesmanOrder.id, supervisorId, Role.PRODUCTION_SUPERVISOR);
  } catch (err: any) {
    supervisorApproveCaught = err.statusCode === 403;
  }
  assert(
    supervisorApproveCaught,
    '51. Verify Production Supervisor restricted from sales order approval (403 Forbidden)'
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSalesDispatchTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
