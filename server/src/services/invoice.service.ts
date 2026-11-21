import { Prisma, InvoiceStatus, OrderStatus } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import PDFDocument from 'pdfkit';

export class InvoiceService {
  /**
   * Generate GST Tax Invoice from an approved sales order
   */
  static async createInvoiceFromOrder(orderId: string, userId: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!order) throw new AppError('Order not found.', 404);
    if (order.status !== OrderStatus.APPROVED) {
      throw new AppError(`Cannot generate invoice for order in ${order.status} state. Order must be APPROVED.`);
    }

    const customer = order.customer;
    const isIntraState = customer.stateCode === '33'; // Tamil Nadu factory to Tamil Nadu customer
    const financialYear = `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`;

    return prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      const invoiceItems = [];

      for (const item of order.items) {
        const taxable = Number(item.taxableAmount);
        const gstRate = Number(item.gstRate);
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (isIntraState) {
          cgst = Math.round((taxable * (gstRate / 2) / 100) * 100) / 100;
          sgst = Math.round((taxable * (gstRate / 2) / 100) * 100) / 100;
        } else {
          igst = Math.round((taxable * (gstRate / 100)) * 100) / 100;
        }

        const itemTotal = Math.round((taxable + cgst + sgst + igst) * 100) / 100;

        totalTaxable += taxable;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;

        invoiceItems.push({
          productId: item.productId,
          hsnCode: item.product.hsnCode,
          description: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit,
          unitPrice: item.unitPrice,
          taxableAmount: new Prisma.Decimal(taxable),
          gstRate: item.gstRate,
          cgstAmount: new Prisma.Decimal(cgst),
          sgstAmount: new Prisma.Decimal(sgst),
          igstAmount: new Prisma.Decimal(igst),
          totalAmount: new Prisma.Decimal(itemTotal),
        });
      }

