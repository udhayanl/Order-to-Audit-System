import { Prisma, OrderStatus, InvoiceStatus, Role } from '@prisma/client';
import prisma from '../db/client.js';

export class SalesDashboardService {
  /**
   * Get comprehensive real-time Sales Dashboard statistics
   */
  static async getDashboardSummary(userId?: string, role?: Role) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Salesman scope filter if role is SALESMAN
    const isSalesman = role === Role.SALESMAN && userId;
    const orderWhere: Prisma.SalesOrderWhereInput = isSalesman ? { salesmanId: userId } : {};

    const todayOrders = await prisma.salesOrder.aggregate({
      where: {
        ...orderWhere,
        orderDate: { gte: todayStart },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
      },
      _sum: { grandTotal: true },
      _count: { id: true },
    });

    const monthOrders = await prisma.salesOrder.aggregate({
      where: {
        ...orderWhere,
        orderDate: { gte: monthStart },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
      },
      _sum: { grandTotal: true },
      _count: { id: true },
    });

    const pendingApprovalCount = await prisma.salesOrder.count({
      where: { ...orderWhere, status: { in: [OrderStatus.SUBMITTED, OrderStatus.PENDING_APPROVAL] } },
    });

    const approvedCount = await prisma.salesOrder.count({
      where: { ...orderWhere, status: OrderStatus.APPROVED },
    });

    const allocatedCount = await prisma.salesOrder.count({
      where: { ...orderWhere, status: { in: [OrderStatus.ALLOCATED, OrderStatus.PARTIALLY_ALLOCATED] } },
    });

    const dispatchedTodayCount = await prisma.dispatch.count({
      where: { dispatchDate: { gte: todayStart } },
    });

    const totalCustomers = isSalesman
      ? await prisma.customer.count({ where: { salesmanId: userId, active: true } })
      : await prisma.customer.count({ where: { active: true } });

    const invoicesAggregate = await prisma.invoice.aggregate({
      where: { status: InvoiceStatus.POSTED },
      _sum: {
        grandTotal: true,
        paidAmount: true,
        outstandingAmount: true,
        totalTaxable: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
      },
      _count: { id: true },
    });

