import { Prisma, OrderStatus, ItemType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface AllocateItemInput {
  productId: string;
  quantity: number;
  batchNumber?: string;
}

export class StockAllocationService {
  /**
   * Allocate finished goods stock for an approved sales order.
   * Does NOT touch StockLedger (reservation only).
   */
  static async allocateStock(params: {
    salesOrderId: string;
    userId: string;
    items?: AllocateItemInput[];
    notes?: string;
  }) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: params.salesOrderId },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    if (!order) throw new AppError('Sales order not found.', 404);

    if (
      order.status !== OrderStatus.APPROVED &&
      order.status !== OrderStatus.PARTIALLY_ALLOCATED &&
      order.status !== OrderStatus.INVOICED
    ) {
      throw new AppError(
        `Cannot allocate stock for order with status ${order.status}. Order must be APPROVED or PARTIALLY_ALLOCATED.`,
        400
      );
    }

    return prisma.$transaction(async (tx) => {
      // Determine what to allocate
      const itemsToProcess: Array<{
        orderItemId: string;
        productId: string;
        productName: string;
        unit: string;
        orderedQty: number;
        alreadyAllocatedQty: number;
        qtyToAllocate: number;
        batchNumber?: string;
      }> = [];

      if (params.items && params.items.length > 0) {
        // Custom items specified
        for (const inputItem of params.items) {
          const orderItem = order.items.find((i) => i.productId === inputItem.productId);
          if (!orderItem) {
            throw new AppError(`Product ${inputItem.productId} is not part of this order.`, 400);
          }
          const orderedQty = Number(orderItem.quantity);
          const alreadyAllocated = Number(orderItem.allocatedQuantity);
          const remainingToAllocate = orderedQty - alreadyAllocated;

          if (inputItem.quantity <= 0) {
            throw new AppError(`Allocation quantity must be greater than zero.`, 400);
          }
          if (inputItem.quantity > remainingToAllocate + 0.0001) {
            throw new AppError(
              `Cannot allocate ${inputItem.quantity} for ${orderItem.product.name}. Remaining unallocated is ${remainingToAllocate}.`,
              400
            );
          }

          itemsToProcess.push({
            orderItemId: orderItem.id,
            productId: orderItem.productId,
            productName: orderItem.product.name,
            unit: orderItem.product.unit,
            orderedQty,
            alreadyAllocatedQty: alreadyAllocated,
            qtyToAllocate: inputItem.quantity,
            batchNumber: inputItem.batchNumber,
          });
        }
      } else {
        // Auto-allocate full remaining balance for all items
        for (const orderItem of order.items) {
          const orderedQty = Number(orderItem.quantity);
          const alreadyAllocated = Number(orderItem.allocatedQuantity);
          const remainingToAllocate = orderedQty - alreadyAllocated;

          if (remainingToAllocate > 0) {
            itemsToProcess.push({
              orderItemId: orderItem.id,
              productId: orderItem.productId,
              productName: orderItem.product.name,
              unit: orderItem.product.unit,
              orderedQty,
              alreadyAllocatedQty: alreadyAllocated,
              qtyToAllocate: remainingToAllocate,
            });
          }
        }
      }

      if (itemsToProcess.length === 0) {
        throw new AppError('No items remaining to allocate for this order.', 400);
      }

      // Check stock availability for all items to allocate
      for (const item of itemsToProcess) {
        const physicalStock = await InventoryService.getCurrentStock(
          ItemType.FINISHED_GOOD,
          item.productId,
          tx
        );

        const activeAllocations = await tx.stockAllocationItem.aggregate({
          where: {
            productId: item.productId,
            status: 'ALLOCATED',
            allocation: { status: 'ACTIVE' },
          },
          _sum: { allocatedQuantity: true },
        });

        const activeReserved = Number(activeAllocations._sum.allocatedQuantity || 0);
        const availableStock = Math.max(0, physicalStock - activeReserved);

        if (item.qtyToAllocate > availableStock + 0.0001) {
          throw new AppError(
            `Insufficient unallocated stock for ${item.productName}. Requested: ${item.qtyToAllocate}, Available unreserved: ${availableStock}, Physical stock: ${physicalStock}, Already reserved: ${activeReserved}.`,
            400
          );
        }
      }

      // Generate allocation number e.g. ALC-2026-0001
      const count = await tx.stockAllocation.count();
      const allocationNumber = `ALC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // Create StockAllocation record
      const allocation = await tx.stockAllocation.create({
        data: {
          allocationNumber,
          salesOrderId: order.id,
          status: 'ACTIVE',
          allocatedById: params.userId,
          notes: params.notes || null,
          items: {
            create: itemsToProcess.map((item) => ({
              productId: item.productId,
              batchNumber: item.batchNumber || null,
              requestedQuantity: new Prisma.Decimal(item.orderedQty),
              allocatedQuantity: new Prisma.Decimal(item.qtyToAllocate),
              status: 'ALLOCATED',
            })),
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });

      // Update SalesOrderItem allocatedQuantity
      for (const item of itemsToProcess) {
        await tx.salesOrderItem.update({
          where: { id: item.orderItemId },
          data: {
            allocatedQuantity: {
              increment: new Prisma.Decimal(item.qtyToAllocate),
            },
          },
        });
      }

      // Check overall order allocation status
      const updatedOrderItems = await tx.salesOrderItem.findMany({
        where: { salesOrderId: order.id },
      });

      const isFullyAllocated = updatedOrderItems.every(
        (i) => Number(i.allocatedQuantity) >= Number(i.quantity) - 0.0001
      );

      const newOrderStatus = isFullyAllocated
        ? OrderStatus.ALLOCATED
        : OrderStatus.PARTIALLY_ALLOCATED;

      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: newOrderStatus,
          allocatedById: params.userId,
          allocatedAt: new Date(),
        },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'ALLOCATE',
        entityType: 'ORDER',
        entityId: order.id,
        newValues: {
          allocationNumber,
          orderStatus: newOrderStatus,
          itemsCount: itemsToProcess.length,
        },
      });

      return allocation;
    });
  }

  /**
   * Release a specific stock allocation
   */
  static async releaseAllocation(allocationId: string, userId: string) {
    const allocation = await prisma.stockAllocation.findUnique({
      where: { id: allocationId },
      include: {
        items: true,
        salesOrder: { include: { items: true } },
      },
    });

    if (!allocation) throw new AppError('Stock allocation not found.', 404);
    if (allocation.status !== 'ACTIVE') {
      throw new AppError(`Allocation is already in ${allocation.status} state.`, 400);
    }

    return prisma.$transaction(async (tx) => {
      // Mark allocation released
      const updatedAllocation = await tx.stockAllocation.update({
        where: { id: allocation.id },
        data: { status: 'RELEASED' },
      });

      // Mark allocation items released and deduct from order items
      for (const item of allocation.items) {
        await tx.stockAllocationItem.update({
          where: { id: item.id },
          data: { status: 'RELEASED' },
        });

        const orderItem = allocation.salesOrder.items.find(
          (oi) => oi.productId === item.productId
        );
        if (orderItem) {
          const newAllocated = Math.max(
            0,
            Number(orderItem.allocatedQuantity) - Number(item.allocatedQuantity)
          );
          await tx.salesOrderItem.update({
            where: { id: orderItem.id },
            data: { allocatedQuantity: new Prisma.Decimal(newAllocated) },
          });
        }
      }

      // Recalculate order status
      const orderItems = await tx.salesOrderItem.findMany({
        where: { salesOrderId: allocation.salesOrderId },
      });

      const totalAllocated = orderItems.reduce(
        (sum, i) => sum + Number(i.allocatedQuantity),
        0
      );

      let newStatus: OrderStatus = OrderStatus.APPROVED;
      if (totalAllocated > 0) {
        const isFullyAllocated = orderItems.every(
          (i) => Number(i.allocatedQuantity) >= Number(i.quantity) - 0.0001
        );
        newStatus = isFullyAllocated
          ? OrderStatus.ALLOCATED
          : OrderStatus.PARTIALLY_ALLOCATED;
      }

      await tx.salesOrder.update({
        where: { id: allocation.salesOrderId },
        data: {
          status: newStatus,
          allocatedById: totalAllocated > 0 ? allocation.salesOrder.allocatedById : null,
          allocatedAt: totalAllocated > 0 ? allocation.salesOrder.allocatedAt : null,
        },
      });

      await AuditService.log(tx, {
        userId,
        action: 'RELEASE_ALLOCATION',
        entityType: 'ORDER',
        entityId: allocation.salesOrderId,
        newValues: {
          allocationNumber: allocation.allocationNumber,
          revertedStatus: newStatus,
        },
      });

      return updatedAllocation;
    });
  }

  /**
   * Release all active allocations for an order (e.g. when order is cancelled)
   */
  static async releaseAllForOrder(orderId: string, userId: string, tx: any = prisma) {
    const allocations = await tx.stockAllocation.findMany({
      where: { salesOrderId: orderId, status: 'ACTIVE' },
      include: { items: true },
    });

    for (const allocation of allocations) {
      await tx.stockAllocation.update({
        where: { id: allocation.id },
        data: { status: 'RELEASED' },
      });

      await tx.stockAllocationItem.updateMany({
        where: { allocationId: allocation.id },
        data: { status: 'RELEASED' },
      });
    }

    // Reset allocatedQuantity on all order items
    await tx.salesOrderItem.updateMany({
      where: { salesOrderId: orderId },
      data: { allocatedQuantity: new Prisma.Decimal(0.0) },
    });

    return allocations.length;
  }

  /**
   * Get finished goods stock availability summary
   */
  static async getStockAvailability(productId?: string) {
    const where: any = { active: true };
    if (productId) where.id = productId;

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { category: true },
    });

    const availability = [];

    for (const product of products) {
      const physicalStock = await InventoryService.getCurrentStock(
        ItemType.FINISHED_GOOD,
        product.id
      );

      const activeAllocations = await prisma.stockAllocationItem.aggregate({
        where: {
          productId: product.id,
          status: 'ALLOCATED',
          allocation: { status: 'ACTIVE' },
        },
        _sum: { allocatedQuantity: true },
      });

      const allocatedStock = Number(activeAllocations._sum.allocatedQuantity || 0);
      const availableStock = Math.max(0, physicalStock - allocatedStock);
      const reorderLevel = Number(product.reorderLevel);

      let status = 'ADEQUATE';
      if (availableStock <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (availableStock <= reorderLevel) {
        status = 'LOW_STOCK';
      }

      availability.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category?.name || '',
        packSize: product.packSize,
        sellingPrice: Number(product.sellingPrice),
        physicalStock,
        allocatedStock,
        availableStock,
        reorderLevel,
        status,
      });
    }

    return availability;
  }
}
