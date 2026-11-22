import { Prisma, OrderStatus, ItemType, Role } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';
import { GSTService, GSTCalculationItem } from './gst.service.js';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  discountPercent?: number;
}

export class OrderService {
  /**
   * Create a new sales order (Salesman, Admin, Owner)
   */
  static async createOrder(params: {
    customerId: string;
    salesmanId: string;
    callerRole?: Role;
    callerUserId?: string;
    orderNotes?: string;
    deliveryDate?: Date;
    paymentTerms?: string;
    status?: OrderStatus;
    items: CreateOrderItemInput[];
  }) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Order must contain at least one item.', 400);
    }

    // Verify customer exists and is active
    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
    });
    if (!customer) throw new AppError('Customer not found.', 404);
    if (!customer.active) throw new AppError('Cannot create order for an inactive customer.', 400);

    // Security: If salesman, verify customer is assigned to this salesman
    if (params.callerRole === Role.SALESMAN && customer.salesmanId && customer.salesmanId !== params.salesmanId) {
      throw new AppError('Forbidden: You can only create orders for your assigned customers.', 403);
    }

    // Prepare items for GST calculation & validate products
    const gstCalcItems: GSTCalculationItem[] = [];
    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new AppError('Item quantity must be greater than zero.', 400);
      }

      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new AppError(`Product not found: ${item.productId}`, 404);
      if (!product.active) throw new AppError(`Cannot order inactive product: ${product.name}`, 400);

      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : Number(product.sellingPrice);
      gstCalcItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        discount: item.discount,
        discountPercent: item.discountPercent,
        gstRate: Number(product.gstRate),
      });
    }

    // Calculate taxes via GST engine
    const gstResult = await GSTService.calculateGST({
      customerStateCode: customer.stateCode || '33',
      customerState: customer.state,
      items: gstCalcItems,
    });

    return prisma.$transaction(async (tx) => {
      const count = await tx.salesOrder.count();
      const orderNumber = `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const orderItemsData = gstResult.items.map((it) => ({
        productId: it.productId,
        quantity: new Prisma.Decimal(it.quantity),
        allocatedQuantity: new Prisma.Decimal(0.0),
        dispatchedQuantity: new Prisma.Decimal(0.0),
        unitPrice: new Prisma.Decimal(it.unitPrice),
        discount: new Prisma.Decimal(it.discount),
        gstRate: new Prisma.Decimal(it.gstRate),
        taxableAmount: new Prisma.Decimal(it.taxableAmount),
        gstAmount: new Prisma.Decimal(it.cgstAmount + it.sgstAmount + it.igstAmount),
        totalAmount: new Prisma.Decimal(it.totalAmount),
      }));

      const initialStatus = params.status || OrderStatus.SUBMITTED;

      const order = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: params.customerId,
          salesmanId: params.salesmanId,
          deliveryDate: params.deliveryDate || null,
          paymentTerms: params.paymentTerms || customer.paymentTerms || '30 Days Net',
          status: initialStatus,
          subtotal: new Prisma.Decimal(gstResult.subtotal),
          estimatedGst: new Prisma.Decimal(gstResult.totalGst),
          grandTotal: new Prisma.Decimal(gstResult.grandTotal),
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
        userId: params.callerUserId || params.salesmanId,
        action: 'CREATE',
        entityType: 'ORDER',
        entityId: order.id,
        newValues: { orderNumber, customerId: params.customerId, grandTotal: gstResult.grandTotal, status: initialStatus },
      });

      return order;
    });
  }

  /**
   * Submit draft order for approval
   */
  static async submitOrder(orderId: string, userId: string) {
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.status !== OrderStatus.DRAFT) {
      throw new AppError(`Cannot submit order with status '${order.status}'. Must be DRAFT.`, 400);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.SUBMITTED },
        include: { customer: true, items: { include: { product: true } } },
      });

      await AuditService.log(tx, {
        userId,
        action: 'SUBMIT',
        entityType: 'ORDER',
        entityId: orderId,
        newValues: { status: OrderStatus.SUBMITTED },
      });

      return updated;
    });
  }

  /**
   * Modify order quantities and prices before approval (Admin)
   */
  static async updateOrder(params: {
    orderId: string;
    items: CreateOrderItemInput[];
    orderNotes?: string;
    deliveryDate?: Date | string;
    paymentTerms?: string;
    adminUserId: string;
    callerRole?: Role;
  }) {
    if (params.callerRole === Role.SALESMAN) {
      throw new AppError('Forbidden: Salesmen cannot modify submitted orders or override prices.', 403);
    }

    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id: params.orderId },
      include: { customer: true, items: true },
    });

    if (!existingOrder) throw new AppError('Order not found.', 404);
    if (existingOrder.status !== OrderStatus.SUBMITTED && existingOrder.status !== OrderStatus.DRAFT && existingOrder.status !== OrderStatus.PENDING_APPROVAL) {
      throw new AppError(
        `Cannot modify order with status ${existingOrder.status}. Modifications only permitted before approval.`,
        400
      );
    }

    if (!params.items || params.items.length === 0) {
      throw new AppError('Order must contain at least one item.', 400);
    }

    const gstCalcItems: GSTCalculationItem[] = [];
    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new AppError('Item quantity must be greater than zero.', 400);
      }

      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new AppError(`Product not found: ${item.productId}`, 404);

      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : Number(product.sellingPrice);
      gstCalcItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        discount: item.discount,
        discountPercent: item.discountPercent,
        gstRate: Number(product.gstRate),
      });
    }

    const gstResult = await GSTService.calculateGST({
      customerStateCode: existingOrder.customer.stateCode || '33',
      customerState: existingOrder.customer.state,
      items: gstCalcItems,
    });

    return prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: existingOrder.id },
      });

      // Create new items
      const newItemsData = gstResult.items.map((it) => ({
        salesOrderId: existingOrder.id,
        productId: it.productId,
        quantity: new Prisma.Decimal(it.quantity),
        allocatedQuantity: new Prisma.Decimal(0.0),
        dispatchedQuantity: new Prisma.Decimal(0.0),
        unitPrice: new Prisma.Decimal(it.unitPrice),
        discount: new Prisma.Decimal(it.discount),
        gstRate: new Prisma.Decimal(it.gstRate),
        taxableAmount: new Prisma.Decimal(it.taxableAmount),
        gstAmount: new Prisma.Decimal(it.cgstAmount + it.sgstAmount + it.igstAmount),
        totalAmount: new Prisma.Decimal(it.totalAmount),
      }));

      await tx.salesOrderItem.createMany({
        data: newItemsData,
      });

      const updated = await tx.salesOrder.update({
        where: { id: existingOrder.id },
        data: {
          subtotal: new Prisma.Decimal(gstResult.subtotal),
          estimatedGst: new Prisma.Decimal(gstResult.totalGst),
          grandTotal: new Prisma.Decimal(gstResult.grandTotal),
          orderNotes: params.orderNotes !== undefined ? params.orderNotes : existingOrder.orderNotes,
          deliveryDate: params.deliveryDate !== undefined ? params.deliveryDate : existingOrder.deliveryDate,
          paymentTerms: params.paymentTerms !== undefined ? params.paymentTerms : existingOrder.paymentTerms,
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
          subtotal: gstResult.subtotal,
          grandTotal: gstResult.grandTotal,
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
   * Approve an order (Admin / Owner)
   * Prevents salesman from approving own order
   */
  static async approveOrder(orderId: string, approvedById: string, callerRole?: Role) {
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found.', 404);

    // Security rule: Salesman cannot approve their own order
    if (order.salesmanId === approvedById) {
      throw new AppError('Forbidden: Salesman cannot approve their own order.', 403);
    }

    // Role verification: Only ADMIN and OWNER can approve sales orders
    if (callerRole && callerRole !== Role.ADMIN && callerRole !== Role.OWNER) {
      throw new AppError(`Forbidden: ${callerRole} role cannot approve sales orders.`, 403);
    }

    if (
      order.status !== OrderStatus.SUBMITTED &&
      order.status !== OrderStatus.DRAFT &&
      order.status !== OrderStatus.PENDING_APPROVAL
    ) {
      throw new AppError(`Cannot approve order with status '${order.status}'.`, 400);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.APPROVED,
          approvedById,
          approvedAt: new Date(),
        },
        include: { customer: true, items: { include: { product: true } } },
      });

      await AuditService.log(tx, {
        userId: approvedById,
        action: 'APPROVE',
        entityType: 'ORDER',
        entityId: orderId,
        newValues: { status: OrderStatus.APPROVED, approvedById },
      });

      return updated;
    });
  }

  /**
   * Reject an order (Admin / Owner)
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

  /**
   * Cancel an order and release any active allocations
   */
  static async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { allocations: true },
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.status === OrderStatus.DISPATCHED || order.status === OrderStatus.COMPLETED) {
      throw new AppError(`Cannot cancel order in '${order.status}' status. Dispatched orders require a sales return.`, 400);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Release active stock allocations if any
      await tx.stockAllocationItem.updateMany({
        where: {
          allocation: { salesOrderId: orderId },
          status: 'ALLOCATED',
        },
        data: { status: 'RELEASED' },
      });

      await tx.stockAllocation.updateMany({
        where: { salesOrderId: orderId, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });

      // Reset allocatedQuantity on all order items
      await tx.salesOrderItem.updateMany({
        where: { salesOrderId: orderId },
        data: { allocatedQuantity: new Prisma.Decimal(0.0) },
      });

      // 2. Set order status to CANCELLED
      const updated = await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          orderNotes: order.orderNotes ? `${order.orderNotes} | Cancelled: ${reason || 'User cancelled'}` : `Cancelled: ${reason || 'User cancelled'}`,
        },
      });

      await AuditService.log(tx, {
        userId,
        action: 'CANCEL',
        entityType: 'ORDER',
        entityId: orderId,
        newValues: { status: OrderStatus.CANCELLED, reason },
      });

      return updated;
    });
  }

  /**
   * Get orders list with role-based scoping and filters
   */
  static async getOrders(filters: {
    status?: OrderStatus;
    customerId?: string;
    salesmanId?: string;
    callerRole?: Role;
    callerUserId?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.SalesOrderWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;

    // RBAC: Salesman can only view their own orders
    if (filters.callerRole === Role.SALESMAN) {
      where.salesmanId = filters.callerUserId;
    } else if (filters.salesmanId) {
      where.salesmanId = filters.salesmanId;
    }

    if (filters.startDate || filters.endDate) {
      where.orderDate = {};
      if (filters.startDate) where.orderDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.orderDate.lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (filters.page !== undefined || filters.limit !== undefined) {
      const page = Math.max(1, Number(filters.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
      const skip = (page - 1) * limit;

      const [total, orders] = await Promise.all([
        prisma.salesOrder.count({ where }),
        prisma.salesOrder.findMany({
          where,
          skip,
          take: limit,
          include: {
            customer: true,
            salesman: { select: { id: true, fullName: true, email: true } },
            items: { include: { product: true } },
            invoice: { select: { id: true, invoiceNumber: true, status: true, grandTotal: true } },
            dispatch: { select: { id: true, dispatchNumber: true, deliveryStatus: true } },
          },
          orderBy: { orderDate: 'desc' },
        }),
      ]);

      return {
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      include: {
        customer: true,
        salesman: { select: { id: true, fullName: true, email: true } },
        items: { include: { product: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, grandTotal: true } },
        dispatch: { select: { id: true, dispatchNumber: true, deliveryStatus: true } },
      },
      orderBy: { orderDate: 'desc' },
    });

    return { data: orders };
  }

  /**
   * Get single order by ID with role check
   */
  static async getOrderById(orderId: string, callerRole?: Role, callerUserId?: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        salesman: { select: { id: true, fullName: true, email: true, phone: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        items: { include: { product: true } },
        invoice: true,
        dispatch: { include: { items: { include: { product: true } } } },
        allocations: { include: { items: { include: { product: true } } } },
        returns: { include: { items: { include: { product: true } } } },
      },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Security: Salesman cannot view another salesman's order
    if (callerRole === Role.SALESMAN && order.salesmanId !== callerUserId) {
      throw new AppError('Forbidden: You can only view your own orders.', 403);
    }

    return order;
  }
}
