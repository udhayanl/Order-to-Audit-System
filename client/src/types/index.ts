export type Role = 'SALESMAN' | 'ADMIN' | 'PRODUCTION_SUPERVISOR' | 'ACCOUNTANT_AUDITOR' | 'OWNER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone?: string;
}

export interface Customer {
  id: string;
  name: string;
  type: 'RETAILER' | 'DISTRIBUTOR';
  gstin?: string;
  billingAddress: string;
  shippingAddress: string;
  state: string;
  stateCode: string;
  contactNumber: string;
  email?: string;
  creditLimit: number;
  salesmanId?: string;
  salesman?: { id: string; fullName: string; email: string };
}

export interface Supplier {
  id: string;
  name: string;
  gstin?: string;
  address: string;
  state: string;
  stateCode: string;
  contactPerson?: string;
  contactNumber: string;
  email?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  packSize: string;
  unit: string;
  sellingPrice: number;
  gstRate: number;
  hsnCode: string;
  reorderLevel: number;
  active: boolean;
}

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  uom: string;
  openingStock: number;
  currentStock?: number;
  reorderLevel: number;
  purchasePrice: number;
}

export interface PackagingMaterial {
  id: string;
  code: string;
  name: string;
  uom: string;
  openingStock: number;
  currentStock?: number;
  purchasePrice: number;
}

export interface BOMItem {
  id: string;
  bomId: string;
  itemType: 'RAW_MATERIAL' | 'PACKAGING';
  rawMaterialId?: string;
  rawMaterial?: RawMaterial;
  packagingMaterialId?: string;
  packagingMaterial?: PackagingMaterial;
  standardQuantity: number;
  unit: string;
}

export interface BOM {
  id: string;
  productId: string;
  product?: Product;
  name: string;
  version: string;
  batchSize: number;
  batchUnit: string;
  expectedYield: number;
  yieldUnit: string;
  effectiveDate: string;
  notes?: string;
  items: BOMItem[];
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: Customer;
  salesmanId: string;
  salesman: { id: string; fullName: string; email: string };
  orderDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'INVOICED' | 'DISPATCHED';
  subtotal: number;
  estimatedGst: number;
  grandTotal: number;
  orderNotes?: string;
  rejectionReason?: string;
  approvedById?: string;
  approvedAt?: string;
  items: SalesOrderItem[];
  invoice?: { id: string; invoiceNumber: string; status: string };
  dispatch?: { id: string; dispatchNumber: string };
  stockCheck?: {
    hasShortage: boolean;
    stockStatus: {
      productId: string;
      productName: string;
      requestedQuantity: number;
      availableStock: number;
      shortage: number;
      isAvailable: boolean;
    }[];
  };
}

export interface InvoiceItem {
  id: string;
  productId: string;
  product: Product;
  hsnCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  orderId?: string;
  order?: SalesOrder;
  customerId: string;
  customer: Customer;
  invoiceDate: string;
  dueDate: string;
  billingAddress: string;
  shippingAddress: string;
  placeOfSupply: string;
  totalTaxable: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'POSTED' | 'CANCELLED';
  items: InvoiceItem[];
}

export interface ProductionConsumption {
  id: string;
  itemType: 'RAW_MATERIAL' | 'PACKAGING';
  rawMaterialId?: string;
  rawMaterial?: RawMaterial;
  packagingMaterialId?: string;
  packagingMaterial?: PackagingMaterial;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  consumptionVariancePercent: number;
  varianceStatus: 'NORMAL' | 'EXCEEDS_TOLERANCE';
  unitCost: number;
  totalCost: number;
}

export interface ProductionRun {
  id: string;
  runNumber: string;
  bomId: string;
  bom: BOM;
  productId: string;
  product: Product;
  runDate: string;
  plannedBatchQuantity: number;
  expectedOutput: number;
  actualGoodOutput: number;
  damagedPouches: number;
  cartonsUsed: number;
  labourCost: number;
  powerCost: number;
  otherOverheads: number;
  totalMaterialCost: number;
  totalProductionCost: number;
  costPerPacket: number;
  yieldVariancePercent: number;
  yieldVarianceStatus: 'NORMAL' | 'EXCEEDS_TOLERANCE';
  status: string;
  notes?: string;
  consumptions: ProductionConsumption[];
}
