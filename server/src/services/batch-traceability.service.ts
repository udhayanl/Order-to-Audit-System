import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

export class BatchTraceabilityService {
  /**
   * Trace complete lifecycle of a manufactured batch
   */
  static async traceBatch(identifier: string) {
    // Search by batchNumber in execution, output or quality, or by orderNumber
    let execution = await prisma.productionExecution.findFirst({
      where: { batchNumber: identifier },
      include: {
        productionOrder: {
          include: {
            product: true,
            bomSnapshot: { include: { items: true } },
            materialIssues: {
              include: {
                items: {
                  include: {
                    rawMaterial: true,
                    packagingMaterial: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    let orderId = execution?.productionOrderId;

    if (!orderId) {
      // Check if identifier is an orderNumber
      const order = await prisma.productionOrder.findFirst({
        where: { orderNumber: identifier },
        include: {
          product: true,
          bomSnapshot: { include: { items: true } },
          materialIssues: {
            include: {
              items: {
                include: {
                  rawMaterial: true,
                  packagingMaterial: true,
                },
              },
            },
          },
        },
      });

      if (order) {
        orderId = order.id;
      }
    }

    if (!orderId) {
      // Check if output has this batchNumber
      const output = await prisma.productionOutput.findFirst({
        where: { batchNumber: identifier },
      });
      if (output) {
        orderId = output.productionOrderId;
      }
    }

    if (!orderId) {
      throw new AppError(`Batch or Production Order '${identifier}' not found in audit records.`, 404);
    }

    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        bom: true,
        bomSnapshot: { include: { items: true } },
        supervisor: { select: { id: true, fullName: true, role: true } },
        createdBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        materialIssues: {
          include: {
            items: {
              include: {
                rawMaterial: true,
                packagingMaterial: true,
              },
            },
            issuedBy: { select: { id: true, fullName: true } },
          },
        },
        executions: true,
        outputs: true,
        qualityInspections: {
          include: {
            inspector: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Get stock ledger records created for this order
    const outputNumbers = order.outputs.map(o => o.outputNumber);
    const issueNumbers = order.materialIssues.map(i => i.issueNumber);
    const allRefs = [...outputNumbers, ...issueNumbers, order.orderNumber];

    const stockLedgerEntries = await prisma.stockLedger.findMany({
      where: {
        referenceId: { in: allRefs },
      },
      include: {
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Material consumption and variance analysis
    const materialVariances: any[] = [];
    for (const issue of order.materialIssues) {
      for (const item of issue.items) {
        const materialName = item.rawMaterial?.name || item.packagingMaterial?.name || 'Material';
        const materialCode = item.rawMaterial?.code || item.packagingMaterial?.code || 'N/A';
        const snapshotItem = order.bomSnapshot?.items.find(
          s => (s.rawMaterialId && s.rawMaterialId === item.rawMaterialId) ||
               (s.packagingMaterialId && s.packagingMaterialId === item.packagingMaterialId)
        );

        const standardQty = snapshotItem ? Number(snapshotItem.scaledQuantity) : Number(item.issuedQuantity);
        const actualConsumed = Number(item.actualConsumedQuantity);
        const variance = Math.round((actualConsumed - standardQty) * 1000) / 1000;
        const variancePercent = standardQty > 0 ? Math.round(((variance / standardQty) * 100) * 100) / 100 : 0;

        materialVariances.push({
          materialName,
          materialCode,
          itemType: item.itemType,
          standardQuantity: standardQty,
          issuedQuantity: Number(item.issuedQuantity),
          returnedQuantity: Number(item.returnedQuantity || 0),
          actualConsumedQuantity: actualConsumed,
          unit: item.unit,
          variance,
          variancePercent,
          unitCost: Number(item.unitCost),
          totalCost: Number(item.totalCost),
        });
      }
    }

    const rawMaterialCost = materialVariances
      .filter(m => m.itemType === 'RAW_MATERIAL')
      .reduce((sum, m) => sum + m.totalCost, 0);
    const packagingCost = materialVariances
      .filter(m => m.itemType === 'PACKAGING')
      .reduce((sum, m) => sum + m.totalCost, 0);
    const totalMaterialCost = rawMaterialCost + packagingCost;
    const goodPackets = order.outputs.reduce((sum, o) => sum + Number(o.goodPackets), 0);
    const totalVal = order.outputs.reduce((sum, o) => sum + Number(o.totalValue), 0);
    const overheadsTotal = Math.max(0, Math.round((totalVal - totalMaterialCost) * 100) / 100);
    const costPerPacket = goodPackets > 0 ? Math.round((totalVal / goodPackets) * 100) / 100 : 0;

    const costAnalysis = {
      rawMaterialCost,
      packagingCost,
      totalMaterialCost,
      overheadsTotal,
      totalProductionCost: totalVal,
      costPerPacket,
    };

    return {
      batchIdentifier: identifier,
      batchNumber: identifier,
      productionOrder: order,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        startDate: order.startDate,
        expectedCompletionDate: order.expectedCompletionDate,
        actualCompletionDate: order.actualCompletionDate,
        status: order.status,
        supervisor: order.supervisor?.fullName || 'Assigned Supervisor',
        createdBy: order.createdBy?.fullName,
        approvedBy: order.approvedBy?.fullName || 'Pending',
      },
      product: {
        id: order.product.id,
        name: order.product.name,
        sku: order.product.sku,
        packSize: order.product.packSize,
        unit: order.product.unit,
      },
      bomSnapshot: order.bomSnapshot,
      materialIssues: order.materialIssues,
      materialVariances,
      costAnalysis,
      executions: order.executions,
      productionOutputs: order.outputs,
      outputs: order.outputs,
      qualityInspections: order.qualityInspections,
      stockLedgerEntries,
    };
  }
}
