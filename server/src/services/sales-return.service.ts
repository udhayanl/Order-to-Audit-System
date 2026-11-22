import { Prisma, ItemType, StockMovementType, Role } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';
import { GSTService } from './gst.service.js';

export interface SalesReturnItemInput {
  productId: string;
  returnedQuantity: number;
  condition: 'GOOD' | 'DAMAGED' | 'EXPIRED' | 'QUARANTINED';
  unitPrice?: number;
  batchNumber?: string;
  notes?: string;
}

export class SalesReturnService {
  /**
   * Create a Sales Return with automatic Credit Note generation and conditional inventory restocking
   */
  static async createReturn(params: {
    customerId: string;
    salesOrderId?: string;
    invoiceId?: string;
    dispatchId?: string;
    returnReason: 'DAMAGED_GOODS' | 'EXPIRED_GOODS' | 'INCORRECT_PRODUCT' | 'INCORRECT_QUANTITY' | 'QUALITY_COMPLAINT' | 'OTHER';
    notes?: string;
    items: SalesReturnItemInput[];
    userId: string;
  }) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('At least one item must be included in the return.', 400);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
    });
    if (!customer) throw new AppError('Customer not found.', 404);

    // If dispatchId or salesOrderId is provided, validate return quantities against dispatch/order
    let dispatch = null;
    if (params.dispatchId) {
      dispatch = await prisma.dispatch.findUnique({
        where: { id: params.dispatchId },
        include: { items: true, order: true },
      });
      if (!dispatch) throw new AppError('Dispatch record not found.', 404);
    } else if (params.salesOrderId) {
      dispatch = await prisma.dispatch.findUnique({
        where: { orderId: params.salesOrderId },
        include: { items: true, order: true },
      });
    }

    // Also look up invoice if provided or linked to dispatch/order
    let invoice = null;
    const invoiceIdToSearch = params.invoiceId || dispatch?.invoiceId;
    if (invoiceIdToSearch) {
      invoice = await prisma.invoice.findUnique({
        where: { id: invoiceIdToSearch },
        include: { items: true },
      });
    }

    return prisma.$transaction(async (tx) => {
      // 1. Validate return quantities
      for (const item of params.items) {
        if (item.returnedQuantity <= 0) {
          throw new AppError('Return quantity must be greater than zero.', 400);
        }

        if (dispatch) {
          const dispatchItem = dispatch.items.find((di) => di.productId === item.productId);
          if (!dispatchItem) {
            throw new AppError(`Product ${item.productId} was not dispatched in this shipment.`, 400);
          }

          // Check existing returns for this dispatch and product
          const existingReturns = await tx.salesReturnItem.aggregate({
            where: {
              productId: item.productId,
              salesReturn: { dispatchId: dispatch.id },
            },
            _sum: { returnedQuantity: true },
          });

          const alreadyReturned = Number(existingReturns._sum.returnedQuantity || 0);
          const maxAllowed = Number(dispatchItem.quantity) - alreadyReturned;

          if (item.returnedQuantity > maxAllowed + 0.0001) {
            throw new AppError(
              `Cannot return ${item.returnedQuantity}. Total dispatched was ${dispatchItem.quantity}, already returned ${alreadyReturned}. Maximum returnable is ${maxAllowed}.`,
              400
            );
          }
        }
      }

      // 2. Generate Return Number e.g. SR-2026-0001
      const returnCount = await tx.salesReturn.count();
      const returnNumber = `SR-${new Date().getFullYear()}-${String(returnCount + 1).padStart(4, '0')}`;

      // 3. Process items, calculate GST reversal, restock GOOD condition items
      const processedItems = [];
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      const isIntraState = customer.stateCode === '33';

      for (const inputItem of params.items) {
        const product = await tx.product.findUnique({ where: { id: inputItem.productId } });
        if (!product) throw new AppError(`Product ${inputItem.productId} not found.`, 404);

        // Determine unit price: from input, from invoice, from order, or from product master
        let unitPrice = inputItem.unitPrice ? Number(inputItem.unitPrice) : null;
        let gstRate = Number(product.gstRate || 5.0);

        if (unitPrice === null && invoice) {
          const invItem = invoice.items.find((ii) => ii.productId === product.id);
          if (invItem) {
            unitPrice = Number(invItem.unitPrice);
            gstRate = Number(invItem.gstRate);
          }
        }

        if (unitPrice === null) {
          unitPrice = Number(product.sellingPrice);
        }

        const taxableAmount = Math.round(inputItem.returnedQuantity * unitPrice * 100) / 100;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (isIntraState) {
          cgst = Math.round((taxableAmount * (gstRate / 2) / 100) * 100) / 100;
          sgst = Math.round((taxableAmount * (gstRate / 2) / 100) * 100) / 100;
        } else {
          igst = Math.round((taxableAmount * (gstRate / 100)) * 100) / 100;
        }

        const totalAmount = Math.round((taxableAmount + cgst + sgst + igst) * 100) / 100;

        totalTaxable += taxableAmount;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;

        let stockRestocked = false;
        let stockLedgerId: string | null = null;

        // CRITICAL INVENTORY RESTOCKING RULE:
        // ONLY condition === 'GOOD' is returned to usable finished goods inventory!
        // DAMAGED, EXPIRED, QUARANTINED are kept out of usable inventory.
        if (inputItem.condition === 'GOOD') {
          const { ledgerEntry } = await InventoryService.recordMovement(tx, {
            itemType: ItemType.FINISHED_GOOD,
            itemId: product.id,
            movementType: StockMovementType.SALES_RETURN,
            quantity: inputItem.returnedQuantity, // positive for addition (IN)
            unit: product.unit,
            direction: 'IN',
            referenceType: 'SALES_RETURN',
            referenceId: returnNumber,
            notes: `Restocked usable goods from Sales Return ${returnNumber}${inputItem.batchNumber ? ` [Batch: ${inputItem.batchNumber}]` : ''}`,
            userId: params.userId,
          });

          stockRestocked = true;
          stockLedgerId = ledgerEntry.id;
        }

        processedItems.push({
          productId: product.id,
          batchNumber: inputItem.batchNumber || null,
          returnedQuantity: new Prisma.Decimal(inputItem.returnedQuantity),
          condition: inputItem.condition,
          unitPrice: new Prisma.Decimal(unitPrice),
          taxableAmount: new Prisma.Decimal(taxableAmount),
          gstRate: new Prisma.Decimal(gstRate),
          totalAmount: new Prisma.Decimal(totalAmount),
          stockRestocked,
          stockLedgerId,
        });
      }

      totalTaxable = Math.round(totalTaxable * 100) / 100;
      totalCgst = Math.round(totalCgst * 100) / 100;
      totalSgst = Math.round(totalSgst * 100) / 100;
      totalIgst = Math.round(totalIgst * 100) / 100;
      const grandTotal = Math.round((totalTaxable + totalCgst + totalSgst + totalIgst) * 100) / 100;

      // 4. Create SalesReturn record
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          customerId: customer.id,
          salesOrderId: params.salesOrderId || dispatch?.orderId || null,
          invoiceId: invoice?.id || null,
          dispatchId: dispatch?.id || null,
          returnReason: params.returnReason,
          status: 'APPROVED',
          notes: params.notes || null,
          createdById: params.userId,
          approvedById: params.userId,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      });

      // 5. Generate matching Credit Note automatically
      let creditNote = null;
      if (invoice) {
        const cnCount = await tx.creditNote.count();
        const creditNoteNumber = `CN-${new Date().getFullYear()}-${String(cnCount + 1).padStart(4, '0')}`;

        creditNote = await tx.creditNote.create({
          data: {
            creditNoteNumber,
            invoiceId: invoice.id,
            customerId: customer.id,
            salesReturnId: salesReturn.id,
            reason: `Sales Return ${returnNumber}: ${params.returnReason}`,
            totalTaxable: new Prisma.Decimal(totalTaxable),
            cgstAmount: new Prisma.Decimal(totalCgst),
            sgstAmount: new Prisma.Decimal(totalSgst),
            igstAmount: new Prisma.Decimal(totalIgst),
            totalAmount: new Prisma.Decimal(grandTotal),
            status: 'POSTED',
            createdById: params.userId,
            items: {
              create: processedItems.map((pi) => ({
                productId: pi.productId,
                quantity: pi.returnedQuantity,
                unitPrice: pi.unitPrice,
                taxableAmount: pi.taxableAmount,
                gstRate: pi.gstRate,
                cgstAmount: new Prisma.Decimal(isIntraState ? Math.round((Number(pi.taxableAmount) * (Number(pi.gstRate) / 2) / 100) * 100) / 100 : 0),
                sgstAmount: new Prisma.Decimal(isIntraState ? Math.round((Number(pi.taxableAmount) * (Number(pi.gstRate) / 2) / 100) * 100) / 100 : 0),
                igstAmount: new Prisma.Decimal(!isIntraState ? Math.round((Number(pi.taxableAmount) * (Number(pi.gstRate)) / 100) * 100) / 100 : 0),
                totalAmount: pi.totalAmount,
              })),
            },
          },
          include: {
            items: true,
          },
        });

        // Reduce outstanding on invoice
        const currentOutstanding = Number(invoice.outstandingAmount);
        const newOutstanding = Math.max(0, Math.round((currentOutstanding - grandTotal) * 100) / 100);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { outstandingAmount: new Prisma.Decimal(newOutstanding) },
        });
      }

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'SALES_RETURN',
        entityId: salesReturn.id,
        newValues: {
          returnNumber,
          creditNoteNumber: creditNote?.creditNoteNumber || null,
          grandTotal,
          itemsCount: processedItems.length,
        },
      });

      return { salesReturn, creditNote };
    });
  }

  /**
   * Get single sales return by ID or number
   */
  static async getReturnById(id: string) {
    const salesReturn = await prisma.salesReturn.findFirst({
      where: {
        OR: [{ id }, { returnNumber: id }],
      },
      include: {
        customer: true,
        salesOrder: true,
        invoice: true,
        dispatch: true,
        items: { include: { product: true } },
        creditNotes: { include: { items: true } },
        createdBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!salesReturn) throw new AppError('Sales return not found.', 404);
    return salesReturn;
  }

  /**
   * List sales returns with filters
   */
  static async getReturns(filters: {
    page?: number;
    limit?: number;
    customerId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SalesReturnWhereInput = {};

    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.returnDate = {};
      if (filters.startDate) where.returnDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.returnDate.lte = new Date(filters.endDate);
    }

    const [total, returns] = await Promise.all([
      prisma.salesReturn.count({ where }),
      prisma.salesReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { returnDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true, city: true, state: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          items: { include: { product: { select: { id: true, name: true, unit: true } } } },
          creditNotes: { select: { id: true, creditNoteNumber: true, totalAmount: true } },
        },
      }),
    ]);

    return {
      data: returns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
