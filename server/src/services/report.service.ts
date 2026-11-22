import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ItemType } from '@prisma/client';
import prisma from '../db/client.js';
import { InventoryService } from './inventory.service.js';

export class ReportService {
  /**
   * 1. Sales Register
   */
  static async getSalesRegister(startDate?: Date, endDate?: Date) {
    const where: any = { status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } };
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = startDate;
      if (endDate) where.invoiceDate.lte = endDate;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        items: { include: { product: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const rows = [];
    for (const inv of invoices) {
      for (const item of inv.items) {
        rows.push({
          invoiceNumber: inv.invoiceNumber,
          date: inv.invoiceDate.toISOString().slice(0, 10),
          customerName: inv.customer.name,
          customerGstin: inv.customer.gstin || 'Unregistered',
          state: inv.customer.state,
          productName: item.description,
          hsnCode: item.hsnCode,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          taxableAmount: Number(item.taxableAmount),
          gstRate: Number(item.gstRate),
          cgstAmount: Number(item.cgstAmount),
          sgstAmount: Number(item.sgstAmount),
          igstAmount: Number(item.igstAmount),
          totalAmount: Number(item.totalAmount),
        });
      }
    }
    return rows;
  }

  /**
   * 2. Customer-wise Sales
   */
  static async getCustomerWiseSales(startDate?: Date, endDate?: Date) {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } },
      include: { customer: true, items: true },
    });

    const summary: Record<string, any> = {};
    for (const inv of invoices) {
      const cId = inv.customerId;
      if (!summary[cId]) {
        summary[cId] = {
          customerId: cId,
          customerName: inv.customer.name,
          customerType: inv.customer.type,
          gstin: inv.customer.gstin || 'Unregistered',
          state: inv.customer.state,
          invoiceCount: 0,
          totalTaxable: 0,
          totalGst: 0,
          grandTotal: 0,
          totalPaid: 0,
          totalOutstanding: 0,
        };
      }
      summary[cId].invoiceCount += 1;
      summary[cId].totalTaxable += Number(inv.totalTaxable);
      summary[cId].totalGst += Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount);
      summary[cId].grandTotal += Number(inv.grandTotal);
      summary[cId].totalPaid += Number(inv.paidAmount);
      summary[cId].totalOutstanding += Number(inv.outstandingAmount);
    }

    return Object.values(summary).map(s => ({
      ...s,
      totalTaxable: Math.round(s.totalTaxable * 100) / 100,
      totalGst: Math.round(s.totalGst * 100) / 100,
      grandTotal: Math.round(s.grandTotal * 100) / 100,
      totalPaid: Math.round(s.totalPaid * 100) / 100,
      totalOutstanding: Math.round(s.totalOutstanding * 100) / 100,
    }));
  }

  /**
   * 3. Product-wise Sales
   */
  static async getProductWiseSales() {
    const items = await prisma.invoiceItem.findMany({
      where: { invoice: { status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } } },
      include: { product: true },
    });

    const summary: Record<string, any> = {};
    for (const item of items) {
      const pId = item.productId;
      if (!summary[pId]) {
        summary[pId] = {
          productId: pId,
          productName: item.product.name,
          sku: item.product.sku,
          totalQuantity: 0,
          unit: item.unit,
          totalTaxable: 0,
          totalCgst: 0,
          totalSgst: 0,
          totalIgst: 0,
          totalAmount: 0,
        };
      }
      summary[pId].totalQuantity += Number(item.quantity);
      summary[pId].totalTaxable += Number(item.taxableAmount);
      summary[pId].totalCgst += Number(item.cgstAmount);
      summary[pId].totalSgst += Number(item.sgstAmount);
      summary[pId].totalIgst += Number(item.igstAmount);
      summary[pId].totalAmount += Number(item.totalAmount);
    }

    return Object.values(summary).map(s => ({
      ...s,
      totalTaxable: Math.round(s.totalTaxable * 100) / 100,
      totalCgst: Math.round(s.totalCgst * 100) / 100,
      totalSgst: Math.round(s.totalSgst * 100) / 100,
      totalIgst: Math.round(s.totalIgst * 100) / 100,
      totalAmount: Math.round(s.totalAmount * 100) / 100,
    }));
  }

  /**
   * 4. GST Summary (GSTR-1 & GSTR-3B structure)
   */
  static async getGSTSummary(startDate?: Date, endDate?: Date) {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } },
      include: { customer: true, items: true },
    });

    let b2bTaxable = 0;
    let b2cTaxable = 0;
    let intraTaxable = 0;
    let interTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const inv of invoices) {
      const taxable = Number(inv.totalTaxable);
      const cgst = Number(inv.cgstAmount);
      const sgst = Number(inv.sgstAmount);
      const igst = Number(inv.igstAmount);

      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      if (inv.customer.gstin && inv.customer.gstin.trim() !== '') {
        b2bTaxable += taxable;
      } else {
        b2cTaxable += taxable;
      }

      if (cgst > 0 || sgst > 0) {
        intraTaxable += taxable;
      } else {
        interTaxable += taxable;
      }
    }

    const totalTaxable = intraTaxable + interTaxable;
    const totalTax = totalCgst + totalSgst + totalIgst;

    return {
      gstr1: {
        table4_B2B: Math.round(b2bTaxable * 100) / 100,
        table7_B2C: Math.round(b2cTaxable * 100) / 100,
        intraStateSupplies: Math.round(intraTaxable * 100) / 100,
        interStateSupplies: Math.round(interTaxable * 100) / 100,
      },
      gstr3b: {
        outwardTaxableSupplies: Math.round(totalTaxable * 100) / 100,
        integratedTax: Math.round(totalIgst * 100) / 100,
        centralTax: Math.round(totalCgst * 100) / 100,
        stateUtTax: Math.round(totalSgst * 100) / 100,
        totalTaxLiability: Math.round(totalTax * 100) / 100,
      },
    };
  }

  /**
   * 5. Purchase Register
   */
  static async getPurchaseRegister() {
    const purchases = await prisma.purchase.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    });

    const rows = [];
    for (const p of purchases) {
      for (const item of p.items) {
        rows.push({
          purchaseNumber: p.purchaseNumber,
          date: p.purchaseDate.toISOString().slice(0, 10),
          supplierName: p.supplier.name,
          supplierGstin: p.supplier.gstin || 'Unregistered',
          itemName: item.rawMaterial?.name || item.packagingMaterial?.name || 'Item',
          itemType: item.itemType,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          taxableAmount: Number(item.taxableAmount),
          gstAmount: Number(item.gstAmount),
          totalAmount: Number(item.totalAmount),
        });
      }
    }
    return rows;
  }

  /**
   * 6. Stock Summary (All 3 inventories: Raw, Packaging, Finished Goods)
   */
  static async getStockSummary() {
    const rawMaterials = await prisma.rawMaterial.findMany();
    const packagingMaterials = await prisma.packagingMaterial.findMany();
    const products = await prisma.product.findMany();

    const rawList = [];
    for (const rm of rawMaterials) {
      const currentStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, rm.id);
      rawList.push({
        id: rm.id,
        code: rm.code,
        name: rm.name,
        type: 'RAW_MATERIAL',
        uom: rm.uom,
        openingStock: Number(rm.openingStock),
        currentStock,
        reorderLevel: Number(rm.reorderLevel),
        isLowStock: currentStock <= Number(rm.reorderLevel),
        unitPrice: Number(rm.purchasePrice),
        stockValue: Math.round(currentStock * Number(rm.purchasePrice) * 100) / 100,
      });
    }

    const pkgList = [];
    for (const pkg of packagingMaterials) {
      const currentStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, pkg.id);
      pkgList.push({
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        type: 'PACKAGING',
        uom: pkg.uom,
        openingStock: Number(pkg.openingStock),
        currentStock,
        unitPrice: Number(pkg.purchasePrice),
        stockValue: Math.round(currentStock * Number(pkg.purchasePrice) * 100) / 100,
      });
    }

    const fgList = [];
    for (const prod of products) {
      const currentStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, prod.id);
      fgList.push({
        id: prod.id,
        code: prod.sku,
        name: prod.name,
        type: 'FINISHED_GOOD',
        uom: prod.unit,
        currentStock,
        reorderLevel: Number(prod.reorderLevel),
        isLowStock: currentStock <= Number(prod.reorderLevel),
        sellingPrice: Number(prod.sellingPrice),
        stockValue: Math.round(currentStock * Number(prod.sellingPrice) * 100) / 100,
      });
    }

    return {
      rawMaterials: rawList,
      packagingMaterials: pkgList,
      finishedGoods: fgList,
    };
  }

  /**
   * 7. Stock Ledger History
   */
  static async getStockLedger(itemType?: ItemType, itemId?: string) {
    const where: any = {};
    if (itemType) where.itemType = itemType;
    if (itemId) where.itemId = itemId;

    const entries = await prisma.stockLedger.findMany({
      where,
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(e => ({
      id: e.id,
      date: e.createdAt.toISOString(),
      itemType: e.itemType,
      itemId: e.itemId,
      movementType: e.movementType,
      quantity: Number(e.quantity),
      balanceAfter: Number(e.balanceAfter),
      unit: e.unit,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      notes: e.notes,
      userName: e.user?.fullName || 'System',
    }));
  }

  /**
   * 8. Production Report
   */
  static async getProductionReport() {
    const runs = await prisma.productionRun.findMany({
      include: {
        product: true,
        bom: true,
        consumptions: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
      },
      orderBy: { runDate: 'desc' },
    });

    return runs.map(run => ({
      id: run.id,
      runNumber: run.runNumber,
      date: run.runDate.toISOString().slice(0, 10),
      productName: run.product.name,
      plannedBatch: Number(run.plannedBatchQuantity),
      expectedYield: Number(run.expectedOutput),
      actualGoodOutput: Number(run.actualGoodOutput),
      yieldVariancePercent: Number(run.yieldVariancePercent),
      yieldVarianceStatus: run.yieldVarianceStatus,
      damagedPouches: Number(run.damagedPouches),
      cartonsUsed: Number(run.cartonsUsed),
      totalMaterialCost: Number(run.totalMaterialCost),
      labourCost: Number(run.labourCost),
      powerCost: Number(run.powerCost),
      otherOverheads: Number(run.otherOverheads),
      totalProductionCost: Number(run.totalProductionCost),
      costPerPacket: Number(run.costPerPacket),
      consumptions: run.consumptions.map(c => ({
        materialName: c.rawMaterial?.name || c.packagingMaterial?.name || 'Item',
        planned: Number(c.plannedQuantity),
        actual: Number(c.actualQuantity),
        unit: c.unit,
        variancePercent: Number(c.consumptionVariancePercent),
        varianceStatus: c.varianceStatus,
        cost: Number(c.totalCost),
      })),
    }));
  }

  /**
   * Export JSON data to Excel buffer using ExcelJS
   */
  static async exportToExcel(sheetName: string, columns: { header: string; key: string; width: number }[], data: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FactoryFlow Enterprise';
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns;

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF15803D' }, // Brand green
    };

    data.forEach(row => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export JSON data to CSV string
   */
  static exportToCSV(columns: { header: string; key: string }[], data: any[]): string {
    const headers = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(item => {
      return columns.map(c => {
        const val = item[c.key] !== undefined && item[c.key] !== null ? String(item[c.key]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });
    return [headers, ...rows].join('\n');
  }
}
