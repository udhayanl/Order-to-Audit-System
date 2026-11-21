import { Prisma, OrderStatus, ItemType, Role } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export class OrderService {
  /**
   * Create a new sales order (Salesman or Admin)
   */
  static async createOrder(params: {
    customerId: string;
    salesmanId: string;
    callerRole?: Role;
    orderNotes?: string;
    items: CreateOrderItemInput[];
  }) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Order must contain at least one item.');
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
    });
    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    // Security: If salesman, verify customer is assigned to this salesman
    if (params.callerRole === Role.SALESMAN && customer.salesmanId && customer.salesmanId !== params.salesmanId) {
      throw new AppError('Forbidden: You can only create orders for your assigned customers.', 403);
    }

    let subtotal = 0;
    let estimatedGst = 0;
    const orderItemsData: any[] = [];

    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new AppError('Item quantity must be greater than zero.');
      }

      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new AppError(`Product not found: ${item.productId}`, 404);

      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : Number(product.sellingPrice);
      const taxableAmount = Math.round(item.quantity * unitPrice * 100) / 100;
      const gstRate = Number(product.gstRate);
      const itemGst = Math.round((taxableAmount * (gstRate / 100)) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + itemGst) * 100) / 100;

      subtotal += taxableAmount;
      estimatedGst += itemGst;

      orderItemsData.push({
        productId: product.id,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice: new Prisma.Decimal(unitPrice),
        gstRate: new Prisma.Decimal(gstRate),
        taxableAmount: new Prisma.Decimal(taxableAmount),
        gstAmount: new Prisma.Decimal(itemGst),
        totalAmount: new Prisma.Decimal(totalAmount),
      });
    }

    const grandTotal = Math.round((subtotal + estimatedGst) * 100) / 100;

    return prisma.$transaction(async (tx) => {
      const count = await tx.salesOrder.count();
      const orderNumber = `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const order = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: params.customerId,
          salesmanId: params.salesmanId,
          status: OrderStatus.SUBMITTED,
          subtotal: new Prisma.Decimal(subtotal),
          estimatedGst: new Prisma.Decimal(estimatedGst),
          grandTotal: new Prisma.Decimal(grandTotal),
          orderNotes: params.orderNotes || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          customer: true,
          salesman: { select: { id: true, fullName: true, email: true } },
          items: { include: { product: true } },
        },
      });

      await AuditService.log(tx, {
        userId: params.salesmanId,
        action: 'CREATE',
        entityType: 'ORDER',
        entityId: order.id,
        newValues: { orderNumber, customerId: params.customerId, grandTotal },
      });

      return order;
    });
  }

  /**
   * Modify order quantities and prices before approval (Admin)
   */
  static async updateOrder(params: {
    orderId: string;
    items: CreateOrderItemInput[];
    orderNotes?: string;
    adminUserId: string;
  }) {
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id: params.orderId },
      include: { items: true },
    });

    if (!existingOrder) throw new AppError('Order not found.', 404);
    if (existingOrder.status !== OrderStatus.SUBMITTED && existingOrder.status !== OrderStatus.DRAFT) {
      throw new AppError(`Cannot modify order with status ${existingOrder.status}. Only SUBMITTED or DRAFT orders can be modified before approval.`, 400);
    }

    if (!params.items || params.items.length === 0) {
      throw new AppError('Order must contain at least one item.', 400);
    }

    let subtotal = 0;
    let estimatedGst = 0;
    const newItemsData: any[] = [];

    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new AppError('Item quantity must be greater than zero.', 400);
      }

      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new AppError(`Product not found: ${item.productId}`, 404);

      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : Number(product.sellingPrice);
      const taxableAmount = Math.round(item.quantity * unitPrice * 100) / 100;
      const gstRate = Number(product.gstRate);
      const itemGst = Math.round((taxableAmount * (gstRate / 100)) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + itemGst) * 100) / 100;

      subtotal += taxableAmount;
      estimatedGst += itemGst;

      newItemsData.push({
        salesOrderId: existingOrder.id,
        productId: product.id,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice: new Prisma.Decimal(unitPrice),
        gstRate: new Prisma.Decimal(gstRate),
        taxableAmount: new Prisma.Decimal(taxableAmount),
        gstAmount: new Prisma.Decimal(itemGst),
        totalAmount: new Prisma.Decimal(totalAmount),
      });
    }

    const grandTotal = Math.round((subtotal + estimatedGst) * 100) / 100;

    return prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: existingOrder.id },
      });

      // Create new items
      await tx.salesOrderItem.createMany({
        data: newItemsData,
      });

      // Update order totals
      const updated = await tx.salesOrder.update({
        where: { id: existingOrder.id },
        data: {
          subtotal: new Prisma.Decimal(subtotal),
          estimatedGst: new Prisma.Decimal(estimatedGst),
          grandTotal: new Prisma.Decimal(grandTotal),
          orderNotes: params.orderNotes !== undefined ? params.orderNotes : existingOrder.orderNotes,
        },
        include: {
          customer: true,
          salesman: { select: { id: true, fullName: true, email: true } },
          items: { include: { product: true } },
        },
      });

      await AuditService.log(tx, {
        userId: params.adminUserId,
        action: 'UPDATE',
        entityType: 'ORDER',
        entityId: existingOrder.id,
        previousValues: {
          subtotal: Number(existingOrder.subtotal),
          grandTotal: Number(existingOrder.grandTotal),
        },
        newValues: {
          subtotal,
          grandTotal,
          itemsCount: newItemsData.length,
        },
      });

      return updated;
    });
  }

  /**
   * Check stock availability and shortage for an order
   */
  static async checkStockAvailability(orderId: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new AppError('Order not found.', 404);

    let hasShortage = false;
    const stockStatus = [];

    for (const item of order.items) {
      const currentStock = await InventoryService.getCurrentStock(
        ItemType.FINISHED_GOOD,
        item.productId
      );
      const requestedQty = Number(item.quantity);
      const shortage = Math.max(0, requestedQty - currentStock);
      if (shortage > 0) hasShortage = true;

      stockStatus.push({
        productId: item.productId,
        productName: item.product.name,
        requestedQuantity: requestedQty,
        availableStock: currentStock,
        shortage,
        isAvailable: shortage === 0,
      });
    }

    return {
      orderId,
      orderNumber: order.orderNumber,
      hasShortage,
      stockStatus,
    };
  }

  /**
   * Approve an order (Admin)
   */
  static async approveOrder(orderId: string, adminUserId: string) {
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.status !== OrderStatus.SUBMITTED && order.status !== OrderStatus.DRAFT) {
      throw new AppError(`Cannot approve order with status ${order.status}.`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.APPROVED,
          approvedById: adminUserId,
          approvedAt: new Date(),
        },
        include: { customer: true, items: { include: { product: true } } },
      });

      await AuditService.log(tx, {
        userId: adminUserId,
        action: 'APPROVE',
        entityType: 'ORDER',
        entityId: orderId,
        newValues: { status: OrderStatus.APPROVED },
      });

      return updated;
    });
  }

  /**
   * Reject an order (Admin)
   */
  static async rejectOrder(orderId: string, reason: string, adminUserId: string) {
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found.', 404);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.REJECTED,
          rejectionReason: reason,
        },
      });

      await AuditService.log(tx, {
        userId: adminUserId,
        action: 'REJECT',
        entityType: 'ORDER',
        entityId: orderId,
        newValues: { status: OrderStatus.REJECTED, reason },
      });

      return updated;
    });
  }
}
