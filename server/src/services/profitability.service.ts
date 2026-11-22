import prisma from '../db/client.js';

export class ProfitabilityService {
  /**
   * Product-level profitability analysis
   */
  static async getProductProfitability() {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        boms: {
          where: { active: true },
          take: 1,
        },
        productionRuns: {
          where: { status: 'POSTED' },
          orderBy: { runDate: 'desc' },
          take: 5,
        },
        invoiceItems: {
          include: { invoice: true },
        },
      },
    });

    const result = products.map(p => {
      const sellingPrice = Number(p.sellingPrice);

      // Determine unit production cost
      let unitCost = 0;
      if (p.productionRuns.length > 0) {
        const totalCost = p.productionRuns.reduce((s, r) => s + Number(r.costPerPacket), 0);
        unitCost = totalCost / p.productionRuns.length;
      } else {
        // Fallback standard estimate (approx 55% of selling price for small food manufacturing)
        unitCost = Math.round(sellingPrice * 0.55 * 100) / 100;
      }

      const grossProfitPerUnit = Math.round((sellingPrice - unitCost) * 100) / 100;
      const marginPercent = sellingPrice > 0
        ? Math.round((grossProfitPerUnit / sellingPrice) * 10000) / 100
        : 0;

      // Units sold from posted invoices
      let totalUnitsSold = 0;
      let totalRevenue = 0;

      for (const item of p.invoiceItems) {
        if (item.invoice.status !== 'CANCELLED') {
          totalUnitsSold += Number(item.quantity);
          totalRevenue += Number(item.taxableAmount);
        }
      }

      const totalCogs = Math.round(totalUnitsSold * unitCost * 100) / 100;
      const totalGrossProfit = Math.round((totalRevenue - totalCogs) * 100) / 100;

      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        packSize: p.packSize,
        sellingPrice,
        unitCost: Math.round(unitCost * 100) / 100,
        grossProfitPerUnit,
        marginPercent,
        totalUnitsSold,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCogs,
        totalGrossProfit,
      };
    });

    return result.sort((a, b) => b.totalGrossProfit - a.totalGrossProfit);
  }

  /**
   * Customer-level profitability analysis
   */
  static async getCustomerProfitability() {
    const customers = await prisma.customer.findMany({
      where: { active: true },
      include: {
        invoices: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            items: { include: { product: true } },
          },
        },
      },
    });

    const result = customers.map(c => {
      let totalRevenue = 0;
      let totalCogs = 0;
      let totalInvoices = c.invoices.length;

      for (const inv of c.invoices) {
        totalRevenue += Number(inv.totalTaxable);

        for (const item of inv.items) {
          const qty = Number(item.quantity);
          const price = Number(item.product.sellingPrice);
          const estUnitCost = price * 0.55; // Standard 55% COGS benchmark
          totalCogs += (qty * estUnitCost);
        }
      }

      const grossProfit = Math.round((totalRevenue - totalCogs) * 100) / 100;
      const marginPercent = totalRevenue > 0
        ? Math.round((grossProfit / totalRevenue) * 10000) / 100
        : 0;

      return {
        customerId: c.id,
        customerName: c.name,
        customerType: c.type,
        gstin: c.gstin,
        state: c.state,
        totalInvoices,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCogs: Math.round(totalCogs * 100) / 100,
        grossProfit,
        marginPercent,
      };
    });

    return result
      .filter(c => c.totalRevenue > 0)
      .sort((a, b) => b.grossProfit - a.grossProfit);
  }

  /**
   * Overall factory profitability summary
   */
  static async getOverallProfitabilitySummary() {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } },
    });
    const totalRevenue = invoices.reduce((s, i) => s + Number(i.totalTaxable), 0);

    const expenses = await prisma.expense.findMany({
      where: { status: 'POSTED' },
    });
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.totalAmount), 0);

    const productionRuns = await prisma.productionRun.findMany({
      where: { status: 'POSTED' },
    });
    const totalProductionCost = productionRuns.reduce((s, r) => s + Number(r.totalProductionCost), 0);

    const estimatedCogs = totalProductionCost > 0 ? totalProductionCost : (totalRevenue * 0.55);
    const grossProfit = Math.round((totalRevenue - estimatedCogs) * 100) / 100;
    const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0;
    const operatingProfit = Math.round((grossProfit - totalExpenses) * 100) / 100;
    const operatingMargin = totalRevenue > 0 ? Math.round((operatingProfit / totalRevenue) * 10000) / 100 : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      cogs: Math.round(estimatedCogs * 100) / 100,
      grossProfit,
      grossMargin,
      operatingExpenses: Math.round(totalExpenses * 100) / 100,
      operatingProfit,
      operatingMargin,
    };
  }
}