      const grandTotal = Math.round((totalTaxable + totalCgst + totalSgst + totalIgst) * 100) / 100;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days credit

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
          totalTaxable: new Prisma.Decimal(totalTaxable),
          cgstAmount: new Prisma.Decimal(totalCgst),
          sgstAmount: new Prisma.Decimal(totalSgst),
          igstAmount: new Prisma.Decimal(totalIgst),
          grandTotal: new Prisma.Decimal(grandTotal),
          paidAmount: new Prisma.Decimal(0.0),
          outstandingAmount: new Prisma.Decimal(grandTotal),
          status: InvoiceStatus.POSTED,
          createdById: userId,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      });

      // Update Order Status to INVOICED
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.INVOICED },
      });

      await AuditService.log(tx, {
        userId,
        action: 'CREATE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        newValues: { invoiceNumber, grandTotal, customerId: customer.id },
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
      include: { allocations: true },
    });

    if (!invoice) throw new AppError('Invoice not found.', 404);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new AppError('Invoice is already cancelled.');
    }
    if (Number(invoice.paidAmount) > 0) {
      throw new AppError('Cannot cancel an invoice with allocated payments. Reallocate or refund payments first.');
    }

    return prisma.$transaction(async (tx) => {
      const count = await tx.creditNote.count();
      const creditNoteNumber = `CN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          reason,
          totalAmount: invoice.grandTotal,
          createdById: userId,
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
   * Stream PDF Invoice for download
   */
  static async generateInvoicePDF(invoiceId: string): Promise<PDFKit.PDFDocument> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!invoice) throw new AppError('Invoice not found', 404);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Header
    doc.fontSize(18).text('FactoryFlow Foods Pvt. Ltd.', { align: 'center', bold: true } as any);
    doc.fontSize(9).text('Plot 42, Food Processing Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu – 620015', { align: 'center' });
    doc.text('GSTIN: 33AAAAF1234F1Z5 | State: Tamil Nadu (33) | Email: accounts@factoryflow.in', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(14).fillColor('#15803d').text('TAX INVOICE', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.5);

    // Invoice details & Customer details
    const topY = doc.y;
    doc.fontSize(10);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 40, topY);
    doc.text(`Date: ${invoice.invoiceDate.toISOString().slice(0, 10)}`, 40, topY + 15);
    doc.text(`Place of Supply: ${invoice.placeOfSupply}`, 40, topY + 30);

    doc.text(`Bill To: ${invoice.customer.name}`, 300, topY);
    doc.text(`GSTIN: ${invoice.customer.gstin || 'Unregistered'}`, 300, topY + 15);
    doc.text(`Billing: ${invoice.billingAddress}`, 300, topY + 30, { width: 250 });
    doc.text(`Shipping: ${invoice.shippingAddress}`, 300, topY + 60, { width: 250 });

    doc.y = topY + 100;
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Table Header
    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Item / Description', 45, tableTop);
    doc.text('HSN', 180, tableTop);
    doc.text('Qty', 230, tableTop);
    doc.text('Rate', 270, tableTop);
    doc.text('Taxable', 320, tableTop);
    doc.text('CGST', 380, tableTop);
    doc.text('SGST', 430, tableTop);
    doc.text('IGST', 480, tableTop);
    doc.text('Total (Rs.)', 510, tableTop, { align: 'right', width: 45 });

    doc.strokeColor('#9ca3af').lineWidth(0.5).moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).stroke();
    doc.font('Helvetica').fontSize(8.5);

    let rowY = tableTop + 20;
    for (const item of invoice.items) {
      doc.text(item.description, 45, rowY, { width: 130 });
      doc.text(item.hsnCode, 180, rowY);
      doc.text(`${item.quantity} ${item.unit}`, 230, rowY);
      doc.text(`Rs. ${Number(item.unitPrice).toFixed(2)}`, 270, rowY);
      doc.text(`Rs. ${Number(item.taxableAmount).toFixed(2)}`, 320, rowY);
      doc.text(`Rs. ${Number(item.cgstAmount).toFixed(2)}`, 380, rowY);
      doc.text(`Rs. ${Number(item.sgstAmount).toFixed(2)}`, 430, rowY);
      doc.text(`Rs. ${Number(item.igstAmount).toFixed(2)}`, 480, rowY);
      doc.text(`Rs. ${Number(item.totalAmount).toFixed(2)}`, 505, rowY, { align: 'right', width: 50 });
      rowY += 20;
    }

    doc.strokeColor('#9ca3af').lineWidth(0.5).moveTo(40, rowY).lineTo(555, rowY).stroke();
    rowY += 10;

    // Totals Box
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`Total Taxable Amount:`, 320, rowY);
    doc.text(`Rs. ${Number(invoice.totalTaxable).toFixed(2)}`, 480, rowY, { align: 'right', width: 75 });
    rowY += 15;

    if (Number(invoice.cgstAmount) > 0) {
      doc.text(`CGST (2.5%):`, 320, rowY);
      doc.text(`Rs. ${Number(invoice.cgstAmount).toFixed(2)}`, 480, rowY, { align: 'right', width: 75 });
      rowY += 15;
      doc.text(`SGST (2.5%):`, 320, rowY);
      doc.text(`Rs. ${Number(invoice.sgstAmount).toFixed(2)}`, 480, rowY, { align: 'right', width: 75 });
      rowY += 15;
    }

    if (Number(invoice.igstAmount) > 0) {
      doc.text(`IGST (5%):`, 320, rowY);
      doc.text(`Rs. ${Number(invoice.igstAmount).toFixed(2)}`, 480, rowY, { align: 'right', width: 75 });
      rowY += 15;
    }

    doc.fontSize(11).fillColor('#15803d');
    doc.text(`Grand Total:`, 320, rowY);
    doc.text(`Rs. ${Number(invoice.grandTotal).toFixed(2)}`, 480, rowY, { align: 'right', width: 75 });
    doc.fillColor('#000000');

    rowY += 40;
    doc.fontSize(8.5).font('Helvetica');
    doc.text('Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', 45, rowY, { width: 300 });
    doc.text('For FactoryFlow Foods Pvt. Ltd.', 400, rowY);
    doc.text('Authorized Signatory', 400, rowY + 35);

    return doc;
  }
}
