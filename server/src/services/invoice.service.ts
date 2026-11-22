import { Prisma, InvoiceStatus, OrderStatus, Role } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { GSTService } from './gst.service.js';
import PDFDocument from 'pdfkit';

export class InvoiceService {
  /**
   * Generate GST Tax Invoice from an approved / allocated sales order
   */
  static async createInvoiceFromOrder(orderId: string, userId: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } },
        invoice: true,
      },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Prevent duplicate invoice generation
    if (order.invoice) {
      throw new AppError(
        `Invoice ${order.invoice.invoiceNumber} already exists for this order. Duplicate invoice creation is prohibited.`,
        400
      );
    }

    const eligibleStatuses: OrderStatus[] = [
      OrderStatus.APPROVED,
      OrderStatus.ALLOCATED,
      OrderStatus.PARTIALLY_ALLOCATED,
      OrderStatus.DISPATCHED,
    ];

    if (!eligibleStatuses.includes(order.status)) {
      throw new AppError(
        `Cannot generate invoice for order in ${order.status} state. Order must be APPROVED, ALLOCATED, or DISPATCHED.`,
        400
      );
    }

    const customer = order.customer;
    const now = new Date();
    const currYear = now.getFullYear();
    const financialYear =
      now.getMonth() >= 3
        ? `${currYear}-${String(currYear + 1).slice(-2)}`
        : `${currYear - 1}-${String(currYear).slice(-2)}`;

    // Prepare items for GST calculation
    const gstCalcItems = order.items.map((i) => ({
      productId: i.productId,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount || 0),
      discountPercent: Number(i.discountPercent || 0),
      gstRate: Number(i.gstRate || 5.0),
    }));

    const gstResult = await GSTService.calculateGST({
      customerStateCode: customer.stateCode,
      customerState: customer.state,
      items: gstCalcItems,
    });

    return prisma.$transaction(async (tx) => {
      // Double check within transaction
      const existingTxInvoice = await tx.invoice.findUnique({
        where: { orderId: order.id },
      });
      if (existingTxInvoice) {
        throw new AppError(
          `Invoice ${existingTxInvoice.invoiceNumber} has already been posted for order ${order.orderNumber}.`,
          400
        );
      }

      const count = await tx.invoice.count();
      const invoiceNumber = `INV-${currYear}-${String(count + 1).padStart(4, '0')}`;

      const invoiceItemsData = gstResult.items.map((item, idx) => {
        const orderItem = order.items[idx];
        return {
          productId: item.productId,
          hsnCode: orderItem.product.hsnCode || '1905',
          description: orderItem.product.name,
          quantity: new Prisma.Decimal(item.quantity),
          unit: orderItem.product.unit || 'packets',
          unitPrice: new Prisma.Decimal(item.unitPrice),
          discount: new Prisma.Decimal(item.discount),
          taxableAmount: new Prisma.Decimal(item.taxableAmount),
          gstRate: new Prisma.Decimal(item.gstRate),
          cgstAmount: new Prisma.Decimal(item.cgstAmount),
          sgstAmount: new Prisma.Decimal(item.sgstAmount),
          igstAmount: new Prisma.Decimal(item.igstAmount),
          totalAmount: new Prisma.Decimal(item.totalAmount),
        };
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30-day payment term

      const amountInWords = GSTService.numberToWords(gstResult.grandTotal);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          financialYear,
          orderId: order.id,
          customerId: customer.id,
          invoiceDate: new Date(),
          dueDate,
          billingAddress: customer.billingAddress,
          shippingAddress: customer.shippingAddress,
          placeOfSupply: `${customer.state} (${customer.stateCode})`,
          totalTaxable: new Prisma.Decimal(gstResult.totalTaxable),
          cgstAmount: new Prisma.Decimal(gstResult.totalCgst),
          sgstAmount: new Prisma.Decimal(gstResult.totalSgst),
          igstAmount: new Prisma.Decimal(gstResult.totalIgst),
          roundOffAmount: new Prisma.Decimal(gstResult.roundOff),
          grandTotal: new Prisma.Decimal(gstResult.grandTotal),
          paidAmount: new Prisma.Decimal(0.0),
          outstandingAmount: new Prisma.Decimal(gstResult.grandTotal),
          amountInWords,
          status: InvoiceStatus.POSTED,
          createdById: userId,
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          order: true,
        },
      });

      // Update Order status if not already dispatched
      if (order.status !== OrderStatus.DISPATCHED) {
        await tx.salesOrder.update({
          where: { id: order.id },
          data: { status: OrderStatus.INVOICED },
        });
      }

      await AuditService.log(tx, {
        userId,
        action: 'CREATE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        newValues: {
          invoiceNumber,
          grandTotal: gstResult.grandTotal,
          customerId: customer.id,
          taxable: gstResult.totalTaxable,
          gst: gstResult.totalGst,
        },
      });

      return invoice;
    });
  }

  /**
   * Cancel invoice by creating Credit Note and updating status
   */
  static async cancelInvoice(invoiceId: string, reason: string, userId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: true,
        allocations: true,
      },
    });

    if (!invoice) throw new AppError('Invoice not found.', 404);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new AppError('Invoice is already cancelled.', 400);
    }
    if (Number(invoice.paidAmount) > 0) {
      throw new AppError(
        'Cannot cancel an invoice with allocated payments. Reallocate or refund payments first.',
        400
      );
    }

    return prisma.$transaction(async (tx) => {
      const count = await tx.creditNote.count();
      const creditNoteNumber = `CN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // Credit note items mirroring invoice items
      const creditNoteItemsData = invoice.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxableAmount: i.taxableAmount,
        gstRate: i.gstRate,
        cgstAmount: i.cgstAmount,
        sgstAmount: i.sgstAmount,
        igstAmount: i.igstAmount,
        totalAmount: i.totalAmount,
      }));

      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          reason: reason || 'Invoice cancellation',
          totalTaxable: invoice.totalTaxable,
          cgstAmount: invoice.cgstAmount,
          sgstAmount: invoice.sgstAmount,
          igstAmount: invoice.igstAmount,
          totalAmount: invoice.grandTotal,
          status: 'POSTED',
          createdById: userId,
          items: {
            create: creditNoteItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.CANCELLED,
          outstandingAmount: new Prisma.Decimal(0.0),
        },
      });

      await AuditService.log(tx, {
        userId,
        action: 'CANCEL',
        entityType: 'INVOICE',
        entityId: invoice.id,
        newValues: { status: InvoiceStatus.CANCELLED, creditNoteNumber, reason },
      });

      return { invoice: updatedInvoice, creditNote };
    });
  }

  /**
   * Edit draft invoice (disallowed once posted)
   */
  static async updateInvoice(invoiceId: string, _data: any) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) throw new AppError('Invoice not found.', 404);

    if (invoice.status === InvoiceStatus.POSTED) {
      throw new AppError(
        'Cannot edit a POSTED GST Tax Invoice. Once posted, GST tax invoices are immutable under Indian GST law. Issue a Credit Note to make adjustments.',
        400
      );
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new AppError('Cannot edit a CANCELLED invoice.', 400);
    }

    throw new AppError('Invoice modifications are not permitted.', 400);
  }

  /**
   * Get single invoice with full details
   */
  static async getInvoiceById(id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
      include: {
        customer: true,
        order: {
          include: {
            salesman: { select: { id: true, fullName: true, email: true } },
          },
        },
        items: {
          include: { product: true },
        },
        creditNotes: {
          include: { items: true },
        },
        allocations: {
          include: { payment: true },
        },
        dispatches: {
          include: { items: true },
        },
        createdBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    if (!invoice) throw new AppError('Invoice not found.', 404);
    return invoice;
  }

  /**
   * List invoices with filters and pagination
   */
  static async getInvoices(filters: {
    page?: number;
    limit?: number;
    search?: string;
    customerId?: string;
    status?: InvoiceStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) where.invoiceDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.invoiceDate.lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { gstin: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, invoices, totalsAgg] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true, gstin: true, type: true, state: true } },
          order: { select: { id: true, orderNumber: true } },
          items: true,
        },
      }),
      prisma.invoice.aggregate({
        where,
        _sum: {
          totalTaxable: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          grandTotal: true,
          paidAmount: true,
          outstandingAmount: true,
        },
      }),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalTaxable: Number(totalsAgg._sum.totalTaxable || 0),
        totalCgst: Number(totalsAgg._sum.cgstAmount || 0),
        totalSgst: Number(totalsAgg._sum.sgstAmount || 0),
        totalIgst: Number(totalsAgg._sum.igstAmount || 0),
        grandTotal: Number(totalsAgg._sum.grandTotal || 0),
        paidAmount: Number(totalsAgg._sum.paidAmount || 0),
        outstandingAmount: Number(totalsAgg._sum.outstandingAmount || 0),
      },
    };
  }

  /**
   * Stream / Generate PDF Invoice
   */
  static async generateInvoicePDF(invoiceId: string): Promise<PDFKit.PDFDocument> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id: invoiceId }, { invoiceNumber: invoiceId }],
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!invoice) throw new AppError('Invoice not found', 404);

    const doc = new PDFDocument({ margin: 36, size: 'A4' });

    // Company Header
    doc.fontSize(16).font('Helvetica-Bold').text('FactoryFlow Foods Pvt. Ltd.', { align: 'center' });
    doc.fontSize(8.5).font('Helvetica').text(
      'SF 24/2, Trichy-Thanjavur Highway, Thuvakudi, Tiruchirappalli, Tamil Nadu – 620015',
      { align: 'center' }
    );
    doc.text('GSTIN: 33AAACF1234M1Z5 | State Code: 33 (Tamil Nadu) | Email: accounts@factoryflow.in', {
      align: 'center',
    });
    doc.moveDown(0.4);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
    doc.moveDown(0.4);

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#15803d').text('TAX INVOICE', { align: 'center' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('(Issued under Section 31 of CGST Act, 2017)', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.5);

    // Invoice Meta & Customer Details side by side
    const topY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').text('Invoice Details:', 36, topY);
    doc.font('Helvetica').fontSize(8.5);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 36, topY + 14);
    doc.text(`Date: ${invoice.invoiceDate.toISOString().slice(0, 10)}`, 36, topY + 28);
    doc.text(`Place of Supply: ${invoice.placeOfSupply}`, 36, topY + 42);
    doc.text(`Financial Year: ${invoice.financialYear}`, 36, topY + 56);

    doc.fontSize(9).font('Helvetica-Bold').text('Bill & Ship To:', 290, topY);
    doc.font('Helvetica').fontSize(8.5);
    doc.text(`Customer: ${invoice.customer.name}`, 290, topY + 14);
    doc.text(`GSTIN: ${invoice.customer.gstin || 'URP (Unregistered Person)'}`, 290, topY + 28);
    doc.text(`State: ${invoice.customer.state} (${invoice.customer.stateCode})`, 290, topY + 42);
    doc.text(`Address: ${invoice.billingAddress}`, 290, topY + 56, { width: 260 });

    doc.y = topY + 84;
    doc.strokeColor('#e2e8f0').lineWidth(0.8).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
    doc.moveDown(0.4);

    // Table Header
    const tableTop = doc.y;
    doc.rect(36, tableTop, 523, 18).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
    doc.text('Item Description', 40, tableTop + 5);
    doc.text('HSN', 185, tableTop + 5);
    doc.text('Qty', 230, tableTop + 5);
    doc.text('Rate', 270, tableTop + 5);
    doc.text('Taxable', 320, tableTop + 5);
    doc.text('CGST', 375, tableTop + 5);
    doc.text('SGST', 420, tableTop + 5);
    doc.text('IGST', 465, tableTop + 5);
    doc.text('Total (Rs.)', 505, tableTop + 5, { align: 'right', width: 50 });

    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    let rowY = tableTop + 22;

    for (const item of invoice.items) {
      doc.text(item.description, 40, rowY, { width: 140 });
      doc.text(item.hsnCode, 185, rowY);
      doc.text(`${item.quantity} ${item.unit}`, 230, rowY);
      doc.text(Number(item.unitPrice).toFixed(2), 270, rowY);
      doc.text(Number(item.taxableAmount).toFixed(2), 320, rowY);
      doc.text(Number(item.cgstAmount).toFixed(2), 375, rowY);
      doc.text(Number(item.sgstAmount).toFixed(2), 420, rowY);
      doc.text(Number(item.igstAmount).toFixed(2), 465, rowY);
      doc.text(Number(item.totalAmount).toFixed(2), 505, rowY, { align: 'right', width: 50 });
      rowY += 16;
    }

    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(36, rowY).lineTo(559, rowY).stroke();
    rowY += 6;

    // Totals Box
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('Total Taxable Value:', 320, rowY);
    doc.text(`Rs. ${Number(invoice.totalTaxable).toFixed(2)}`, 470, rowY, { align: 'right', width: 85 });
    rowY += 14;

    if (Number(invoice.cgstAmount) > 0) {
      doc.text('CGST:', 320, rowY);
      doc.text(`Rs. ${Number(invoice.cgstAmount).toFixed(2)}`, 470, rowY, { align: 'right', width: 85 });
      rowY += 14;
      doc.text('SGST:', 320, rowY);
      doc.text(`Rs. ${Number(invoice.sgstAmount).toFixed(2)}`, 470, rowY, { align: 'right', width: 85 });
      rowY += 14;
    }

    if (Number(invoice.igstAmount) > 0) {
      doc.text('IGST:', 320, rowY);
      doc.text(`Rs. ${Number(invoice.igstAmount).toFixed(2)}`, 470, rowY, { align: 'right', width: 85 });
      rowY += 14;
    }

    if (Number(invoice.roundOffAmount) !== 0) {
      doc.text('Round-Off:', 320, rowY);
      doc.text(`Rs. ${Number(invoice.roundOffAmount).toFixed(2)}`, 470, rowY, { align: 'right', width: 85 });
      rowY += 14;
    }

    doc.rect(315, rowY - 2, 244, 18).fill('#ecfdf5');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#15803d');
    doc.text('Invoice Grand Total:', 320, rowY + 3);
    doc.text(`Rs. ${Number(invoice.grandTotal).toFixed(2)}`, 470, rowY + 3, { align: 'right', width: 85 });
    doc.fillColor('#000000');
    rowY += 26;

    // Amount in words
    doc.fontSize(8.5).font('Helvetica-Bold').text('Amount Chargeable (in words):', 36, rowY);
    doc.font('Helvetica').text(invoice.amountInWords || GSTService.numberToWords(Number(invoice.grandTotal)), 36, rowY + 12);
    rowY += 34;

    // Footer & Signatures
    doc.fontSize(7.5).font('Helvetica');
    doc.text(
      'Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
      36,
      rowY,
      { width: 300 }
    );
    doc.text('For FactoryFlow Foods Pvt. Ltd.', 400, rowY);
    doc.text('Authorized Signatory', 400, rowY + 30);

    return doc;
  }
}
