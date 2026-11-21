import { Prisma, OrderStatus, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export class DispatchService {
  /**
   * Post dispatch for an order:
   * - Validates finished goods stock
   * - Prevents dispatching more than available stock
   * - Deducts finished goods stock via StockLedger
   * - Updates order status to DISPATCHED
   */
  static async postDispatch(params: {
    orderId: string;
    vehicleNumber?: string;
    driverName?: string;
    remarks?: string;
    userId: string;
  }) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: params.orderId },
      include: {
        items: { include: { product: true } },
        invoice: true,
      },
    });

    if (!order) throw new AppError('Order not found.', 404);
    if (order.status === OrderStatus.DISPATCHED) {
      throw new AppError('Order is already dispatched.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Verify stock availability for all items
      for (const item of order.items) {
        const currentStock = await InventoryService.getCurrentStock(
          ItemType.FINISHED_GOOD,
          item.productId,
          tx
        );
        const reqQty = Number(item.quantity);

        if (currentStock < reqQty) {
          const shortage = reqQty - currentStock;
          throw new AppError(
            `Insufficient stock for ${item.product.name}. Requested: ${reqQty}, Available: ${currentStock}, Shortage: ${shortage}. Cannot dispatch.`,
            400
          );
        }
      }

      // 2. Generate dispatch number e.g. DSP-2026-0001
      const count = await tx.dispatch.count();
      const dispatchNumber = `DSP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // 3. Deduct stock and record in StockLedger
      const dispatchItemsData = [];
      for (const item of order.items) {
        const qty = Number(item.quantity);
        await InventoryService.recordMovement(tx, {
          itemType: ItemType.FINISHED_GOOD,
          itemId: item.productId,
          movementType: StockMovementType.DISPATCH,
          quantity: -qty, // deduction
          unit: item.product.unit,
          referenceType: 'DISPATCH',
          referenceId: dispatchNumber,
          notes: `Dispatched for Order ${order.orderNumber}`,
          userId: params.userId,
        });

        dispatchItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
        });
      }

      // 4. Create Dispatch record
      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNumber,
          orderId: order.id,
          invoiceId: order.invoice?.id || null,
          dispatchDate: new Date(),
          vehicleNumber: params.vehicleNumber || null,
          driverName: params.driverName || null,
          remarks: params.remarks || null,
          createdById: params.userId,
          items: {
            create: dispatchItemsData,
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });

      // 5. Update Order status
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.DISPATCHED },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'DISPATCH',
        entityType: 'ORDER',
        entityId: order.id,
        newValues: { dispatchNumber, orderNumber: order.orderNumber },
      });

      return dispatch;
    });
  }
}
