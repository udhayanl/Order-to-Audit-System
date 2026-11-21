import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

export class BOMService {
  /**
   * Get BOM with all raw and packaging material items
   */
  static async getBOMById(bomId: string) {
    const bom = await prisma.bOM.findUnique({
      where: { id: bomId },
      include: {
        product: true,
        items: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
      },
    });

    if (!bom) {
      throw new AppError(`BOM not found with id: ${bomId}`, 404);
    }

    return bom;
  }

  /**
   * Calculate planned consumption and expected yield for a planned batch quantity
   */
  static calculatePlannedRequirements(bom: any, plannedBatchQuantity: number) {
    const batchSize = Number(bom.batchSize);
    const multiplier = plannedBatchQuantity / batchSize;
    const expectedYield = Number(bom.expectedYield) * multiplier;

    const plannedItems = bom.items.map((item: any) => {
      const standardQty = Number(item.standardQuantity);
      const plannedQuantity = Math.round(standardQty * multiplier * 1000) / 1000;
      return {
        bomItemId: item.id,
        itemType: item.itemType,
        rawMaterialId: item.rawMaterialId,
        packagingMaterialId: item.packagingMaterialId,
        name: item.rawMaterial?.name || item.packagingMaterial?.name || 'Unknown',
        standardQuantity: standardQty,
        plannedQuantity,
        unit: item.unit,
      };
    });

    return {
      batchSize,
      multiplier,
      expectedYield,
      yieldUnit: bom.yieldUnit,
      plannedItems,
    };
  }
}
