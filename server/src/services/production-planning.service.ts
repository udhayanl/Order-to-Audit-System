import { Prisma, ItemType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { UnitConversionService } from './unit.service.js';

export interface MaterialRequirementItem {
  itemType: ItemType;
  itemId: string;
  code: string;
  name: string;
  unit: string;
  standardQuantity: number;
  scaledQuantity: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  shortageQuantity: number;
  hasShortage: boolean;
}

export class ProductionPlanningService {
  /**
   * Calculate material requirements for a given BOM and planned batch output
   */
  static async calculateMaterialRequirements(
    bomId: string,
    plannedOutputQuantity: number
  ) {
    if (plannedOutputQuantity <= 0) {
      throw new AppError('Planned output quantity must be greater than zero.');
    }

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

    if (!bom) throw new AppError('BOM recipe not found.', 404);

    const standardBatchSize = Number(bom.batchSize || 200);
    const scalingFactor = plannedOutputQuantity / standardBatchSize;

    const items: MaterialRequirementItem[] = [];
    let hasShortage = false;

    for (const item of bom.items) {
      const isRM = item.itemType === ItemType.RAW_MATERIAL;
      const itemId = isRM ? item.rawMaterialId! : item.packagingMaterialId!;
      const material = isRM ? item.rawMaterial : item.packagingMaterial;

      const stdQty = Number(item.standardQuantity);
      const scaledQty = Math.round(stdQty * scalingFactor * 1000) / 1000;

      // Check current physical stock
      const currentStock = await InventoryService.getCurrentStock(item.itemType, itemId);

      // Check existing active material reservations for other active orders
      const reservations = await prisma.materialReservation.aggregate({
        where: {
          itemType: item.itemType,
          itemId,
          status: 'ACTIVE',
        },
        _sum: {
          reservedQuantity: true,
        },
      });

      const reservedStock = Number(reservations._sum.reservedQuantity || 0);
      const availableStock = Math.max(0, Math.round((currentStock - reservedStock) * 1000) / 1000);
      const shortageQuantity = Math.max(0, Math.round((scaledQty - availableStock) * 1000) / 1000);
      const itemHasShortage = shortageQuantity > 0.0001;

      if (itemHasShortage) {
        hasShortage = true;
      }

      items.push({
        itemType: item.itemType,
        itemId,
        code: material?.code || 'N/A',
        name: material?.name || 'Material Item',
        unit: item.unit,
        standardQuantity: stdQty,
        scaledQuantity: scaledQty,
        currentStock,
        reservedStock,
        availableStock,
        shortageQuantity,
        hasShortage: itemHasShortage,
      });
    }

    return {
      bomId: bom.id,
      bomName: bom.name,
      bomVersion: bom.version,
      productId: bom.productId,
      productName: bom.product.name,
      standardBatchSize,
      plannedOutputQuantity,
      scalingFactor,
      items,
      hasShortage,
    };
  }
}
