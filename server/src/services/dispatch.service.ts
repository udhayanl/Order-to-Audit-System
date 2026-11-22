import { Prisma, OrderStatus, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface DispatchItemInput {
  productId: string;
  quantity: number;
  batchNumber?: string;
  manufacturingDate?: Date | string;
  expiryDate?: Date | string;
}

export class DispatchService {
  /**
   * Post dispatch for an order:
   * - Validates finished goods stock
   * - Prevents dispatching more than available stock
   * - Deducts finished goods stock via StockLedger (StockMovementType.DISPATCH)
   * - Updates order status to DISPATCHED (or PARTIALLY_DISPATCHED)
   * - Updates stock allocations if present
   */
  static async postDispatch(params: {
    orderId: string;
    vehicleNumber?: string;
    driverName?: string;
    transporter?: string;
    remarks?: string;
    items?: DispatchItemInput[];
    userId: string;
  }) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: params.orderId },
      include: {
        items: { include: { product: true } },
        invoice: true,
        dispatch: true,
        allocations: {
          where: { status: 'ACTIVE' },
          include: { items: true },
        },
      },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Prevent duplicate dispatch
    if (order.dispatch) {
      throw new AppError(
        `Order ${order.orderNumber} has already been dispatched under ${order.dispatch.dispatchNumber}. Duplicate dispatch posting is prohibited.`,
        400
      );
    }

    if (order.status === OrderStatus.DISPATCHED) {
      throw new AppError('Order is already dispatched.', 400);
    }
    if (order.status === OrderStatus.REJECTED) {
      throw new AppError('Cannot dispatch a rejected order.', 400);
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError('Cannot dispatch a cancelled order.', 400);
    }

    return prisma.$transaction(async (tx) => {
      // Determine items to dispatch
      const itemsToDispatch: Array<{
        orderItemId: string;
        productId: string;
        productName: string;
        unit: string;
        qtyToDispatch: number;
        batchNumber?: string;
        manufacturingDate?: Date;
        expiryDate?: Date;
      }> = [];

      if (params.items && params.items.length > 0) {
        for (const inputItem of params.items) {
          const orderItem = order.items.find((i) => i.productId === inputItem.productId);
          if (!orderItem) {
            throw new AppError(`Product ${inputItem.productId} is not part of this order.`, 400);
          }
          if (inputItem.quantity <= 0) {
            throw new AppError('Dispatch quantity must be greater than zero.', 400);
          }

          const orderedQty = Number(orderItem.quantity);
          const alreadyDispatched = Number(orderItem.dispatchedQuantity);
          const remainingToDispatch = orderedQty - alreadyDispatched;

          if (inputItem.quantity > remainingToDispatch + 0.0001) {
            throw new AppError(
              `Cannot dispatch ${inputItem.quantity} for ${orderItem.product.name}. Remaining undispatched is ${remainingToDispatch}.`,
              400
            );
          }

          itemsToDispatch.push({
            orderItemId: orderItem.id,
            productId: orderItem.productId,
            productName: orderItem.product.name,
            unit: orderItem.product.unit,
            qtyToDispatch: inputItem.quantity,
            batchNumber: inputItem.batchNumber,
            manufacturingDate: inputItem.manufacturingDate ? new Date(inputItem.manufacturingDate) : undefined,
            expiryDate: inputItem.expiryDate ? new Date(inputItem.expiryDate) : undefined,
          });
        }
      } else {
        // Auto-dispatch remaining quantities for all items
        for (const orderItem of order.items) {
          const orderedQty = Number(orderItem.quantity);
          const alreadyDispatched = Number(orderItem.dispatchedQuantity);
          const remainingToDispatch = orderedQty - alreadyDispatched;

          if (remainingToDispatch > 0) {
            itemsToDispatch.push({
              orderItemId: orderItem.id,
              productId: orderItem.productId,
              productName: orderItem.product.name,
              unit: orderItem.product.unit,
              qtyToDispatch: remainingToDispatch,
            });
          }
        }
      }

      if (itemsToDispatch.length === 0) {
        throw new AppError('No items remaining to dispatch for this order.', 400);
      }

      // 1. Verify physical stock availability
      for (const item of itemsToDispatch) {
        const currentStock = await InventoryService.getCurrentStock(
          ItemType.FINISHED_GOOD,
          item.productId,
          tx
        );

        if (currentStock < item.qtyToDispatch - 0.0001) {
          const shortage = item.qtyToDispatch - currentStock;
          throw new AppError(
            `Insufficient finished goods stock for ${item.productName}. Requested: ${item.qtyToDispatch}, Available in stock: ${currentStock}, Shortage: ${shortage}. Cannot dispatch.`,
            400
          );
        }
      }

      // 2. Generate dispatch number e.g. DSP-2026-0001
      const count = await tx.dispatch.count();
      const dispatchNumber = `DSP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // 3. Atomically record movement in StockLedger & deduct inventory
      const dispatchItemsData = [];
      for (const item of itemsToDispatch) {
        await InventoryService.recordMovement(tx, {
          itemType: ItemType.FINISHED_GOOD,
          itemId: item.productId,
          movementType: StockMovementType.DISPATCH,
          quantity: -item.qtyToDispatch, // negative for deduction
          unit: item.unit,
          direction: 'OUT',
          referenceType: 'DISPATCH',
          referenceId: dispatchNumber,
          notes: `Dispatched for Order ${order.orderNumber}${item.batchNumber ? ` [Batch: ${item.batchNumber}]` : ''}`,
          userId: params.userId,
        });

        dispatchItemsData.push({
          productId: item.productId,
          quantity: new Prisma.Decimal(item.qtyToDispatch),
          batchNumber: item.batchNumber || null,
          manufacturingDate: item.manufacturingDate || null,
          expiryDate: item.expiryDate || null,
        });

        // Update dispatched quantity on order item
        await tx.salesOrderItem.update({
          where: { id: item.orderItemId },
          data: {
            dispatchedQuantity: {
              increment: new Prisma.Decimal(item.qtyToDispatch),
            },
          },
        });
      }

      // 4. Update any active stock allocations to CONSUMED / DISPATCHED
      for (const alloc of order.allocations) {
        await tx.stockAllocation.update({
          where: { id: alloc.id },
          data: { status: 'CONSUMED' },
        });
        await tx.stockAllocationItem.updateMany({
          where: { allocationId: alloc.id },
          data: { status: 'DISPATCHED' },
        });
      }

      // 5. Create Dispatch record
      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNumber,
          orderId: order.id,
          invoiceId: order.invoice?.id || null,
          dispatchDate: new Date(),
          vehicleNumber: params.vehicleNumber || null,
          driverName: params.driverName || null,
          transporter: params.transporter || null,
          remarks: params.remarks || null,
          deliveryStatus: 'DISPATCHED',
          createdById: params.userId,
          items: {
            create: dispatchItemsData,
          },
        },
        include: {
          items: { include: { product: true } },
          order: true,
          invoice: true,
        },
      });

      // 6. Update Order Status
      const orderItems = await tx.salesOrderItem.findMany({
        where: { salesOrderId: order.id },
      });

      const isFullyDispatched = orderItems.every(
        (i) => Number(i.dispatchedQuantity) >= Number(i.quantity) - 0.0001
      );

      const newOrderStatus = isFullyDispatched
        ? OrderStatus.DISPATCHED
        : OrderStatus.PARTIALLY_DISPATCHED;

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: newOrderStatus },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'DISPATCH',
        entityType: 'ORDER',
        entityId: order.id,
        newValues: {
          dispatchNumber,
          orderNumber: order.orderNumber,
          orderStatus: newOrderStatus,
          itemsCount: itemsToDispatch.length,
        },
      });

      return dispatch;
    });
  }

  /**
   * Update delivery tracking status
   */
  static async updateDeliveryStatus(
    dispatchId: string,
    status: 'READY_FOR_DISPATCH' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED',
    deliveryDate?: Date | string,
    userId?: string
  ) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
    });

    if (!dispatch) throw new AppError('Dispatch record not found.', 404);

    const updated = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: {
        deliveryStatus: status,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : status === 'DELIVERED' ? new Date() : undefined,
      },
      include: {
        items: { include: { product: true } },
        order: { include: { customer: true } },
      },
    });

    if (userId) {
      await AuditService.log(prisma, {
        userId,
        action: 'UPDATE_STATUS',
        entityType: 'DISPATCH',
        entityId: dispatchId,
        newValues: { deliveryStatus: status, deliveryDate },
      });
    }

    return updated;
  }

  /**
   * Get single dispatch record by ID or dispatchNumber
   */
  static async getDispatchById(id: string) {
    const dispatch = await prisma.dispatch.findFirst({
      where: {
        OR: [{ id }, { dispatchNumber: id }],
      },
      include: {
        order: {
          include: {
            customer: true,
            salesman: { select: { id: true, fullName: true, email: true } },
          },
        },
        invoice: true,
        items: {
          include: { product: true },
        },
        createdBy: {
          select: { id: true, fullName: true, role: true },
        },
        salesReturns: true,
      },
    });

    if (!dispatch) throw new AppError('Dispatch not found.', 404);
    return dispatch;
  }

  /**
   * List dispatches with filters and pagination
   */
  static async getDispatches(filters: {
    page?: number;
    limit?: number;
    search?: string;
    deliveryStatus?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.DispatchWhereInput = {};

    if (filters.deliveryStatus) {
      where.deliveryStatus = filters.deliveryStatus;
    }

    if (filters.startDate || filters.endDate) {
      where.dispatchDate = {};
      if (filters.startDate) where.dispatchDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.dispatchDate.lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { dispatchNumber: { contains: q, mode: 'insensitive' } },
        { vehicleNumber: { contains: q, mode: 'insensitive' } },
        { driverName: { contains: q, mode: 'insensitive' } },
        { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [total, dispatches] = await Promise.all([
      prisma.dispatch.count({ where }),
      prisma.dispatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dispatchDate: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customer: { select: { id: true, name: true, city: true, state: true } },
            },
          },
          invoice: { select: { id: true, invoiceNumber: true, grandTotal: true } },
          items: { include: { product: { select: { id: true, name: true, unit: true } } } },
        },
      }),
    ]);

    return {
      data: dispatches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
