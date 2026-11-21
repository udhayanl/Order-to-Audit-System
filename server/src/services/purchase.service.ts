import { Prisma, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface PurchaseItemInput {
  itemType: ItemType;
  rawMaterialId?: string;
  packagingMaterialId?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate?: number;
}

export interface CreatePurchaseInput {
  supplierId: string;
  purchaseDate?: Date;
  supplierInvoiceNumber?: string;
  items: PurchaseItemInput[];
  notes?: string;
  status?: string; // 'DRAFT', 'CONFIRMED', 'RECEIVED'
  userId: string;
}

export interface GoodsReceiptItemInput {
  purchaseItemId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity?: number;
  batchNumber?: string;
  expiryDate?: Date;
  rejectionReason?: string;
}

export interface CreateGoodsReceiptInput {
  purchaseId: string;
  receiptDate?: Date;
  challanNumber?: string;
  vehicleNumber?: string;
  items: GoodsReceiptItemInput[];
  notes?: string;
  userId: string;
}

export class PurchaseService {
  /**
   * Create a purchase order (Status DRAFT or CONFIRMED) without increasing inventory
   */
  static async createPurchase(params: CreatePurchaseInput) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Purchase must contain at least one item.');
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: params.supplierId },
    });
    if (!supplier) throw new AppError('Supplier not found.', 404);

    return prisma.$transaction(async (tx) => {
      const count = await tx.purchase.count();
      const purchaseNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      let totalTaxable = 0;
      let totalGst = 0;
      const purchaseItemsData = [];

      for (const item of params.items) {
        const itemId = item.rawMaterialId || item.packagingMaterialId;
        if (!itemId) throw new AppError('Each purchase item must reference a raw material or packaging material.');

        const qty = item.quantity;
        const rate = item.unitPrice;
        if (qty <= 0) throw new AppError('Purchase item quantity must be greater than zero.');
        if (rate < 0) throw new AppError('Purchase item unit price cannot be negative.');

        const gstRate = item.gstRate !== undefined ? item.gstRate : 5.0;
        const taxable = Math.round(qty * rate * 100) / 100;
        const gst = Math.round((taxable * (gstRate / 100)) * 100) / 100;
        const total = Math.round((taxable + gst) * 100) / 100;

        totalTaxable += taxable;
        totalGst += gst;

        purchaseItemsData.push({
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId || null,
          packagingMaterialId: item.packagingMaterialId || null,
          quantity: new Prisma.Decimal(qty),
          receivedQuantity: new Prisma.Decimal(0.0),
          unit: item.unit,
          unitPrice: new Prisma.Decimal(rate),
          gstRate: new Prisma.Decimal(gstRate),
          taxableAmount: new Prisma.Decimal(taxable),
          gstAmount: new Prisma.Decimal(gst),
          totalAmount: new Prisma.Decimal(total),
        });
      }

      const grandTotal = Math.round((totalTaxable + totalGst) * 100) / 100;
      const status = params.status || 'DRAFT';

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: params.supplierId,
          supplierInvoiceNumber: params.supplierInvoiceNumber || null,
          purchaseDate: params.purchaseDate || new Date(),
          totalTaxable: new Prisma.Decimal(totalTaxable),
          totalGst: new Prisma.Decimal(totalGst),
          grandTotal: new Prisma.Decimal(grandTotal),
          status,
          notes: params.notes || null,
          createdById: params.userId,
          items: {
            create: purchaseItemsData,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'PURCHASE',
        entityId: purchase.id,
        newValues: { purchaseNumber, supplierId: params.supplierId, grandTotal, status },
      });

      return purchase;
    });
  }

  /**
   * Confirm a draft purchase order
   */
  static async confirmPurchase(purchaseId: string, userId: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new AppError('Purchase order not found.', 404);
    if (purchase.status !== 'DRAFT') {
      throw new AppError(`Cannot confirm purchase with status '${purchase.status}'. Expected 'DRAFT'.`);
    }

    const updated = await prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: 'CONFIRMED' },
      include: {
        supplier: true,
        items: true,
      },
    });

    await AuditService.log(prisma, {
      userId,
      action: 'UPDATE',
      entityType: 'PURCHASE',
      entityId: purchase.id,
      newValues: { status: 'CONFIRMED' },
    });

    return updated;
  }

  /**
   * Post a Goods Receipt Note (GRN) against a confirmed purchase.
   * Only accepted quantities increase inventory and create FIFO valuation layers!
   */
  static async postGoodsReceipt(params: CreateGoodsReceiptInput) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Goods Receipt Note must contain at least one item.');
    }

    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: params.purchaseId },
        include: { items: true, supplier: true },
      });

      if (!purchase) throw new AppError('Purchase order not found.', 404);
      if (purchase.status === 'CANCELLED') throw new AppError('Cannot receive against a cancelled purchase.');
      if (purchase.status === 'RECEIVED') throw new AppError('Purchase has already been fully received.');

      const count = await tx.goodsReceipt.count();
      const grnNumber = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const grnItemsData = [];
      let allFullyReceived = true;

      for (const receiptItem of params.items) {
        const poItem = purchase.items.find(i => i.id === receiptItem.purchaseItemId);
        if (!poItem) {
          throw new AppError(`Purchase item '${receiptItem.purchaseItemId}' not found in purchase '${purchase.purchaseNumber}'.`);
        }

        const orderedQty = Number(poItem.quantity);
        const alreadyReceived = Number(poItem.receivedQuantity);
        const outstandingQty = Math.round((orderedQty - alreadyReceived) * 1000) / 1000;

        const acceptedQty = Number(receiptItem.acceptedQuantity);
        const rejectedQty = Number(receiptItem.rejectedQuantity || 0);
        const totalReceived = Math.round((acceptedQty + rejectedQty) * 1000) / 1000;

        // Prevent receiving exceeding authorized purchase quantities
        if (acceptedQty > outstandingQty + 0.0001) {
          throw new AppError(
            `Receipt quantity (${acceptedQty}) exceeds outstanding purchase quantity (${outstandingQty}) for item ${poItem.id}.`
          );
        }

        const itemId = poItem.rawMaterialId || poItem.packagingMaterialId;
        if (!itemId) throw new AppError('Purchase item lacks material reference.');

        const unitPrice = Number(poItem.unitPrice);

        // Only accepted quantity increases inventory!
        if (acceptedQty > 0) {
          // 1. Record stock addition in StockLedger
          await InventoryService.receiveStock(tx, {
            itemType: poItem.itemType,
            itemId,
            movementType: StockMovementType.PURCHASE_RECEIPT,
            quantity: acceptedQty,
            unit: poItem.unit,
            unitCost: unitPrice,
            referenceType: 'GRN',
            referenceId: grnNumber,
            batchNumber: receiptItem.batchNumber,
            expiryDate: receiptItem.expiryDate,
            notes: `GRN ${grnNumber} from ${purchase.supplier.name} (PO: ${purchase.purchaseNumber})`,
            userId: params.userId,
          });
        }

        // Update received quantity on PurchaseItem
        const newReceivedQty = Math.round((alreadyReceived + acceptedQty) * 1000) / 1000;
        await tx.purchaseItem.update({
          where: { id: poItem.id },
          data: { receivedQuantity: new Prisma.Decimal(newReceivedQty) },
        });

        if (newReceivedQty < orderedQty - 0.0001) {
          allFullyReceived = false;
        }

        grnItemsData.push({
          purchaseItemId: poItem.id,
          itemType: poItem.itemType,
          rawMaterialId: poItem.rawMaterialId,
          packagingMaterialId: poItem.packagingMaterialId,
          orderedQuantity: new Prisma.Decimal(orderedQty),
          receivedQuantity: new Prisma.Decimal(totalReceived),
          acceptedQuantity: new Prisma.Decimal(acceptedQty),
          rejectedQuantity: new Prisma.Decimal(rejectedQty),
          unit: poItem.unit,
          unitPrice: new Prisma.Decimal(unitPrice),
          batchNumber: receiptItem.batchNumber || null,
          expiryDate: receiptItem.expiryDate || null,
          rejectionReason: receiptItem.rejectionReason || null,
        });
      }

      // Check if any other PO items are still unreceived
      for (const item of purchase.items) {
        const matchingReceipt = params.items.find(r => r.purchaseItemId === item.id);
        if (!matchingReceipt) {
          if (Number(item.receivedQuantity) < Number(item.quantity) - 0.0001) {
            allFullyReceived = false;
          }
        }
      }

      const newPurchaseStatus = allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: newPurchaseStatus,
          receivedDate: new Date(),
        },
      });

      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          purchaseId: purchase.id,
          receiptDate: params.receiptDate || new Date(),
          challanNumber: params.challanNumber || null,
          vehicleNumber: params.vehicleNumber || null,
          status: 'POSTED',
          notes: params.notes || null,
          receivedById: params.userId,
          items: {
            create: grnItemsData,
          },
        },
        include: {
          purchase: { include: { supplier: true } },
          items: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
          receivedBy: {
            select: { id: true, fullName: true, role: true },
          },
        },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'GOODS_RECEIPT',
        entityId: goodsReceipt.id,
        newValues: { grnNumber, purchaseId: purchase.id, status: 'POSTED', newPurchaseStatus },
      });

      return goodsReceipt;
    });
  }

  /**
   * One-shot purchase & immediate goods receipt (Maintained for benchmark & script compatibility)
   */
  static async recordPurchase(params: {
    supplierId: string;
    purchaseDate?: Date;
    supplierInvoiceNumber?: string;
    items: PurchaseItemInput[];
    notes?: string;
    userId: string;
  }) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Purchase must contain at least one item.');
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: params.supplierId },
    });
    if (!supplier) throw new AppError('Supplier not found.', 404);

    return prisma.$transaction(async (tx) => {
      const count = await tx.purchase.count();
      const purchaseNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const grnCount = await tx.goodsReceipt.count();
      const grnNumber = `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(4, '0')}`;

      let totalTaxable = 0;
      let totalGst = 0;
      const purchaseItemsData = [];
      const grnItemsData = [];

      for (const item of params.items) {
        const itemId = item.rawMaterialId || item.packagingMaterialId;
        if (!itemId) throw new AppError('Each purchase item must reference a raw material or packaging item.');

        const qty = item.quantity;
        const rate = item.unitPrice;
        if (qty <= 0) throw new AppError('Purchase item quantity must be greater than zero.');
        if (rate < 0) throw new AppError('Purchase item unit price cannot be negative.');

        const gstRate = item.gstRate !== undefined ? item.gstRate : 5.0;
        const taxable = Math.round(qty * rate * 100) / 100;
        const gst = Math.round((taxable * (gstRate / 100)) * 100) / 100;
        const total = Math.round((taxable + gst) * 100) / 100;

        totalTaxable += taxable;
        totalGst += gst;

        // 1. Record stock addition in StockLedger & FIFO layer
        await InventoryService.receiveStock(tx, {
          itemType: item.itemType,
          itemId,
          movementType: StockMovementType.PURCHASE_RECEIPT,
          quantity: qty,
          unit: item.unit,
          unitCost: rate,
          referenceType: 'PURCHASE',
          referenceId: purchaseNumber,
          notes: `Receipt from ${supplier.name} (${purchaseNumber})`,
          userId: params.userId,
        });

        purchaseItemsData.push({
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId || null,
          packagingMaterialId: item.packagingMaterialId || null,
          quantity: new Prisma.Decimal(qty),
          receivedQuantity: new Prisma.Decimal(qty),
          unit: item.unit,
          unitPrice: new Prisma.Decimal(rate),
          gstRate: new Prisma.Decimal(gstRate),
          taxableAmount: new Prisma.Decimal(taxable),
          gstAmount: new Prisma.Decimal(gst),
          totalAmount: new Prisma.Decimal(total),
        });

        grnItemsData.push({
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId || null,
          packagingMaterialId: item.packagingMaterialId || null,
          orderedQuantity: new Prisma.Decimal(qty),
          receivedQuantity: new Prisma.Decimal(qty),
          acceptedQuantity: new Prisma.Decimal(qty),
          rejectedQuantity: new Prisma.Decimal(0.0),
          unit: item.unit,
          unitPrice: new Prisma.Decimal(rate),
        });
      }

      const grandTotal = Math.round((totalTaxable + totalGst) * 100) / 100;

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: params.supplierId,
          supplierInvoiceNumber: params.supplierInvoiceNumber || null,
          purchaseDate: params.purchaseDate || new Date(),
          receivedDate: params.purchaseDate || new Date(),
          totalTaxable: new Prisma.Decimal(totalTaxable),
          totalGst: new Prisma.Decimal(totalGst),
          grandTotal: new Prisma.Decimal(grandTotal),
          status: 'RECEIVED',
          notes: params.notes || null,
          createdById: params.userId,
          items: {
            create: purchaseItemsData,
          },
          goodsReceipts: {
            create: [
              {
                grnNumber,
                receiptDate: params.purchaseDate || new Date(),
                status: 'POSTED',
                notes: `Auto-generated GRN for ${purchaseNumber}`,
                receivedById: params.userId,
                items: {
                  create: grnItemsData,
                },
              },
            ],
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
          goodsReceipts: true,
        },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'PURCHASE',
        entityId: purchase.id,
        newValues: { purchaseNumber, supplierId: params.supplierId, grandTotal },
      });

      return purchase;
    });
  }

  /**
   * Get all purchases with filters
   */
  static async getPurchases(filters?: { supplierId?: string; status?: string }) {
    const where: any = {};
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.status) where.status = filters.status;

    return prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
        goodsReceipts: true,
        createdBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    });
  }

  /**
   * Get single purchase details
   */
  static async getPurchaseById(id: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
        goodsReceipts: {
          include: {
            items: {
              include: {
                rawMaterial: true,
                packagingMaterial: true,
              },
            },
            receivedBy: {
              select: { id: true, fullName: true, role: true },
            },
          },
        },
        createdBy: {
          select: { id: true, fullName: true, role: true, email: true },
        },
      },
    });

    if (!purchase) throw new AppError('Purchase order not found.', 404);
    return purchase;
  }

  /**
   * Get all Goods Receipt Notes
   */
  static async getGoodsReceipts(filters?: { purchaseId?: string }) {
    const where: any = {};
    if (filters?.purchaseId) where.purchaseId = filters.purchaseId;

    return prisma.goodsReceipt.findMany({
      where,
      include: {
        purchase: {
          include: { supplier: true },
        },
        items: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
        receivedBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { receiptDate: 'desc' },
    });
  }

  /**
   * Get single Goods Receipt Note by ID
   */
  static async getGoodsReceiptById(id: string) {
    const grn = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchase: {
          include: { supplier: true, items: true },
        },
        items: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
            purchaseItem: true,
          },
        },
        receivedBy: {
          select: { id: true, fullName: true, role: true, email: true },
        },
      },
    });

    if (!grn) throw new AppError('Goods Receipt Note not found.', 404);
    return grn;
  }
}
