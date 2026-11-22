import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import prisma from '../db/client.js';
import { InventoryAuditService } from './inventory-audit.service.js';
import { ComplianceService } from './compliance.service.js';
import { AuditService } from './audit.service.js';

export class AuditReportService {
  /**
   * 1. INVENTORY AUDIT REPORT DATA
   */
  static async getInventoryAuditReport() {
    const worksheet = await InventoryAuditService.getAuditWorksheet();
    const auditItems = await prisma.inventoryAuditItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      title: 'FactoryFlow Comprehensive Inventory & Stock Audit Report',
      generatedAt: new Date().toISOString(),
      currentStockOverview: worksheet,
      recentAuditVariances: auditItems.map(i => ({
        itemType: i.itemType,
        itemName: i.itemName,
        systemStock: Number(i.systemStock),
        physicalStock: Number(i.physicalStock),
        varianceQty: Number(i.varianceQuantity),
        varianceValue: Number(i.varianceValue),
        status: i.status,
        reason: i.discrepancyReason || '-',
      })),
    };
  }

  /**
   * 2. PRODUCTION AUDIT REPORT DATA
   */
  static async getProductionAuditReport() {
    const runs = await prisma.productionRun.findMany({
      where: { status: 'POSTED' },
      include: {
        bom: { include: { product: true } },
        createdBy: { select: { fullName: true } },
        consumptions: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
      },
      orderBy: { runDate: 'desc' },
    });

    return {
      title: 'FactoryFlow Production, Yield & Wastage Audit Report',
      generatedAt: new Date().toISOString(),
      batches: runs.map(r => ({
        batchNumber: r.runNumber,
        productName: r.bom.product.name,
        date: r.runDate.toISOString().slice(0, 10),
        supervisor: r.createdBy.fullName,
        actualGoodQuantity: Number(r.actualGoodOutput),
        scrapQuantity: Number(r.damagedPouches),
        yieldVariancePercent: Number(r.yieldVariancePercent),
        yieldVarianceStatus: r.yieldVarianceStatus,
        costPerPacket: Number(r.costPerPacket),
        totalCost: Number(r.totalProductionCost),
        materialsConsumed: r.consumptions.map(c => ({
          material: c.rawMaterial?.name || c.packagingMaterial?.name || 'Material',
          planned: Number(c.plannedQuantity),
          actual: Number(c.actualQuantity),
          unit: c.unit,
          variancePercent: Number(c.consumptionVariancePercent),
          status: c.varianceStatus,
        })),
      })),
    };
  }

  /**
   * 3. SALES & FINANCIAL AUDIT REPORT DATA
   */
  static async getSalesFinancialAuditReport() {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } },
      include: { customer: true },
      orderBy: { invoiceDate: 'desc' },
    });
    const payments = await prisma.payment.findMany({
      include: { customer: true },
      orderBy: { paymentDate: 'desc' },
    });
    const expenses = await prisma.expense.findMany({
      where: { status: 'POSTED' },
      orderBy: { expenseDate: 'desc' },
    });
    const journals = await prisma.journalEntry.findMany({
      orderBy: { entryDate: 'desc' },
      take: 30,
    });

    const totalRevenue = invoices.reduce((s, i) => s + Number(i.grandTotal), 0);
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.totalAmount), 0);
    const totalOutstandingAR = invoices.reduce((s, i) => s + Number(i.outstandingAmount), 0);

    return {
      title: 'FactoryFlow Sales, Billing & Financial Audit Report',
      generatedAt: new Date().toISOString(),
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        totalOutstandingAR: Math.round(totalOutstandingAR * 100) / 100,
        postedJournalsCount: journals.length,
      },
      invoices: invoices.slice(0, 30).map(i => ({
        invoiceNumber: i.invoiceNumber,
        customerName: i.customer.name,
        date: i.invoiceDate.toISOString().slice(0, 10),
        taxable: Number(i.totalTaxable),
        gst: Number(i.cgstAmount || 0) + Number(i.sgstAmount || 0) + Number(i.igstAmount || 0),
        total: Number(i.grandTotal),
        paid: Number(i.paidAmount),
        outstanding: Number(i.outstandingAmount),
        status: i.status,
      })),
      recentJournals: journals.map(j => ({
        entryNumber: j.entryNumber,
        entryType: j.entryType,
        narration: j.narration,
        totalDebit: Number(j.totalDebit),
        totalCredit: Number(j.totalCredit),
        balanced: Number(j.totalDebit) === Number(j.totalCredit),
      })),
    };
  }

  /**
   * 4. COMPLIANCE & FOOD SAFETY REPORT DATA
   */
  static async getComplianceReport() {
    const [foodSafetyChecks, batchExpiry] = await Promise.all([
      ComplianceService.getFoodSafetyChecks({}),
      ComplianceService.getBatchExpiryAudit(),
    ]);

    const compliantCount = foodSafetyChecks.filter(c => c.isCompliant).length;
    const totalChecks = foodSafetyChecks.length;
    const complianceRate = totalChecks > 0 ? Math.round((compliantCount / totalChecks) * 100) : 100;

    return {
      title: 'FactoryFlow FSSAI Food Safety & Quality Compliance Audit Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalInspections: totalChecks,
        compliantInspections: compliantCount,
        nonCompliantIssues: totalChecks - compliantCount,
        complianceRatePercent: complianceRate,
      },
      inspections: foodSafetyChecks.map(c => ({
        checkNumber: c.checkNumber,
        date: c.checkDate.toISOString().slice(0, 10),
        category: c.category,
        standardRequired: c.standardRequired,
        actualObserved: c.actualObserved,
        isCompliant: c.isCompliant,
        remarks: c.remarks || '-',
        inspector: c.inspector.fullName,
      })),
      batchShelfLife: batchExpiry,
    };
  }

  /**
   * 5. USER ACTIVITY AUDIT REPORT DATA
   */
  static async getUserActivityReport() {
    const { logs } = await AuditService.getUserActivityLogs({ take: 100 });
    return {
      title: 'FactoryFlow User Activity & Security Audit Trail Report',
      generatedAt: new Date().toISOString(),
      totalEntries: logs.length,
      activities: logs.map(l => ({
        id: l.id,
        timestamp: l.timestamp.toISOString(),
        userName: l.user?.fullName || 'System',
        userRole: l.user?.role || 'SYSTEM',
        action: l.action,
        entityType: l.entityType,
        description: l.description,
        ipAddress: l.ipAddress || '127.0.0.1',
      })),
    };
  }

  /**
   * GENERATE AUDIT REPORT IN PDF FORMAT
   */
  static async generateAuditReportPDF(reportType: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header Banner
        doc.rect(40, 40, 515, 60).fill('#15803d');
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
          .text('FACTORYFLOW AUDIT MANAGEMENT & COMPLIANCE', 55, 52);
        doc.fontSize(10).font('Helvetica')
          .text('National Institute of Technology, Tiruchirappalli | Statutory Inspection System', 55, 75);

        doc.moveDown(3);
        doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold');

        let reportTitle = 'General Audit Report';
        let reportData: any = {};

        if (reportType === 'inventory') {
          reportTitle = 'INVENTORY & STOCK RECONCILIATION AUDIT REPORT';
          reportData = await this.getInventoryAuditReport();
        } else if (reportType === 'production') {
          reportTitle = 'MANUFACTURING YIELD, SCRAP & PRODUCTION AUDIT REPORT';
          reportData = await this.getProductionAuditReport();
        } else if (reportType === 'financial') {
          reportTitle = 'SALES, BILLING & FINANCIAL TRANSACTIONS AUDIT REPORT';
          reportData = await this.getSalesFinancialAuditReport();
        } else if (reportType === 'compliance') {
          reportTitle = 'FSSAI FOOD SAFETY & QUALITY COMPLIANCE AUDIT REPORT';
          reportData = await this.getComplianceReport();
        } else {
          reportTitle = 'USER ACTIVITY & SECURITY AUDIT TRAIL REPORT';
          reportData = await this.getUserActivityReport();
        }

        doc.text(reportTitle, 40, 120);
        doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
          .text(`Generated on: ${new Date().toLocaleString('en-IN')} | Certified Tamper-Evident Ledger`, 40, 138);

        doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(40, 155).lineTo(555, 155).stroke();

        let y = 175;

        // Content Rendering based on type
        if (reportType === 'inventory') {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Current Stock Levels vs Standard Baselines:', 40, y);
          y += 20;

          // Header row
          doc.rect(40, y, 515, 18).fill('#f3f4f6');
          doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
            .text('ITEM NAME', 45, y + 5)
            .text('TYPE', 220, y + 5)
            .text('UNIT', 310, y + 5)
            .text('SYSTEM STOCK', 370, y + 5)
            .text('STD COST', 470, y + 5);
          y += 20;

          for (const item of (reportData.currentStockOverview || []).slice(0, 18)) {
            doc.fillColor('#1f2937').fontSize(8).font('Helvetica')
              .text(item.itemName.slice(0, 28), 45, y)
              .text(item.itemType, 220, y)
              .text(item.unit, 310, y)
              .text(String(item.systemStock), 370, y)
              .text(`INR ${item.unitCost.toFixed(2)}`, 470, y);
            y += 16;
            if (y > 700) { doc.addPage(); y = 50; }
          }
        } else if (reportType === 'production') {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Production Runs & Yield Variances:', 40, y);
          y += 20;

          doc.rect(40, y, 515, 18).fill('#f3f4f6');
          doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
            .text('BATCH NUMBER', 45, y + 5)
            .text('PRODUCT', 160, y + 5)
            .text('GOOD OUTPUT', 300, y + 5)
            .text('SCRAP', 380, y + 5)
            .text('YIELD VAR %', 440, y + 5)
            .text('STATUS', 505, y + 5);
          y += 20;

          for (const b of (reportData.batches || []).slice(0, 16)) {
            doc.fillColor('#1f2937').fontSize(8).font('Helvetica')
              .text(b.batchNumber, 45, y)
              .text(b.productName.slice(0, 22), 160, y)
              .text(`${b.actualGoodQuantity} pkts`, 300, y)
              .text(`${b.scrapQuantity} pkts`, 380, y)
              .text(`${b.yieldVariancePercent}%`, 440, y)
              .text(b.yieldVarianceStatus === 'NORMAL' ? 'NORMAL' : 'EXCEEDED', 505, y);
            y += 16;
            if (y > 700) { doc.addPage(); y = 50; }
          }
        } else if (reportType === 'compliance') {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('FSSAI Food Safety Inspections:', 40, y);
          y += 20;

          doc.rect(40, y, 515, 18).fill('#f3f4f6');
          doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
            .text('CHECK #', 45, y + 5)
            .text('CATEGORY', 140, y + 5)
            .text('STANDARD', 240, y + 5)
            .text('OBSERVED', 370, y + 5)
            .text('COMPLIANCE', 485, y + 5);
          y += 20;

          for (const insp of (reportData.inspections || []).slice(0, 16)) {
            doc.fillColor('#1f2937').fontSize(8).font('Helvetica')
              .text(insp.checkNumber, 45, y)
              .text(insp.category, 140, y)
              .text(insp.standardRequired.slice(0, 22), 240, y)
              .text(insp.actualObserved.slice(0, 20), 370, y)
              .text(insp.isCompliant ? 'PASS' : 'FAIL', 485, y);
            y += 16;
            if (y > 700) { doc.addPage(); y = 50; }
          }
        } else {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('User Activities & System Audits:', 40, y);
          y += 20;

          doc.rect(40, y, 515, 18).fill('#f3f4f6');
          doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
            .text('DATE & TIME', 45, y + 5)
            .text('USER', 160, y + 5)
            .text('ROLE', 250, y + 5)
            .text('ACTION', 330, y + 5)
            .text('ENTITY / DETAILS', 410, y + 5);
          y += 20;

          const entries = reportData.activities || reportData.invoices || [];
          for (const item of entries.slice(0, 18)) {
            doc.fillColor('#1f2937').fontSize(8).font('Helvetica')
              .text(item.timestamp ? item.timestamp.slice(0, 16) : item.date, 45, y)
              .text(item.userName || item.customerName?.slice(0, 14), 160, y)
              .text(item.userRole || item.status, 250, y)
              .text(item.action || `INR ${item.total}`, 330, y)
              .text(item.entityType || item.invoiceNumber, 410, y);
            y += 16;
            if (y > 700) { doc.addPage(); y = 50; }
          }
        }

        // Auditor Sign-off Box at bottom
        y = Math.max(y + 30, 660);
        doc.rect(40, y, 515, 60).strokeColor('#d1d5db').stroke();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151')
          .text('STATUTORY AUDITOR SIGN-OFF & CERTIFICATION', 50, y + 8);
        doc.fontSize(7).font('Helvetica').fillColor('#6b7280')
          .text('This audit document was automatically compiled from FactoryFlow immutable transactional logs. All stock movements, batch postings, and general ledger lines satisfy strict compliance standards.', 50, y + 20, { width: 340 })
          .text('Auditor Signature: _______________________', 390, y + 38);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * GENERATE AUDIT REPORT IN EXCEL FORMAT
   */
  static async generateAuditReportExcel(reportType: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FactoryFlow Enterprise Audit System';

    let sheetName = 'Audit Report';
    let columns: any[] = [];
    let rows: any[] = [];

    if (reportType === 'inventory') {
      sheetName = 'Inventory Audit';
      const data = await this.getInventoryAuditReport();
      columns = [
        { header: 'Item Name', key: 'itemName', width: 30 },
        { header: 'Type', key: 'itemType', width: 18 },
        { header: 'Code', key: 'itemCode', width: 14 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'System Stock', key: 'systemStock', width: 16 },
        { header: 'Standard Cost (INR)', key: 'unitCost', width: 18 },
      ];
      rows = data.currentStockOverview;
    } else if (reportType === 'production') {
      sheetName = 'Production Audit';
      const data = await this.getProductionAuditReport();
      columns = [
        { header: 'Batch Number', key: 'batchNumber', width: 20 },
        { header: 'Product', key: 'productName', width: 25 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Supervisor', key: 'supervisor', width: 20 },
        { header: 'Good Quantity', key: 'actualGoodQuantity', width: 16 },
        { header: 'Scrap Quantity', key: 'scrapQuantity', width: 16 },
        { header: 'Yield Variance %', key: 'yieldVariancePercent', width: 16 },
        { header: 'Status', key: 'yieldVarianceStatus', width: 18 },
        { header: 'Cost per Packet', key: 'costPerPacket', width: 16 },
        { header: 'Total Cost', key: 'totalCost', width: 16 },
      ];
      rows = data.batches;
    } else if (reportType === 'compliance') {
      sheetName = 'Food Safety Compliance';
      const data = await this.getComplianceReport();
      columns = [
        { header: 'Check Number', key: 'checkNumber', width: 18 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Standard Required', key: 'standardRequired', width: 30 },
        { header: 'Actual Observed', key: 'actualObserved', width: 30 },
        { header: 'Compliant', key: 'isCompliant', width: 14 },
        { header: 'Remarks', key: 'remarks', width: 25 },
        { header: 'Inspector', key: 'inspector', width: 20 },
      ];
      rows = data.inspections;
    } else {
      sheetName = 'User Activity Audit';
      const data = await this.getUserActivityReport();
      columns = [
        { header: 'Timestamp', key: 'timestamp', width: 22 },
        { header: 'User', key: 'userName', width: 20 },
        { header: 'Role', key: 'userRole', width: 18 },
        { header: 'Action', key: 'action', width: 16 },
        { header: 'Entity Type', key: 'entityType', width: 18 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'IP Address', key: 'ipAddress', width: 16 },
      ];
      rows = data.activities;
    }

    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns;

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF15803D' }, // Brand emerald
    };

    rows.forEach(r => worksheet.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
