import { PaymentMethod } from '@prisma/client';
import { CustomerPaymentService } from './customer-payment.service.js';
import { ReceivablesPayablesService } from './receivables-payables.service.js';

export interface RecordPaymentParams {
  customerId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  financialAccountId?: string;
  referenceNumber?: string;
  notes?: string;
  userId: string;
}

export class PaymentService {
  /**
   * Record customer payment - delegates to full double-entry CustomerPaymentService
   */
  static async recordPayment(params: RecordPaymentParams) {
    return CustomerPaymentService.recordPayment({
      customerId: params.customerId,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      financialAccountId: params.financialAccountId,
      referenceNumber: params.referenceNumber,
      notes: params.notes,
      invoiceId: params.invoiceId,
      userId: params.userId,
    });
  }

  /**
   * Calculate customer outstanding and ageing buckets (0-30, 31-60, 61-90, 90+ days)
   */
  static async getCustomerAgeing() {
    const report = await ReceivablesPayablesService.getCustomerAgeingSchedule();
    return report.customers.map(c => ({
      customerId: c.customerId,
      customerName: c.customerName,
      gstin: c.gstin,
      state: c.state,
      totalOutstanding: c.totalOutstanding,
      bucket0_30: c.days1_30,
      bucket31_60: c.days31_60,
      bucket61_90: c.days61_90,
      bucketAbove90: c.daysAbove90,
      invoices: c.invoices,
    }));
  }
}
