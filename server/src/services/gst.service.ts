import { Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

export interface GSTCalculationItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // Flat discount
  discountPercent?: number; // Percentage discount
  gstRate?: number; // e.g. 5.0
}

export interface GSTCalculationResult {
  isIntraState: boolean;
  supplierState: string;
  supplierStateCode: string;
  customerState: string;
  customerStateCode: string;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  subtotal: number;
  roundOff: number;
  grandTotal: number;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxableAmount: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
  }[];
}

export class GSTService {
  /**
   * Validate Indian GSTIN format:
   * 2 digits (state code) + 5 letters (PAN) + 4 digits + 1 letter + 1 entity code + 'Z' + 1 checksum
   */
  static validateGSTIN(gstin: string): boolean {
    if (!gstin) return false;
    const clean = gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(clean);
  }

  /**
   * Extract 2-digit state code from GSTIN
   */
  static extractStateCode(gstin: string): string | null {
    if (!this.validateGSTIN(gstin)) return null;
    return gstin.trim().slice(0, 2);
  }

  /**
   * Get or initialize factory tax configuration
   */
  static async getTaxConfiguration() {
    let config = await prisma.taxConfiguration.findFirst();
    if (!config) {
      config = await prisma.taxConfiguration.create({
        data: {
          businessName: 'FactoryFlow Packaged Foods Pvt Ltd',
          gstin: '33AAACF1234M1Z5',
          state: 'Tamil Nadu',
          stateCode: '33',
          address: 'SF 24/2, Trichy-Thanjavur Highway, Thuvakudi, Tiruchirappalli, Tamil Nadu 620015',
          phone: '+91 94431 12345',
          email: 'billing@factoryflow.in',
          defaultGstRate: new Prisma.Decimal(5.0),
          isComposition: false,
        },
      });
    }
    return config;
  }

  /**
   * Update tax configuration
   */
  static async updateTaxConfiguration(data: {
    businessName?: string;
    gstin?: string;
    state?: string;
    stateCode?: string;
    address?: string;
    phone?: string;
    email?: string;
    defaultGstRate?: number;
  }) {
    if (data.gstin && !this.validateGSTIN(data.gstin)) {
      throw new AppError('Invalid GSTIN format for factory registration.', 400);
    }

    const config = await this.getTaxConfiguration();
    return prisma.taxConfiguration.update({
      where: { id: config.id },
      data: {
        businessName: data.businessName,
        gstin: data.gstin,
        state: data.state,
        stateCode: data.stateCode,
        address: data.address,
        phone: data.phone,
        email: data.email,
        defaultGstRate: data.defaultGstRate ? new Prisma.Decimal(data.defaultGstRate) : undefined,
      },
    });
  }

  /**
   * Reusable Indian GST calculation engine
   * Determines intra-state vs inter-state tax components, discounts, and round-off
   */
  static async calculateGST(params: {
    customerStateCode: string;
    customerState?: string;
    items: GSTCalculationItem[];
  }): Promise<GSTCalculationResult> {
    const config = await this.getTaxConfiguration();
    const supplierStateCode = config.stateCode || '33';
    const supplierState = config.state || 'Tamil Nadu';
    const customerStateCode = params.customerStateCode.trim();
    const customerState = params.customerState || (customerStateCode === '33' ? 'Tamil Nadu' : 'Other State');

    // Intra-state if customer state code matches supplier state code
    const isIntraState = supplierStateCode === customerStateCode;

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const calculatedItems = [];

    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new AppError('Quantity must be greater than zero.', 400);
      }
      if (item.unitPrice < 0) {
        throw new AppError('Unit price cannot be negative.', 400);
      }

      // Calculate base gross amount
      const grossAmount = Math.round(item.quantity * item.unitPrice * 100) / 100;

      // Calculate discount
      let discountAmount = 0;
      if (item.discountPercent && item.discountPercent > 0) {
        discountAmount = Math.round((grossAmount * (item.discountPercent / 100)) * 100) / 100;
      } else if (item.discount && item.discount > 0) {
        discountAmount = Math.min(grossAmount, Math.round(item.discount * 100) / 100);
      }

      // Taxable amount after eligible discount
      const taxableAmount = Math.max(0, Math.round((grossAmount - discountAmount) * 100) / 100);
      const gstRate = item.gstRate !== undefined ? item.gstRate : Number(config.defaultGstRate);

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isIntraState) {
        // Equal split between CGST and SGST
        const halfRate = gstRate / 2;
        cgst = Math.round((taxableAmount * (halfRate / 100)) * 100) / 100;
        sgst = Math.round((taxableAmount * (halfRate / 100)) * 100) / 100;
      } else {
        // Full GST rate as IGST
        igst = Math.round((taxableAmount * (gstRate / 100)) * 100) / 100;
      }

      const itemTotal = Math.round((taxableAmount + cgst + sgst + igst) * 100) / 100;

      totalTaxable += taxableAmount;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      calculatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: discountAmount,
        taxableAmount,
        gstRate,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: itemTotal,
      });
    }

    totalTaxable = Math.round(totalTaxable * 100) / 100;
    totalCgst = Math.round(totalCgst * 100) / 100;
    totalSgst = Math.round(totalSgst * 100) / 100;
    totalIgst = Math.round(totalIgst * 100) / 100;
    const totalGst = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;
    const rawGrandTotal = Math.round((totalTaxable + totalGst) * 100) / 100;

    // Optional rounding to nearest integer (or exact 2 decimals)
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

    return {
      isIntraState,
      supplierState,
      supplierStateCode,
      customerState,
      customerStateCode,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      subtotal: totalTaxable,
      roundOff,
      grandTotal: rawGrandTotal, // Preserve exact paise precision
      items: calculatedItems,
    };
  }

  /**
   * Convert currency number into Indian English words
   */
  static numberToWords(amount: number): string {
    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
      'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const num = Math.floor(amount);
    if (num === 0) return 'Zero Rupees Only';

    const inWords = (n: number): string => {
      let str = '';
      if (n > 99) {
        str += a[Math.floor(n / 100)] + 'Hundred ';
        n %= 100;
      }
      if (n > 19) {
        str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
      } else if (n > 0) {
        str += a[n];
      }
      return str;
    };

    let result = '';
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = num % 1000;

    if (crore > 0) result += inWords(crore) + 'Crore ';
    if (lakh > 0) result += inWords(lakh) + 'Lakh ';
    if (thousand > 0) result += inWords(thousand) + 'Thousand ';
    if (remainder > 0) result += inWords(remainder);

    const paise = Math.round((amount - num) * 100);
    let paiseStr = '';
    if (paise > 0) {
      paiseStr = ` and ${inWords(paise)}Paise`;
    }

    return `${result.trim()} Rupees${paiseStr} Only`;
  }
}
