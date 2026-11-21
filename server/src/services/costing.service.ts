import prisma from '../db/client.js';

export class CostingService {
  /**
   * Get product costing summary and margin analysis across production runs
   */
  static async getProductCostingSummary(productId?: string) {
    const whereClause = productId ? { productId } : {};

    const runs = await prisma.productionRun.findMany({
      where: whereClause,
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

    return runs.map((run) => {
      const sellingPrice = Number(run.product.sellingPrice);
      const costPerPacket = Number(run.costPerPacket);
      const marginPerPacket = Math.round((sellingPrice - costPerPacket) * 100) / 100;
      const marginPercent = sellingPrice > 0
        ? Math.round(((marginPerPacket / sellingPrice) * 100) * 100) / 100
        : 0;

      return {
        runId: run.id,
        runNumber: run.runNumber,
        productName: run.product.name,
        sku: run.product.sku,
        runDate: run.runDate,
        actualGoodOutput: Number(run.actualGoodOutput),
        totalMaterialCost: Number(run.totalMaterialCost),
        labourCost: Number(run.labourCost),
        powerCost: Number(run.powerCost),
        otherOverheads: Number(run.otherOverheads),
        totalProductionCost: Number(run.totalProductionCost),
        costPerPacket,
        sellingPrice,
        marginPerPacket,
        marginPercent,
        consumptions: run.consumptions.map((c) => ({
          itemName: c.rawMaterial?.name || c.packagingMaterial?.name || 'Item',
          itemType: c.itemType,
          actualQuantity: Number(c.actualQuantity),
          unit: c.unit,
          unitCost: Number(c.unitCost),
          totalCost: Number(c.totalCost),
        })),
      };
    });
  }
}
