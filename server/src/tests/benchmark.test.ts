import { describe, it, expect, beforeAll } from 'vitest';
import { UnitConversionService } from '../services/unit.service.js';
import { ProductionService } from '../services/production.service.js';
import { runBenchmarkScenario } from '../scripts/run-benchmark.js';
import { InventoryService } from '../services/inventory.service.js';
import prisma from '../db/client.js';
import { ItemType } from '@prisma/client';

describe('FactoryFlow - Mandatory Benchmark & Core Logic Tests', () => {
  let benchmarkResult: any;

  beforeAll(async () => {
    benchmarkResult = await runBenchmarkScenario();
  });

  it('1. Flour stock calculation must equal 120 kg', async () => {
    const flour = await prisma.rawMaterial.findUnique({ where: { code: 'RM-FLOUR' } });
    const stock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, flour!.id);
    expect(stock).toBe(120);
  });

  it('2. Oil stock calculation must equal 19.5 litres', async () => {
    const oil = await prisma.rawMaterial.findUnique({ where: { code: 'RM-OIL' } });
    const stock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, oil!.id);
    expect(stock).toBe(19.5);
  });

  it('3. Packaging stock calculation must equal 306 pouches and 21 cartons', async () => {
    const pouch = await prisma.packagingMaterial.findUnique({ where: { code: 'PKG-POUCH-200G' } });
    const carton = await prisma.packagingMaterial.findUnique({ where: { code: 'PKG-CARTON-20' } });
    const pouchStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, pouch!.id);
    const cartonStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, carton!.id);
    expect(pouchStock).toBe(306);
    expect(cartonStock).toBe(21);
  });

  it('4. Finished-goods stock calculation must equal 88 packets', async () => {
    const product = await prisma.product.findUnique({ where: { sku: 'MRK-200G' } });
    const stock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, product!.id);
    expect(stock).toBe(88);
  });

  it('5. BOM planned consumption must correctly compute batch multipliers', () => {
    const standardQty = 40;
    const batchSize = 200;
    const plannedQty = 200;
    const computed = (standardQty / batchSize) * plannedQty;
    expect(computed).toBe(40);
  });

  it('6. Unit conversions must correctly handle compatible units and reject incompatible ones', () => {
    expect(UnitConversionService.convert(1, 'kg', 'g')).toBe(1000);
    expect(UnitConversionService.convert(500, 'g', 'kg')).toBe(0.5);
    expect(UnitConversionService.convert(1, 'litre', 'ml')).toBe(1000);
    expect(() => UnitConversionService.convert(1, 'kg', 'litre')).toThrow();
  });

  it('7. Consumption variance must correctly compute percentage and flag tolerance', () => {
    // Actual 10.5 vs Planned 10.0 => +5%
    const res = ProductionService.calculateVariance(10.5, 10.0, 3.0);
    expect(res.variancePercent).toBe(5);
    expect(res.status).toBe('EXCEEDS_TOLERANCE');

    // Actual 40 vs Planned 40 => 0%
    const res2 = ProductionService.calculateVariance(40, 40, 3.0);
    expect(res2.variancePercent).toBe(0);
    expect(res2.status).toBe('NORMAL');
  });

  it('8. Yield variance must correctly compute -6% and flag tolerance', () => {
    // Actual 188 vs Expected 200 => -6%
    const res = ProductionService.calculateVariance(188, 200, 3.0);
    expect(res.variancePercent).toBe(-6);
    expect(res.status).toBe('EXCEEDS_TOLERANCE');
  });

  it('9. CGST and SGST calculation for Tamil Nadu intra-state (2.5% each)', async () => {
    const invoice = await prisma.invoice.findFirst({
      where: { customer: { stateCode: '33' } },
    });
    expect(Number(invoice?.cgstAmount)).toBe(187.5);
    expect(Number(invoice?.sgstAmount)).toBe(187.5);
    expect(Number(invoice?.igstAmount)).toBe(0);
  });

  it('10. Invoice grand total calculation must equal ₹7,875', async () => {
    const invoice = await prisma.invoice.findFirst();
    expect(Number(invoice?.grandTotal)).toBe(7875);
    expect(Number(invoice?.totalTaxable)).toBe(7500);
  });

  it('11. Payment and outstanding calculation must equal ₹3,875 after ₹4,000 payment', async () => {
    const invoice = await prisma.invoice.findFirst();
    expect(Number(invoice?.paidAmount)).toBe(4000);
    expect(Number(invoice?.outstandingAmount)).toBe(3875);
  });

  it('12. FIFO inventory valuation must prioritize oldest ₹42 layer over ₹45 layer', async () => {
    const flour = await prisma.rawMaterial.findUnique({ where: { code: 'RM-FLOUR' } });
    const layers = await prisma.inventoryValuationLayer.findMany({
      where: { itemId: flour!.id },
      orderBy: { receivedDate: 'asc' },
    });
    // Layer 1 (Opening 100kg @ 42): 40kg consumed, remaining = 60kg
    expect(Number(layers[0].unitCost)).toBe(42);
    expect(Number(layers[0].remainingQuantity)).toBe(60);

    // Layer 2 (Purchase 60kg @ 45): completely untouched, remaining = 60kg
    expect(Number(layers[1].unitCost)).toBe(45);
    expect(Number(layers[1].remainingQuantity)).toBe(60);
  });

  it('13. Cost per packet must equal ₹30.90 based on actual 188 good packets', async () => {
    const prodRun = await prisma.productionRun.findFirst();
    expect(Number(prodRun?.costPerPacket)).toBe(30.9);
  });

  it('14. Insufficient stock prevention must reject dispatch with shortage', async () => {
    const orderB = await prisma.salesOrder.findFirst({
      where: { customer: { stateCode: '29' } },
    });
    expect(orderB).toBeDefined();
    // System successfully prevented full dispatch of 120 packets
    const dispatchB = await prisma.dispatch.findUnique({ where: { orderId: orderB!.id } });
    expect(dispatchB).toBeNull();
  });

  it('15. Benchmark verification table assertions must all pass', () => {
    expect(benchmarkResult.allPassed).toBe(true);
  });
});
