import { Response, NextFunction } from 'express';
import { Role, ItemType, StockMovementType, CustomerType, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from '../services/inventory.service.js';
import { AuditService } from '../services/audit.service.js';
import { UnitConversionService } from '../services/unit.service.js';

export class MasterController {
  // ==========================================
  // PRODUCT CATEGORIES
  // ==========================================
  static async getCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.productCategory.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: categories });
    } catch (err) { next(err); }
  }

  static async createCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        throw new AppError('Category name is required.', 400);
      }
      const existing = await prisma.productCategory.findUnique({ where: { name: name.trim() } });
      if (existing) {
        throw new AppError(`Category '${name}' already exists.`, 400);
      }
      const category = await prisma.productCategory.create({
        data: { name: name.trim(), description: description?.trim() || null },
      });
      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'CREATE_PRODUCT_CATEGORY',
        entityType: 'ProductCategory',
        entityId: category.id,
        newValues: category,
      });
      res.status(201).json({ success: true, data: category });
    } catch (err) { next(err); }
  }

  static async updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const category = await prisma.productCategory.update({
        where: { id },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(description !== undefined ? { description: description?.trim() || null } : {}),
        },
      });
      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'UPDATE_PRODUCT_CATEGORY',
        entityType: 'ProductCategory',
        entityId: category.id,
        newValues: category,
      });
      res.json({ success: true, data: category });
    } catch (err) { next(err); }
  }

  static async deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const category = await prisma.productCategory.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });
      if (!category) throw new AppError('Product category not found.', 404);
      if (category._count.products > 0) {
        throw new AppError(`Cannot delete category '${category.name}' as it contains ${category._count.products} associated product(s). Please reassign or delete them first.`, 400);
      }
      await prisma.productCategory.delete({ where: { id } });
      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'DELETE_PRODUCT_CATEGORY',
        entityType: 'ProductCategory',
        entityId: id,
        previousValues: category,
      });
      res.json({ success: true, message: `Category '${category.name}' deleted successfully.` });
    } catch (err) { next(err); }
  }

  // ==========================================
  // PRODUCTS
  // ==========================================
  static async getProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search, categoryId, active } = req.query;
      const where: Prisma.ProductWhereInput = {};

      if (active !== 'all') {
        where.active = true;
      }
      if (categoryId) {
        where.categoryId = String(categoryId);
      }
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { sku: { contains: String(search), mode: 'insensitive' } },
          { hsnCode: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const products = await prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' },
      });

      const enriched = await Promise.all(
        products.map(async (p) => {
          const currentStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, p.id);
          return {
            ...p,
            currentStock,
            isLowStock: currentStock <= Number(p.reorderLevel),
          };
        })
      );

      res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
  }

  static async getProductById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          boms: { where: { active: true } },
        },
      });
      if (!product) throw new AppError('Product not found.', 404);
      const currentStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, product.id);
      res.json({
        success: true,
        data: {
          ...product,
          currentStock,
          isLowStock: currentStock <= Number(product.reorderLevel),
        },
      });
    } catch (err) { next(err); }
  }

  static async createProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { sku, name, categoryId, packSize, unit, sellingPrice, gstRate, hsnCode, reorderLevel } = req.body;
      if (!sku || !name || sellingPrice === undefined) {
        throw new AppError('SKU, Name, and Selling Price are required fields.', 400);
      }
      if (Number(sellingPrice) <= 0) {
        throw new AppError('Selling price must be greater than zero.', 400);
      }

      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        throw new AppError(`Product with SKU '${sku}' already exists.`, 400);
      }

      const product = await prisma.product.create({
        data: {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          categoryId: categoryId || null,
          packSize: packSize || '200 g',
          unit: unit || 'packets',
          sellingPrice: new Prisma.Decimal(sellingPrice),
          gstRate: new Prisma.Decimal(gstRate !== undefined ? gstRate : 5.0),
          hsnCode: hsnCode || '1905',
          reorderLevel: new Prisma.Decimal(reorderLevel !== undefined ? reorderLevel : 100),
          active: true,
        },
        include: { category: true },
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'CREATE_PRODUCT',
        entityType: 'Product',
        entityId: product.id,
        newValues: product,
      });

      res.status(201).json({ success: true, data: product });
    } catch (err) { next(err); }
  }

  static async updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: any = { ...req.body };
      if (data.sellingPrice !== undefined) data.sellingPrice = new Prisma.Decimal(data.sellingPrice);
      if (data.gstRate !== undefined) data.gstRate = new Prisma.Decimal(data.gstRate);
      if (data.reorderLevel !== undefined) data.reorderLevel = new Prisma.Decimal(data.reorderLevel);

      const oldProduct = await prisma.product.findUnique({ where: { id } });
      if (!oldProduct) throw new AppError('Product not found.', 404);

      const product = await prisma.product.update({
        where: { id },
        data,
        include: { category: true },
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'UPDATE_PRODUCT',
        entityType: 'Product',
        entityId: product.id,
        previousValues: oldProduct,
        newValues: product,
      });

      res.json({ success: true, data: product });
    } catch (err) { next(err); }
  }

  static async deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) throw new AppError('Product not found.', 404);

      // Prevent deletion if referenced in transactions or recipes
      const orders = await prisma.salesOrderItem.count({ where: { productId: id } });
      const invoices = await prisma.invoiceItem.count({ where: { productId: id } });
      const dispatches = await prisma.dispatchItem.count({ where: { productId: id } });
      const runs = await prisma.productionRun.count({ where: { productId: id } });
      const boms = await prisma.bOM.count({ where: { productId: id } });

      const totalReferences = orders + invoices + dispatches + runs + boms;
      if (totalReferences > 0) {
        throw new AppError(
          `Cannot delete product '${product.name}' as it is referenced in transactions (${orders} orders, ${invoices} invoices, ${runs} production runs, ${boms} BOMs). Mark it inactive instead.`,
          400
        );
      }

      await prisma.product.delete({ where: { id } });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'DELETE_PRODUCT',
        entityType: 'Product',
        entityId: id,
        previousValues: product,
      });

      res.json({ success: true, message: `Product '${product.name}' deleted successfully.` });
    } catch (err) { next(err); }
  }

  // ==========================================
  // CUSTOMERS
  // ==========================================
  static async getCustomers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search, type, state } = req.query;
      const where: any = {};

      if (req.user?.role === Role.SALESMAN) {
        where.salesmanId = req.user.id;
      }
      if (type) {
        where.type = type as CustomerType;
      }
      if (state) {
        where.state = String(state);
      }
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { gstin: { contains: String(search), mode: 'insensitive' } },
          { contactNumber: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const customers = await prisma.customer.findMany({
        where,
        include: { salesman: { select: { id: true, fullName: true, email: true } } },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: customers });
    } catch (err) { next(err); }
  }

  static async getCustomerById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          salesman: { select: { id: true, fullName: true, email: true } },
          orders: { take: 5, orderBy: { createdAt: 'desc' } },
          invoices: { take: 5, orderBy: { createdAt: 'desc' } },
        },
      });
      if (!customer) throw new AppError('Customer not found.', 404);
      if (req.user?.role === Role.SALESMAN && customer.salesmanId !== req.user.id) {
        throw new AppError('Forbidden: Access to unassigned customer is restricted.', 403);
      }
      res.json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  static async createCustomer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, type, gstin, billingAddress, shippingAddress, state, stateCode, contactNumber, email, creditLimit, salesmanId } = req.body;
      if (!name || !billingAddress || !contactNumber) {
        throw new AppError('Customer Name, Billing Address, and Contact Number are required.', 400);
      }

      const customer = await prisma.customer.create({
        data: {
          name: name.trim(),
          type: type || CustomerType.RETAILER,
          gstin: gstin ? gstin.trim().toUpperCase() : null,
          billingAddress: billingAddress.trim(),
          shippingAddress: (shippingAddress || billingAddress).trim(),
          state: state || 'Tamil Nadu',
          stateCode: stateCode || (state === 'Karnataka' ? '29' : '33'),
          contactNumber: contactNumber.trim(),
          email: email?.trim() || null,
          creditLimit: new Prisma.Decimal(creditLimit || 0.0),
          salesmanId: salesmanId || null,
        },
        include: { salesman: { select: { id: true, fullName: true, email: true } } },
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'CREATE_CUSTOMER',
        entityType: 'Customer',
        entityId: customer.id,
        newValues: customer,
      });

      res.status(201).json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  static async updateCustomer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: any = { ...req.body };
      if (data.creditLimit !== undefined) data.creditLimit = new Prisma.Decimal(data.creditLimit);
      if (data.gstin) data.gstin = data.gstin.trim().toUpperCase();

      const oldCustomer = await prisma.customer.findUnique({ where: { id } });
      if (!oldCustomer) throw new AppError('Customer not found.', 404);

      const customer = await prisma.customer.update({
        where: { id },
        data,
        include: { salesman: { select: { id: true, fullName: true, email: true } } },
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'UPDATE_CUSTOMER',
        entityType: 'Customer',
        entityId: customer.id,
        previousValues: oldCustomer,
        newValues: customer,
      });

      res.json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  static async deleteCustomer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) throw new AppError('Customer not found.', 404);

      const orders = await prisma.salesOrder.count({ where: { customerId: id } });
      const invoices = await prisma.invoice.count({ where: { customerId: id } });
      const payments = await prisma.payment.count({ where: { customerId: id } });

      if (orders + invoices + payments > 0) {
        throw new AppError(
          `Cannot delete customer '${customer.name}' as they have active transactions (${orders} orders, ${invoices} invoices, ${payments} payments).`,
          400
        );
      }

      await prisma.customer.delete({ where: { id } });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'DELETE_CUSTOMER',
        entityType: 'Customer',
        entityId: id,
        previousValues: customer,
      });

      res.json({ success: true, message: `Customer '${customer.name}' deleted successfully.` });
    } catch (err) { next(err); }
  }

  // ==========================================
  // SUPPLIERS
  // ==========================================
  static async getSuppliers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search } = req.query;
      const where: Prisma.SupplierWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { gstin: { contains: String(search), mode: 'insensitive' } },
          { contactPerson: { contains: String(search), mode: 'insensitive' } },
        ];
      }
      const suppliers = await prisma.supplier.findMany({
        where,
        include: { _count: { select: { purchases: true } } },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: suppliers });
    } catch (err) { next(err); }
  }

  static async getSupplierById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          purchases: { take: 10, orderBy: { createdAt: 'desc' } },
        },
      });
      if (!supplier) throw new AppError('Supplier not found.', 404);
      res.json({ success: true, data: supplier });
    } catch (err) { next(err); }
  }

  static async createSupplier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, gstin, address, state, stateCode, contactPerson, contactNumber, email } = req.body;
      if (!name || !address || !contactNumber) {
        throw new AppError('Supplier Name, Address, and Contact Number are required.', 400);
      }

      const supplier = await prisma.supplier.create({
        data: {
          name: name.trim(),
          gstin: gstin ? gstin.trim().toUpperCase() : null,
          address: address.trim(),
          state: state || 'Tamil Nadu',
          stateCode: stateCode || '33',
          contactPerson: contactPerson?.trim() || null,
          contactNumber: contactNumber.trim(),
          email: email?.trim() || null,
        },
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'CREATE_SUPPLIER',
        entityType: 'Supplier',
        entityId: supplier.id,
        newValues: supplier,
      });

      res.status(201).json({ success: true, data: supplier });
    } catch (err) { next(err); }
  }

  static async updateSupplier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: any = { ...req.body };
      if (data.gstin) data.gstin = data.gstin.trim().toUpperCase();

      const oldSupplier = await prisma.supplier.findUnique({ where: { id } });
      if (!oldSupplier) throw new AppError('Supplier not found.', 404);

      const supplier = await prisma.supplier.update({
        where: { id },
        data,
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'UPDATE_SUPPLIER',
        entityType: 'Supplier',
        entityId: supplier.id,
        previousValues: oldSupplier,
        newValues: supplier,
      });

      res.json({ success: true, data: supplier });
    } catch (err) { next(err); }
  }

  static async deleteSupplier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await prisma.supplier.findUnique({ where: { id } });
      if (!supplier) throw new AppError('Supplier not found.', 404);

      const purchases = await prisma.purchase.count({ where: { supplierId: id } });
      if (purchases > 0) {
        throw new AppError(`Cannot delete supplier '${supplier.name}' as they have ${purchases} recorded purchase transaction(s).`, 400);
      }

      await prisma.supplier.delete({ where: { id } });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'DELETE_SUPPLIER',
        entityType: 'Supplier',
        entityId: id,
        previousValues: supplier,
      });

      res.json({ success: true, message: `Supplier '${supplier.name}' deleted successfully.` });
    } catch (err) { next(err); }
  }

  // ==========================================
  // RAW MATERIALS
  // ==========================================
  static async getRawMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search } = req.query;
      const where: Prisma.RawMaterialWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { code: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const materials = await prisma.rawMaterial.findMany({
        where,
        orderBy: { name: 'asc' },
      });

      const enriched = await Promise.all(
        materials.map(async (rm) => {
          const currentStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, rm.id);
          return {
            ...rm,
            currentStock,
            isLowStock: currentStock <= Number(rm.reorderLevel),
            stockValue: Math.round(currentStock * Number(rm.purchasePrice) * 100) / 100,
          };
        })
      );
      res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
  }

  static async getRawMaterialById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const material = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!material) throw new AppError('Raw material not found.', 404);
      const currentStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, material.id);
      res.json({
        success: true,
        data: {
          ...material,
          currentStock,
          isLowStock: currentStock <= Number(material.reorderLevel),
          stockValue: Math.round(currentStock * Number(material.purchasePrice) * 100) / 100,
        },
      });
    } catch (err) { next(err); }
  }

  static async createRawMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, name, uom, openingStock, reorderLevel, purchasePrice } = req.body;
      if (!code || !name || !uom) {
        throw new AppError('Material Code, Name, and Unit of Measure (UOM) are required.', 400);
      }

      const existing = await prisma.rawMaterial.findUnique({ where: { code: code.trim().toUpperCase() } });
      if (existing) {
        throw new AppError(`Raw material with code '${code}' already exists.`, 400);
      }

      const openQty = Number(openingStock || 0.0);
      const rate = Number(purchasePrice || 0.0);

      const material = await prisma.$transaction(async (tx) => {
        const rm = await tx.rawMaterial.create({
          data: {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            uom: uom.trim().toLowerCase(),
            openingStock: new Prisma.Decimal(openQty),
            reorderLevel: new Prisma.Decimal(reorderLevel !== undefined ? reorderLevel : 10.0),
            purchasePrice: new Prisma.Decimal(rate),
          },
        });

        if (openQty > 0) {
          await tx.stockLedger.create({
            data: {
              itemType: ItemType.RAW_MATERIAL,
              itemId: rm.id,
              movementType: StockMovementType.OPENING_BALANCE,
              quantity: new Prisma.Decimal(openQty),
              balanceAfter: new Prisma.Decimal(openQty),
              unit: rm.uom,
              referenceType: 'OPENING',
              userId: req.user?.id || null,
            },
          });

          await tx.inventoryValuationLayer.create({
            data: {
              itemType: ItemType.RAW_MATERIAL,
              itemId: rm.id,
              referenceType: 'OPENING',
              originalQuantity: new Prisma.Decimal(openQty),
              remainingQuantity: new Prisma.Decimal(openQty),
              unitCost: new Prisma.Decimal(rate),
              receivedDate: new Date(),
            },
          });
        }

        return rm;
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'CREATE_RAW_MATERIAL',
        entityType: 'RawMaterial',
        entityId: material.id,
        newValues: material,
      });

      res.status(201).json({ success: true, data: material });
    } catch (err) { next(err); }
  }

  static async updateRawMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: any = { ...req.body };
      if (data.reorderLevel !== undefined) data.reorderLevel = new Prisma.Decimal(data.reorderLevel);
      if (data.purchasePrice !== undefined) data.purchasePrice = new Prisma.Decimal(data.purchasePrice);
      delete data.openingStock;

      const oldMaterial = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!oldMaterial) throw new AppError('Raw material not found.', 404);

      const material = await prisma.rawMaterial.update({
        where: { id },
        data,
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'UPDATE_RAW_MATERIAL',
        entityType: 'RawMaterial',
        entityId: material.id,
        previousValues: oldMaterial,
        newValues: material,
      });

      res.json({ success: true, data: material });
    } catch (err) { next(err); }
  }

  static async deleteRawMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const material = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!material) throw new AppError('Raw material not found.', 404);

      const boms = await prisma.bOMItem.count({ where: { rawMaterialId: id } });
      const purchases = await prisma.purchaseItem.count({ where: { rawMaterialId: id } });
      const consumptions = await prisma.productionConsumption.count({ where: { rawMaterialId: id } });

      if (boms + purchases + consumptions > 0) {
        throw new AppError(
          `Cannot delete raw material '${material.name}' as it is referenced in BOM recipes (${boms}), purchases (${purchases}), or batch consumption (${consumptions}).`,
          400
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.stockLedger.deleteMany({ where: { itemId: id, itemType: ItemType.RAW_MATERIAL } });
        await tx.inventoryValuationLayer.deleteMany({ where: { itemId: id, itemType: ItemType.RAW_MATERIAL } });
        await tx.rawMaterial.delete({ where: { id } });
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'DELETE_RAW_MATERIAL',
        entityType: 'RawMaterial',
        entityId: id,
        previousValues: material,
      });

      res.json({ success: true, message: `Raw material '${material.name}' deleted successfully.` });
    } catch (err) { next(err); }
  }

  // ==========================================
  // PACKAGING MATERIALS
  // ==========================================
  static async getPackagingMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search } = req.query;
      const where: Prisma.PackagingMaterialWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { code: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const items = await prisma.packagingMaterial.findMany({
        where,
        orderBy: { name: 'asc' },
      });

      const enriched = await Promise.all(
        items.map(async (pkg) => {
          const currentStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, pkg.id);
          return {
            ...pkg,
            currentStock,
            stockValue: Math.round(currentStock * Number(pkg.purchasePrice) * 100) / 100,
          };
        })
      );
      res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
  }

  static async getPackagingMaterialById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await prisma.packagingMaterial.findUnique({ where: { id } });
      if (!item) throw new AppError('Packaging material not found.', 404);
      const currentStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, item.id);
      res.json({
        success: true,
        data: {
          ...item,
          currentStock,
          stockValue: Math.round(currentStock * Number(item.purchasePrice) * 100) / 100,
        },
      });
    } catch (err) { next(err); }
  }

  static async createPackagingMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, name, uom, openingStock, purchasePrice } = req.body;
      if (!code || !name) {
        throw new AppError('Packaging Code and Name are required.', 400);
      }

      const existing = await prisma.packagingMaterial.findUnique({ where: { code: code.trim().toUpperCase() } });
      if (existing) {
        throw new AppError(`Packaging material with code '${code}' already exists.`, 400);
      }

      const openQty = Number(openingStock || 0.0);
      const rate = Number(purchasePrice || 0.0);

      const item = await prisma.$transaction(async (tx) => {
        const pkg = await tx.packagingMaterial.create({
          data: {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            uom: uom ? uom.trim().toLowerCase() : 'pieces',
            openingStock: new Prisma.Decimal(openQty),
            purchasePrice: new Prisma.Decimal(rate),
          },
        });

        if (openQty > 0) {
          await tx.stockLedger.create({
            data: {
              itemType: ItemType.PACKAGING,
              itemId: pkg.id,
              movementType: StockMovementType.OPENING_BALANCE,
              quantity: new Prisma.Decimal(openQty),
              balanceAfter: new Prisma.Decimal(openQty),
              unit: pkg.uom,
              referenceType: 'OPENING',
              userId: req.user?.id || null,
            },
          });

          await tx.inventoryValuationLayer.create({
            data: {
              itemType: ItemType.PACKAGING,
              itemId: pkg.id,
              referenceType: 'OPENING',
              originalQuantity: new Prisma.Decimal(openQty),
              remainingQuantity: new Prisma.Decimal(openQty),
              unitCost: new Prisma.Decimal(rate),
              receivedDate: new Date(),
            },
          });
        }

        return pkg;
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'CREATE_PACKAGING_MATERIAL',
        entityType: 'PackagingMaterial',
        entityId: item.id,
        newValues: item,
      });

      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  static async updatePackagingMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: any = { ...req.body };
      if (data.purchasePrice !== undefined) data.purchasePrice = new Prisma.Decimal(data.purchasePrice);
      delete data.openingStock;

      const oldItem = await prisma.packagingMaterial.findUnique({ where: { id } });
      if (!oldItem) throw new AppError('Packaging material not found.', 404);

      const item = await prisma.packagingMaterial.update({
        where: { id },
        data,
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'UPDATE_PACKAGING_MATERIAL',
        entityType: 'PackagingMaterial',
        entityId: item.id,
        previousValues: oldItem,
        newValues: item,
      });

      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  static async deletePackagingMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await prisma.packagingMaterial.findUnique({ where: { id } });
      if (!item) throw new AppError('Packaging material not found.', 404);

      const boms = await prisma.bOMItem.count({ where: { packagingMaterialId: id } });
      const purchases = await prisma.purchaseItem.count({ where: { packagingMaterialId: id } });
      const consumptions = await prisma.productionConsumption.count({ where: { packagingMaterialId: id } });

      if (boms + purchases + consumptions > 0) {
        throw new AppError(
          `Cannot delete packaging material '${item.name}' as it is referenced in BOM recipes (${boms}), purchases (${purchases}), or production runs (${consumptions}).`,
          400
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.stockLedger.deleteMany({ where: { itemId: id, itemType: ItemType.PACKAGING } });
        await tx.inventoryValuationLayer.deleteMany({ where: { itemId: id, itemType: ItemType.PACKAGING } });
        await tx.packagingMaterial.delete({ where: { id } });
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'DELETE_PACKAGING_MATERIAL',
        entityType: 'PackagingMaterial',
        entityId: id,
        previousValues: item,
      });

      res.json({ success: true, message: `Packaging material '${item.name}' deleted successfully.` });
    } catch (err) { next(err); }
  }

  // ==========================================
  // BILL OF MATERIALS (BOM)
  // ==========================================
  static async getBOMs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId, active } = req.query;
      const where: Prisma.BOMWhereInput = {};
      if (productId) where.productId = String(productId);
      if (active !== 'all') where.active = true;

      const boms = await prisma.bOM.findMany({
        where,
        include: {
          product: true,
          items: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: boms });
    } catch (err) { next(err); }
  }

  static async getBOMById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const bom = await prisma.bOM.findUnique({
        where: { id },
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
      res.json({ success: true, data: bom });
    } catch (err) { next(err); }
  }

  static async createBOM(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId, name, version, batchSize, batchUnit, expectedYield, yieldUnit, notes, items } = req.body;
      if (!productId || !name || !batchSize || !expectedYield || !items || items.length === 0) {
        throw new AppError('Product, Name, Batch Size, Expected Yield, and Recipe Items are required.', 400);
      }

      const bom = await prisma.bOM.create({
        data: {
          productId,
          name: name.trim(),
          version: version || 'v1.0',
          batchSize: new Prisma.Decimal(batchSize),
          batchUnit: batchUnit || 'packets',
          expectedYield: new Prisma.Decimal(expectedYield),
          yieldUnit: yieldUnit || 'packets',
          notes: notes?.trim() || null,
          active: true,
          items: {
            create: items.map((it: any) => ({
              itemType: it.itemType as ItemType,
              rawMaterialId: it.itemType === ItemType.RAW_MATERIAL ? it.rawMaterialId : null,
              packagingMaterialId: it.itemType === ItemType.PACKAGING ? it.packagingMaterialId : null,
              standardQuantity: new Prisma.Decimal(it.standardQuantity),
              unit: it.unit,
            })),
          },
        },
        include: {
          product: true,
          items: { include: { rawMaterial: true, packagingMaterial: true } },
        },
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'CREATE_BOM',
        entityType: 'BOM',
        entityId: bom.id,
        newValues: bom,
      });

      res.status(201).json({ success: true, data: bom });
    } catch (err) { next(err); }
  }

  static async updateBOM(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, version, batchSize, batchUnit, expectedYield, yieldUnit, active, notes, items } = req.body;

      const oldBOM = await prisma.bOM.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!oldBOM) throw new AppError('BOM not found.', 404);

      const bom = await prisma.$transaction(async (tx) => {
        if (items && Array.isArray(items)) {
          await tx.bOMItem.deleteMany({ where: { bomId: id } });
          await tx.bOMItem.createMany({
            data: items.map((it: any) => ({
              bomId: id,
              itemType: it.itemType as ItemType,
              rawMaterialId: it.itemType === ItemType.RAW_MATERIAL ? it.rawMaterialId : null,
              packagingMaterialId: it.itemType === ItemType.PACKAGING ? it.packagingMaterialId : null,
              standardQuantity: new Prisma.Decimal(it.standardQuantity),
              unit: it.unit,
            })),
          });
        }

        return tx.bOM.update({
          where: { id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(version ? { version: version.trim() } : {}),
            ...(batchSize !== undefined ? { batchSize: new Prisma.Decimal(batchSize) } : {}),
            ...(batchUnit ? { batchUnit } : {}),
            ...(expectedYield !== undefined ? { expectedYield: new Prisma.Decimal(expectedYield) } : {}),
            ...(yieldUnit ? { yieldUnit } : {}),
            ...(active !== undefined ? { active } : {}),
            ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
          },
          include: {
            product: true,
            items: { include: { rawMaterial: true, packagingMaterial: true } },
          },
        });
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'UPDATE_BOM',
        entityType: 'BOM',
        entityId: bom.id,
        previousValues: oldBOM,
        newValues: bom,
      });

      res.json({ success: true, data: bom });
    } catch (err) { next(err); }
  }

  static async deleteBOM(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const bom = await prisma.bOM.findUnique({ where: { id } });
      if (!bom) throw new AppError('BOM not found.', 404);

      const runs = await prisma.productionRun.count({ where: { bomId: id } });
      if (runs > 0) {
        throw new AppError(
          `Cannot delete BOM '${bom.name}' because it has been used in ${runs} historical production run(s). Please set it inactive instead.`,
          400
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.bOMItem.deleteMany({ where: { bomId: id } });
        await tx.bOM.delete({ where: { id } });
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'DELETE_BOM',
        entityType: 'BOM',
        entityId: id,
        previousValues: bom,
      });

      res.json({ success: true, message: `BOM '${bom.name}' deleted successfully.` });
    } catch (err) { next(err); }
  }

  // ==========================================
  // UNITS OF MEASURE & CONVERSIONS
  // ==========================================
  static async getUOMs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const uomData = {
        units: ['kg', 'g', 'litre', 'ml', 'pieces', 'packets', 'cartons'],
        categories: {
          weight: [
            { code: 'kg', name: 'Kilograms', baseUnit: true },
            { code: 'g', name: 'Grams', factor: 0.001 },
          ],
          volume: [
            { code: 'litre', name: 'Litres', baseUnit: true },
            { code: 'ml', name: 'Millilitres', factor: 0.001 },
          ],
          count: [
            { code: 'pieces', name: 'Pieces' },
            { code: 'packets', name: 'Packets' },
            { code: 'cartons', name: 'Cartons' },
          ],
        },
      };
      res.json({ success: true, data: uomData });
    } catch (err) { next(err); }
  }

  static async convertUOM(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { quantity, fromUnit, toUnit } = req.body;
      if (quantity === undefined || !fromUnit || !toUnit) {
        throw new AppError('Quantity, From Unit, and To Unit are required.', 400);
      }
      const converted = UnitConversionService.convert(Number(quantity), String(fromUnit), String(toUnit));
      res.json({
        success: true,
        data: {
          originalQuantity: Number(quantity),
          fromUnit,
          toUnit,
          convertedQuantity: converted,
        },
      });
    } catch (err) { next(err); }
  }

  // ==========================================
  // STATUS TOGGLES & BOM WORKFLOWS
  // ==========================================
  static async patchProductStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const product = await prisma.product.update({
        where: { id },
        data: { active: active !== undefined ? Boolean(active) : true },
      });
      res.json({ success: true, data: product });
    } catch (err) { next(err); }
  }

  static async patchCustomerStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const customer = await prisma.customer.update({
        where: { id },
        data: { active: active !== undefined ? Boolean(active) : true },
      });
      res.json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  static async patchSupplierStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const supplier = await prisma.supplier.update({
        where: { id },
        data: { active: active !== undefined ? Boolean(active) : true },
      });
      res.json({ success: true, data: supplier });
    } catch (err) { next(err); }
  }

  static async patchRawMaterialStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const material = await prisma.rawMaterial.update({
        where: { id },
        data: { active: active !== undefined ? Boolean(active) : true },
      });
      res.json({ success: true, data: material });
    } catch (err) { next(err); }
  }

  static async patchPackagingStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const item = await prisma.packagingMaterial.update({
        where: { id },
        data: { active: active !== undefined ? Boolean(active) : true },
      });
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  static async activateBOM(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const bom = await prisma.bOM.findUnique({ where: { id } });
      if (!bom) throw new AppError('BOM not found.', 404);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.bOM.updateMany({
          where: { productId: bom.productId },
          data: { active: false, status: 'INACTIVE' },
        });
        return tx.bOM.update({
          where: { id },
          data: { active: true, status: 'ACTIVE' },
          include: { product: true, items: true },
        });
      });

      await AuditService.log(null, {
        userId: req.user?.id,
        action: 'ACTIVATE_BOM',
        entityType: 'BOM',
        entityId: id,
        newValues: updated,
      });

      res.json({ success: true, data: updated, message: `BOM ${bom.name} (${bom.version}) is now active.` });
    } catch (err) { next(err); }
  }

  static async getProductBOMs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const boms = await prisma.bOM.findMany({
        where: { productId: id },
        include: {
          items: {
            include: { rawMaterial: true, packagingMaterial: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: boms });
    } catch (err) { next(err); }
  }

  static async getUnits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let dbUnits = await prisma.unit.findMany({ orderBy: { code: 'asc' } });
      if (dbUnits.length === 0) {
        const defaultUnits = [
          { code: 'kg', name: 'Kilograms', category: 'WEIGHT', baseUnit: true },
          { code: 'g', name: 'Grams', category: 'WEIGHT', baseUnit: false },
          { code: 'litre', name: 'Litres', category: 'VOLUME', baseUnit: true },
          { code: 'ml', name: 'Millilitres', category: 'VOLUME', baseUnit: false },
          { code: 'pieces', name: 'Pieces', category: 'COUNT', baseUnit: true },
          { code: 'packets', name: 'Packets', category: 'COUNT', baseUnit: false },
          { code: 'cartons', name: 'Cartons', category: 'COUNT', baseUnit: false },
        ];
        await prisma.unit.createMany({ data: defaultUnits, skipDuplicates: true });
        dbUnits = await prisma.unit.findMany({ orderBy: { code: 'asc' } });
      }
      res.json({ success: true, data: dbUnits });
    } catch (err) { next(err); }
  }

  static async createUnit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, name, category, baseUnit } = req.body;
      if (!code || !name) throw new AppError('Unit code and name are required.', 400);
      const unit = await prisma.unit.create({
        data: {
          code: code.trim().toLowerCase(),
          name: name.trim(),
          category: category ? category.trim().toUpperCase() : 'COUNT',
          baseUnit: Boolean(baseUnit),
        },
      });
      res.status(201).json({ success: true, data: unit });
    } catch (err) { next(err); }
  }

  static async getUnitConversions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const conversions = await prisma.unitConversion.findMany({ orderBy: { fromUnit: 'asc' } });
      res.json({ success: true, data: conversions });
    } catch (err) { next(err); }
  }

  static async createUnitConversion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { fromUnit, toUnit, factor, notes } = req.body;
      if (!fromUnit || !toUnit || factor === undefined) {
        throw new AppError('From Unit, To Unit, and Factor are required.', 400);
      }
      const conversion = await prisma.unitConversion.upsert({
        where: {
          fromUnit_toUnit: {
            fromUnit: fromUnit.trim().toLowerCase(),
            toUnit: toUnit.trim().toLowerCase(),
          },
        },
        create: {
          fromUnit: fromUnit.trim().toLowerCase(),
          toUnit: toUnit.trim().toLowerCase(),
          factor: new Prisma.Decimal(factor),
          notes: notes?.trim() || null,
        },
        update: {
          factor: new Prisma.Decimal(factor),
          notes: notes?.trim() || null,
        },
      });
      res.status(201).json({ success: true, data: conversion });
    } catch (err) { next(err); }
  }
}