    const recentOrders = await prisma.salesOrder.findMany({
      where: orderWhere,
      take: 8,
      orderBy: { orderDate: 'desc' },
      include: {
        customer: { select: { id: true, name: true, city: true, type: true } },
        salesman: { select: { id: true, fullName: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });

    // Product breakdown
    const productItems = await prisma.salesOrderItem.groupBy({
      by: ['productId'],
      where: {
        salesOrder: {
          ...orderWhere,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
        },
      },
      _sum: { quantity: true, totalAmount: true },
    });

    const productDetails = await prisma.product.findMany({
      where: { id: { in: productItems.map((p) => p.productId) } },
      select: { id: true, name: true, sku: true, category: { select: { name: true } } },
    });

    const productSales = productItems.map((item) => {
      const prod = productDetails.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        name: prod?.name || 'Unknown',
        sku: prod?.sku || '',
        category: prod?.category?.name || '',
        totalQuantity: Number(item._sum.quantity || 0),
        totalRevenue: Number(item._sum.totalAmount || 0),
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Retailer vs Distributor breakdown
    const customerTypeBreakdown = await prisma.salesOrder.findMany({
      where: {
        ...orderWhere,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
      },
      select: {
        grandTotal: true,
        customer: { select: { type: true } },
      },
    });

    let retailerRevenue = 0;
    let distributorRevenue = 0;
    for (const ord of customerTypeBreakdown) {
      const amt = Number(ord.grandTotal);
      if (ord.customer?.type === 'DISTRIBUTOR') {
        distributorRevenue += amt;
      } else {
        retailerRevenue += amt;
      }
    }

    return {
      kpis: {
        todayOrdersCount: todayOrders._count.id || 0,
        todaySalesRevenue: Number(todayOrders._sum.grandTotal || 0),
        monthOrdersCount: monthOrders._count.id || 0,
        monthSalesRevenue: Number(monthOrders._sum.grandTotal || 0),
        pendingApprovalCount,
        approvedCount,
        allocatedCount,
        dispatchesTodayCount: dispatchedTodayCount,
        activeCustomersCount: totalCustomers,
        totalInvoicedRevenue: Number(invoicesAggregate._sum.grandTotal || 0),
        totalOutstandingReceivables: Number(invoicesAggregate._sum.outstandingAmount || 0),
      },
      productSales,
      customerTypeSales: {
        retailer: Math.round(retailerRevenue * 100) / 100,
        distributor: Math.round(distributorRevenue * 100) / 100,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer.name,
        customerType: o.customer.type,
        city: o.customer.city,
        salesmanName: o.salesman.fullName,
        orderDate: o.orderDate,
        status: o.status,
        grandTotal: Number(o.grandTotal),
        itemsCount: o.items.length,
      })),
    };
  }

  /**
   * Get Salesman Performance Report
   */
  static async getSalesmanPerformance() {
    const salesmen = await prisma.user.findMany({
      where: { role: Role.SALESMAN, active: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });

    const performance = [];

    for (const sm of salesmen) {
      const ordersAgg = await prisma.salesOrder.aggregate({
        where: {
          salesmanId: sm.id,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
        },
        _count: { id: true },
        _sum: { grandTotal: true },
      });

      const assignedCustomersCount = await prisma.customer.count({
        where: { salesmanId: sm.id, active: true },
      });

      performance.push({
        salesmanId: sm.id,
        name: sm.fullName,
        email: sm.email,
        phone: sm.phone,
        totalOrders: ordersAgg._count.id || 0,
        totalRevenue: Number(ordersAgg._sum.grandTotal || 0),
        assignedCustomersCount,
      });
    }

    return performance.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Generate statutory GSTR-1 Outward Supplies Summary
   */
  static async getGSTR1Report(params: { month?: number; year?: number }) {
    const now = new Date();
    const year = params.year || now.getFullYear();
    const month = params.month !== undefined ? params.month : now.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const invoices = await prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: startDate, lte: endDate },
        status: InvoiceStatus.POSTED,
      },
      include: {
        customer: true,
        items: true,
      },
    });

    const b2bInvoices = [];
    const b2cInvoices = [];
    const hsnSummaryMap: Record<string, { hsn: string; description: string; qty: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }> = {};

    let totalB2BTaxable = 0;
    let totalB2BGst = 0;
    let totalB2CTaxable = 0;
    let totalB2CGst = 0;

    for (const inv of invoices) {
      const hasGSTIN = Boolean(inv.customer.gstin && inv.customer.gstin.trim().length === 15);
      const taxable = Number(inv.totalTaxable);
      const gst = Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount);

      const invData = {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customer.name,
        customerGstin: inv.customer.gstin,
        placeOfSupply: inv.placeOfSupply,
        taxableAmount: taxable,
        cgst: Number(inv.cgstAmount),
        sgst: Number(inv.sgstAmount),
        igst: Number(inv.igstAmount),
        grandTotal: Number(inv.grandTotal),
      };

      if (hasGSTIN) {
        b2bInvoices.push(invData);
        totalB2BTaxable += taxable;
        totalB2BGst += gst;
      } else {
        b2cInvoices.push(invData);
        totalB2CTaxable += taxable;
        totalB2CGst += gst;
      }

      // HSN aggregation
      for (const item of inv.items) {
        const hsn = item.hsnCode || '1905';
        if (!hsnSummaryMap[hsn]) {
          hsnSummaryMap[hsn] = {
            hsn,
            description: item.description,
            qty: 0,
            taxable: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total: 0,
          };
        }
        hsnSummaryMap[hsn].qty += Number(item.quantity);
        hsnSummaryMap[hsn].taxable += Number(item.taxableAmount);
        hsnSummaryMap[hsn].cgst += Number(item.cgstAmount);
        hsnSummaryMap[hsn].sgst += Number(item.sgstAmount);
        hsnSummaryMap[hsn].igst += Number(item.igstAmount);
        hsnSummaryMap[hsn].total += Number(item.totalAmount);
      }
    }

    // Credit notes for the period
    const creditNotes = await prisma.creditNote.findMany({
      where: {
        issueDate: { gte: startDate, lte: endDate },
        status: 'POSTED',
      },
      include: {
        customer: true,
        invoice: true,
      },
    });

    return {
      period: { month: month + 1, year },
      summary: {
        totalInvoices: invoices.length,
        b2bCount: b2bInvoices.length,
        b2cCount: b2cInvoices.length,
        totalTaxable: Math.round((totalB2BTaxable + totalB2CTaxable) * 100) / 100,
        totalGst: Math.round((totalB2BGst + totalB2CGst) * 100) / 100,
        b2bTaxable: Math.round(totalB2BTaxable * 100) / 100,
        b2bGst: Math.round(totalB2BGst * 100) / 100,
        b2cTaxable: Math.round(totalB2CTaxable * 100) / 100,
        b2cGst: Math.round(totalB2CGst * 100) / 100,
      },
      b2bInvoices,
      b2cInvoices,
      hsnSummary: Object.values(hsnSummaryMap),
      creditNotes: creditNotes.map((cn) => ({
        creditNoteNumber: cn.creditNoteNumber,
        invoiceNumber: cn.invoice.invoiceNumber,
        customerName: cn.customer.name,
        issueDate: cn.issueDate,
        reason: cn.reason,
        totalTaxable: Number(cn.totalTaxable),
        cgst: Number(cn.cgstAmount),
        sgst: Number(cn.sgstAmount),
        igst: Number(cn.igstAmount),
        totalAmount: Number(cn.totalAmount),
      })),
    };
  }
}
