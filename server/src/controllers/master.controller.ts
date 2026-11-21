import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export class MasterController {
  // PRODUCTS
  static async getProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const products = await prisma.product.findMany({
        where: { active: true },
        include: { category: true },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: products });
    } catch (err) { next(err); }
  }

  static async createProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const product = await prisma.product.create({ data: req.body });
      res.status(201).json({ success: true, data: product });
    } catch (err) { next(err); }
  }

  static async updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await prisma.product.update({ where: { id }, data: req.body });
      res.json({ success: true, data: product });
    } catch (err) { next(err); }
  }

  // CUSTOMERS
  static async getCustomers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const where: any = {};
      if (req.user?.role === Role.SALESMAN) {
        where.salesmanId = req.user.id;
      }
      const customers = await prisma.customer.findMany({
        where,
        include: { salesman: { select: { id: true, fullName: true, email: true } } },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: customers });
    } catch (err) { next(err); }
  }

  static async createCustomer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await prisma.customer.create({ data: req.body });
      res.status(201).json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  static async updateCustomer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.update({ where: { id }, data: req.body });
      res.json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  // SUPPLIERS
  static async getSuppliers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
      res.json({ success: true, data: suppliers });
    } catch (err) { next(err); }
  }

  static async createSupplier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await prisma.supplier.create({ data: req.body });
      res.status(201).json({ success: true, data: supplier });
    } catch (err) { next(err); }
  }

  static async updateSupplier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await prisma.supplier.update({ where: { id }, data: req.body });
      res.json({ success: true, data: supplier });
    } catch (err) { next(err); }
  }

  // RAW MATERIALS
  static async getRawMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const materials = await prisma.rawMaterial.findMany({ orderBy: { name: 'asc' } });
      res.json({ success: true, data: materials });
    } catch (err) { next(err); }
  }

  static async createRawMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const material = await prisma.rawMaterial.create({ data: req.body });
      res.status(201).json({ success: true, data: material });
    } catch (err) { next(err); }
  }

  static async updateRawMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const material = await prisma.rawMaterial.update({ where: { id }, data: req.body });
      res.json({ success: true, data: material });
    } catch (err) { next(err); }
  }

  // PACKAGING MATERIALS
  static async getPackagingMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const items = await prisma.packagingMaterial.findMany({ orderBy: { name: 'asc' } });
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  }

  static async createPackagingMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await prisma.packagingMaterial.create({ data: req.body });
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  static async updatePackagingMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await prisma.packagingMaterial.update({ where: { id }, data: req.body });
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  // BOM
  static async getBOMs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const boms = await prisma.bOM.findMany({
        where: { active: true },
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

  static async createBOM(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { items, ...bomData } = req.body;
      const bom = await prisma.bOM.create({
        data: {
          ...bomData,
          items: {
            create: items,
          },
        },
        include: { items: true, product: true },
      });
      res.status(201).json({ success: true, data: bom });
    } catch (err) { next(err); }
  }
}
