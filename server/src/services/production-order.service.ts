import { Prisma, ItemType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { ProductionPlanningService } from './production-planning.service.js';
import { AuditService } from './audit.service.js';

export interface CreateProductionOrderInput {
  productId: string;
  bomId: string;
  plannedOutputQuantity: number;
  startDate?: Date;
  expectedCompletionDate?: Date;
  supervisorId?: string;
  priority?: string;
  notes?: string;
  autoReserve?: boolean;
}

export class ProductionOrderService {
  /**
   * Create a planned production order and capture immutable BOM snapshot
   */
  static async createOrder(params: CreateProductionOrderInput, userId: string) {
    if (params.plannedOutputQuantity <= 0) {
      throw new AppError('Planned output quantity must be greater than zero.');
    }

    const bom = await prisma.bOM.findUnique({
      where: { id: params.bomId },
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

    if (!bom) throw new AppError('BOM not found.', 404);
    if (!bom.active && bom.status !== 'ACTIVE') {
      throw new AppError('Cannot create production order with an inactive BOM version.');
    }

    const requirements = await ProductionPlanningService.calculateMaterialRequirements(
      params.bomId,
      params.plannedOutputQuantity
    );

    return prisma.$transaction(async (tx) => {
      const count = await tx.productionOrder.count();
      const orderNumber = `MFG-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // 1. Create Production Order
      const order = await tx.productionOrder.create({
        data: {
          orderNumber,
          productId: params.productId,
          bomId: params.bomId,
          bomVersion: bom.version,
          plannedBatchQuantity: new Prisma.Decimal(params.plannedOutputQuantity),
          plannedOutputQuantity: new Prisma.Decimal(params.plannedOutputQuantity),
          startDate: params.startDate || new Date(),
          expectedCompletionDate: params.expectedCompletionDate || null,
          supervisorId: params.supervisorId || null,
          priority: params.priority || 'MEDIUM',
          notes: params.notes || null,
          status: 'DRAFT',
          createdById: userId,
        },
      });

      // 2. Create immutable ProductionBOMSnapshot
      const snapshotItems = requirements.items.map((it) => ({
        itemType: it.itemType,
        rawMaterialId: it.itemType === ItemType.RAW_MATERIAL ? it.itemId : null,
        packagingMaterialId: it.itemType === ItemType.PACKAGING ? it.itemId : null,
        materialName: it.name,
        materialCode: it.code,
        standardQuantity: new Prisma.Decimal(it.standardQuantity),
        scaledQuantity: new Prisma.Decimal(it.scaledQuantity),
        unit: it.unit,
      }));

      await tx.productionBOMSnapshot.create({
        data: {
          productionOrderId: order.id,
          bomId: bom.id,
          bomName: bom.name,
          version: bom.version,
          standardBatchSize: bom.batchSize,
          expectedYield: bom.expectedYield,
          yieldUnit: bom.yieldUnit,
          items: {
            create: snapshotItems,
          },
        },
      });

      await AuditService.log(tx, {
        userId,
        action: 'CREATE',
        entityType: 'PRODUCTION_ORDER',
        entityId: order.id,
        newValues: { orderNumber, productId: params.productId, plannedOutputQuantity: params.plannedOutputQuantity },
      });

      return this.getOrderById(order.id, tx);
    });
  }

  /**
   * Submit draft order for approval
   */
  static async submitOrder(orderId: string, userId: string) {
    const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Production order not found.', 404);
    if (order.status !== 'DRAFT') throw new AppError(`Cannot submit order with status '${order.status}'.`);

    return prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: 'PLANNED' },
    });
  }

  /**
   * Approve production order (Admin / Owner)
   */
  static async approveOrder(orderId: string, approvedById: string, forceShortage = false) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: { bomSnapshot: { include: { items: true } } },
    });

    if (!order) throw new AppError('Production order not found.', 404);
    if (order.status === 'APPROVED' || order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new AppError(`Cannot approve order with status '${order.status}'.`);
    }

    // Check material availability
    const reqs = await ProductionPlanningService.calculateMaterialRequirements(
      order.bomId,
      Number(order.plannedOutputQuantity)
    );

    if (reqs.hasShortage && !forceShortage) {
      const shortages = reqs.items.filter(i => i.hasShortage).map(i => `${i.name} (shortage: ${i.shortageQuantity} ${i.unit})`).join(', ');
      throw new AppError(`Cannot approve production order due to material shortages: ${shortages}.`);
    }

    const updated = await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: 'APPROVED',
        approvedById,
      },
    });

    await AuditService.log(prisma, {
      userId: approvedById,
      action: 'APPROVE',
      entityType: 'PRODUCTION_ORDER',
      entityId: order.id,
      newValues: { status: 'APPROVED', approvedById },
    });

    return updated;
  }

  /**
   * Reserve available materials for an approved production order
   */
  static async reserveMaterials(orderId: string, userId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        bomSnapshot: { include: { items: true } },
        reservations: true,
      },
    });

    if (!order) throw new AppError('Production order not found.', 404);
    if (order.status !== 'APPROVED' && order.status !== 'PLANNED') {
      throw new AppError(`Cannot reserve materials for order with status '${order.status}'. Must be APPROVED.`);
    }

    // Release existing active reservations if re-reserving
    return prisma.$transaction(async (tx) => {
      await tx.materialReservation.updateMany({
        where: { productionOrderId: orderId, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });

      const reqs = await ProductionPlanningService.calculateMaterialRequirements(
        order.bomId,
        Number(order.plannedOutputQuantity)
      );

      // Check if shortages prevent full reservation
      if (reqs.hasShortage) {
        const shortages = reqs.items.filter(i => i.hasShortage).map(i => `${i.name}: Shortage ${i.shortageQuantity} ${i.unit}`).join(', ');
        throw new AppError(`Cannot reserve materials due to insufficient stock: ${shortages}`);
      }

      for (const item of reqs.items) {
        await tx.materialReservation.create({
          data: {
            productionOrderId: order.id,
            itemType: item.itemType,
            itemId: item.itemId,
            reservedQuantity: new Prisma.Decimal(item.scaledQuantity),
            unit: item.unit,
            status: 'ACTIVE',
          },
        });
      }

      const updated = await tx.productionOrder.update({
        where: { id: order.id },
        data: { status: 'MATERIALS_RESERVED' },
      });

      return updated;
    });
  }

  /**
   * Release active material reservations
   */
  static async releaseReservations(orderId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.materialReservation.updateMany({
        where: { productionOrderId: orderId, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: { status: 'APPROVED' },
      });
    });
  }

  /**
   * Cancel production order and release reservations
   */
  static async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Production order not found.', 404);
    if (order.status === 'COMPLETED') throw new AppError('Cannot cancel a completed production order.');

    return prisma.$transaction(async (tx) => {
      // 1. Release active reservations
      await tx.materialReservation.updateMany({
        where: { productionOrderId: orderId, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });

      // 2. Set order status to CANCELLED
      const updated = await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          notes: order.notes ? `${order.notes} | Cancelled: ${reason || 'User cancelled'}` : `Cancelled: ${reason || 'User cancelled'}`,
        },
      });

      await AuditService.log(tx, {
        userId,
        action: 'CANCEL',
        entityType: 'PRODUCTION_ORDER',
        entityId: orderId,
        newValues: { status: 'CANCELLED', reason },
      });

      return updated;
    });
  }

  /**
   * Get single order by ID with full relations
   */
  static async getOrderById(id: string, tx: any = prisma) {
    const order = await tx.productionOrder.findUnique({
      where: { id },
      include: {
        product: true,
        bom: true,
        bomSnapshot: {
          include: {
            items: true,
          },
        },
        supervisor: {
          select: { id: true, fullName: true, role: true, email: true },
        },
        createdBy: {
          select: { id: true, fullName: true, role: true },
        },
        approvedBy: {
          select: { id: true, fullName: true, role: true },
        },
        reservations: true,
        materialIssues: {
          include: {
            items: true,
          },
        },
        executions: true,
        outputs: true,
        qualityInspections: true,
      },
    });

    if (!order) throw new AppError('Production order not found.', 404);
    return order;
  }

  /**
   * Get list of production orders with filters
   */
  static async getOrders(filters?: {
    status?: string;
    productId?: string;
    supervisorId?: string;
  }) {
    const where: any = {};
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters?.productId) where.productId = filters.productId;
    if (filters?.supervisorId) where.supervisorId = filters.supervisorId;

    return prisma.productionOrder.findMany({
      where,
      include: {
        product: true,
        bom: true,
        supervisor: {
          select: { id: true, fullName: true, role: true },
        },
        createdBy: {
          select: { id: true, fullName: true, role: true },
        },
        outputs: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
