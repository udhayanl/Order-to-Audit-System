import { Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

export interface AgeingBucket {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  daysAbove90: number;
  total: number;
}

export class ReceivablesPayablesService {
  /**
   * Accounts Receivable (AR) Summary
   */
  static async getReceivablesSummary() {
    const invoices = await prisma.invoice.findMany({
      where: { status: { not: 'CANCELLED' } },
    });

    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;

    const now = new Date();

    for (const inv of invoices) {
      const g = Number(inv.grandTotal);
      const p = Number(inv.paidAmount);
      const out = Number(inv.outstandingAmount);

      totalInvoiced += g;
      totalCollected += p;
      totalOutstanding += out;

      if (out > 0 && new Date(inv.dueDate) < now) {
        totalOverdue += out;
      }
    }

    const advancePayments = await prisma.payment.aggregate({
      where: { advanceAmount: { gt: 0 }, status: 'POSTED' },
      _sum: { advanceAmount: true },
    });
    const totalUnallocatedAdvances = Number(advancePayments._sum.advanceAmount || 0);

    return {
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      totalUnallocatedAdvances: Math.round(totalUnallocatedAdvances * 100) / 100,
      netReceivables: Math.round((totalOutstanding - totalUnallocatedAdvances) * 100) / 100,
      invoiceCount: invoices.length,
    };
  }

  /**
   * Customer-wise Ageing Schedule (Current, 1-30, 31-60, 61-90, >90)
   */
  static async getCustomerAgeingSchedule() {
    const customers = await prisma.customer.findMany({
      where: { active: true },
      include: {
        invoices: {
          where: {
            status: { in: ['POSTED', 'PARTIALLY_PAID'] },
            outstandingAmount: { gt: 0 },
          },
          orderBy: { invoiceDate: 'asc' },
        },
      },
    });

    const now = new Date();
    const result = [];
    const totals: AgeingBucket = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      daysAbove90: 0,
      total: 0,
    };

    for (const cust of customers) {
      if (cust.invoices.length === 0) continue;

      let cTotal = 0;
      let cCurrent = 0;
      let c1_30 = 0;
      let c31_60 = 0;
      let c61_90 = 0;
      let cAbove90 = 0;

      const invoiceDetails = [];

      for (const inv of cust.invoices) {
        const out = Number(inv.outstandingAmount);
        cTotal += out;

        const diffTime = Math.abs(now.getTime() - new Date(inv.invoiceDate).getTime());
        const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const isOverdue = new Date(inv.dueDate) < now;

        invoiceDetails.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          grandTotal: Number(inv.grandTotal),
          paidAmount: Number(inv.paidAmount),
          outstandingAmount: out,
          ageDays,
          isOverdue,
        });

        if (ageDays <= 0) {
          cCurrent += out;
        } else if (ageDays <= 30) {
          c1_30 += out;
        } else if (ageDays <= 60) {
          c31_60 += out;
        } else if (ageDays <= 90) {
          c61_90 += out;
        } else {
          cAbove90 += out;
        }
      }

      totals.current += cCurrent;
      totals.days1_30 += c1_30;
      totals.days31_60 += c31_60;
      totals.days61_90 += c61_90;
      totals.daysAbove90 += cAbove90;
      totals.total += cTotal;

      result.push({
        customerId: cust.id,
        customerName: cust.name,
        customerType: cust.type,
        gstin: cust.gstin,
        state: cust.state,
        creditLimit: Number(cust.creditLimit),
        paymentTerms: cust.paymentTerms,
        totalOutstanding: Math.round(cTotal * 100) / 100,
        current: Math.round(cCurrent * 100) / 100,
        days1_30: Math.round(c1_30 * 100) / 100,
        days31_60: Math.round(c31_60 * 100) / 100,
        days61_90: Math.round(c61_90 * 100) / 100,
        daysAbove90: Math.round(cAbove90 * 100) / 100,
        invoices: invoiceDetails,
      });
    }

    return {
      asOfDate: now,
      totals: {
        current: Math.round(totals.current * 100) / 100,
        days1_30: Math.round(totals.days1_30 * 100) / 100,
        days31_60: Math.round(totals.days31_60 * 100) / 100,
        days61_90: Math.round(totals.days61_90 * 100) / 100,
        daysAbove90: Math.round(totals.daysAbove90 * 100) / 100,
        total: Math.round(totals.total * 100) / 100,
      },
      customers: result.sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    };
  }

  /**
   * Customer Statement of Account (Invoices, Receipts, Credit Notes, Running Balance)
   */
  static async getCustomerStatement(customerId: string, startDate?: Date | string, endDate?: Date | string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new AppError('Customer not found.', 404);

    const invoices = await prisma.invoice.findMany({
      where: { customerId, status: { not: 'CANCELLED' } },
      orderBy: { invoiceDate: 'asc' },
    });

    const payments = await prisma.payment.findMany({
      where: { customerId, status: 'POSTED' },
      orderBy: { paymentDate: 'asc' },
    });

    const creditNotes = await prisma.creditNote.findMany({
      where: { customerId, status: 'POSTED' },
      orderBy: { issueDate: 'asc' },
    });

    const ledgerEntries: any[] = [];

    for (const inv of invoices) {
      ledgerEntries.push({
        date: inv.invoiceDate,
        type: 'INVOICE',
        referenceNumber: inv.invoiceNumber,
        description: `Tax Invoice (${inv.financialYear})`,
        debit: Number(inv.grandTotal),
        credit: 0,
      });
    }

    for (const pmt of payments) {
      ledgerEntries.push({
        date: pmt.paymentDate,
        type: 'PAYMENT',
        referenceNumber: pmt.paymentNumber,
        description: `Receipt (${pmt.paymentMethod}) ${pmt.referenceNumber ? '- Ref: ' + pmt.referenceNumber : ''}`,
        debit: 0,
        credit: Number(pmt.amount),
      });
    }

    for (const cn of creditNotes) {
      ledgerEntries.push({
        date: cn.issueDate,
        type: 'CREDIT_NOTE',
        referenceNumber: cn.creditNoteNumber,
        description: `Credit Note - ${cn.reason}`,
        debit: 0,
        credit: Number(cn.totalAmount),
      });
    }

    // Sort chronologically
    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const finalEntries = ledgerEntries.map(e => {
      runningBalance += (e.debit - e.credit);
      return {
        ...e,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        type: customer.type,
        gstin: customer.gstin,
        billingAddress: customer.billingAddress,
        creditLimit: Number(customer.creditLimit),
      },
      currentBalance: Math.round(runningBalance * 100) / 100,
      statement: finalEntries,
    };
  }

  /**
   * Accounts Payable (AP) Summary
   */
  static async getPayablesSummary() {
    const purchases = await prisma.purchase.findMany({
      where: { status: { not: 'CANCELLED' } },
    });

    let totalPurchases = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    for (const p of purchases) {
      const g = Number(p.grandTotal);
      const paid = Number(p.paidAmount || 0);
      const out = p.outstandingAmount !== null ? Number(p.outstandingAmount) : Math.max(0, g - paid);

      totalPurchases += g;
      totalPaid += paid;
      totalOutstanding += out;
    }

    const supplierAdvances = await prisma.supplierPayment.aggregate({
      where: { advanceAmount: { gt: 0 }, status: 'POSTED' },
      _sum: { advanceAmount: true },
    });
    const totalSupplierAdvances = Number(supplierAdvances._sum.advanceAmount || 0);

    return {
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalSupplierAdvances: Math.round(totalSupplierAdvances * 100) / 100,
      netPayables: Math.round((totalOutstanding - totalSupplierAdvances) * 100) / 100,
      purchaseCount: purchases.length,
    };
  }

  /**
   * Supplier Ageing Schedule (Current, 1-30, 31-60, 61-90, >90)
   */
  static async getSupplierAgeingSchedule() {
    const suppliers = await prisma.supplier.findMany({
      where: { active: true },
      include: {
        purchases: {
          where: {
            status: { not: 'CANCELLED' },
            paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
          },
          orderBy: { purchaseDate: 'asc' },
        },
      },
    });

    const now = new Date();
    const result = [];
    const totals: AgeingBucket = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      daysAbove90: 0,
      total: 0,
    };

    for (const sup of suppliers) {
      let sTotal = 0;
      let sCurrent = 0;
      let s1_30 = 0;
      let s31_60 = 0;
      let s61_90 = 0;
      let sAbove90 = 0;

      const purchaseDetails = [];

      for (const pur of sup.purchases) {
        const grandTotal = Number(pur.grandTotal);
        const paid = Number(pur.paidAmount || 0);
        const out = pur.outstandingAmount !== null ? Number(pur.outstandingAmount) : Math.max(0, grandTotal - paid);

        if (out <= 0.01) continue;

        sTotal += out;
        const diffTime = Math.abs(now.getTime() - new Date(pur.purchaseDate).getTime());
        const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        purchaseDetails.push({
          id: pur.id,
          purchaseNumber: pur.purchaseNumber,
          supplierInvoiceNumber: pur.supplierInvoiceNumber,
          purchaseDate: pur.purchaseDate,
          grandTotal,
          paidAmount: paid,
          outstandingAmount: out,
          ageDays,
        });

        if (ageDays <= 0) {
          sCurrent += out;
        } else if (ageDays <= 30) {
          s1_30 += out;
        } else if (ageDays <= 60) {
          s31_60 += out;
        } else if (ageDays <= 90) {
          s61_90 += out;
        } else {
          sAbove90 += out;
        }
      }

      if (sTotal <= 0) continue;

      totals.current += sCurrent;
      totals.days1_30 += s1_30;
      totals.days31_60 += s31_60;
      totals.days61_90 += s61_90;
      totals.daysAbove90 += sAbove90;
      totals.total += sTotal;

      result.push({
        supplierId: sup.id,
        supplierName: sup.name,
        gstin: sup.gstin,
        state: sup.state,
        paymentTerms: sup.paymentTerms,
        totalOutstanding: Math.round(sTotal * 100) / 100,
        current: Math.round(sCurrent * 100) / 100,
        days1_30: Math.round(s1_30 * 100) / 100,
        days31_60: Math.round(s31_60 * 100) / 100,
        days61_90: Math.round(s61_90 * 100) / 100,
        daysAbove90: Math.round(sAbove90 * 100) / 100,
        purchases: purchaseDetails,
      });
    }

    return {
      asOfDate: now,
      totals: {
        current: Math.round(totals.current * 100) / 100,
        days1_30: Math.round(totals.days1_30 * 100) / 100,
        days31_60: Math.round(totals.days31_60 * 100) / 100,
        days61_90: Math.round(totals.days61_90 * 100) / 100,
        daysAbove90: Math.round(totals.daysAbove90 * 100) / 100,
        total: Math.round(totals.total * 100) / 100,
      },
      suppliers: result.sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    };
  }

  /**
   * Supplier Statement of Account
   */
  static async getSupplierStatement(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new AppError('Supplier not found.', 404);

    const purchases = await prisma.purchase.findMany({
      where: { supplierId, status: { not: 'CANCELLED' } },
      orderBy: { purchaseDate: 'asc' },
    });

    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId, status: 'POSTED' },
      orderBy: { paymentDate: 'asc' },
    });

    const ledgerEntries: any[] = [];

    for (const pur of purchases) {
      ledgerEntries.push({
        date: pur.purchaseDate,
        type: 'PURCHASE',
        referenceNumber: pur.purchaseNumber,
        description: `Purchase Invoice ${pur.supplierInvoiceNumber ? '(' + pur.supplierInvoiceNumber + ')' : ''}`,
        credit: Number(pur.grandTotal), // Supplier ledger has normal credit balance (we owe them)
        debit: 0,
      });
    }

    for (const pmt of payments) {
      ledgerEntries.push({
        date: pmt.paymentDate,
        type: 'PAYMENT',
        referenceNumber: pmt.paymentNumber,
        description: `Disbursement (${pmt.paymentMethod}) ${pmt.referenceNumber ? '- Ref: ' + pmt.referenceNumber : ''}`,
        credit: 0,
        debit: Number(pmt.amount), // Debit decreases our liability to supplier
      });
    }

    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const finalEntries = ledgerEntries.map(e => {
      runningBalance += (e.credit - e.debit);
      return {
        ...e,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        gstin: supplier.gstin,
        address: supplier.address,
        paymentTerms: supplier.paymentTerms,
      },
      currentPayableBalance: Math.round(runningBalance * 100) / 100,
      statement: finalEntries,
    };
  }
}
