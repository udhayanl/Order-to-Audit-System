import { AppError } from '../middleware/errorHandler.js';

export type SupportedUnit = 'kg' | 'g' | 'litre' | 'ml' | 'pieces' | 'cartons' | 'packets';

export class UnitConversionService {
  /**
   * Convert quantity between compatible units
   */
  static convert(
    quantity: number,
    fromUnit: string,
    toUnit: string,
    cartonFactor: number = 20
  ): number {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    if (from === to) return quantity;

    // Weight conversions
    if (from === 'kg' && to === 'g') return Math.round(quantity * 1000 * 1000) / 1000;
    if (from === 'g' && to === 'kg') return Math.round((quantity / 1000) * 1000) / 1000;

    // Volume conversions
    if ((from === 'litre' || from === 'l') && to === 'ml') return Math.round(quantity * 1000 * 1000) / 1000;
    if (from === 'ml' && (to === 'litre' || to === 'l')) return Math.round((quantity / 1000) * 1000) / 1000;

    // Count / Pack conversions
    if (
      (from === 'pieces' && to === 'packets') ||
      (from === 'packets' && to === 'pieces')
    ) {
      return quantity;
    }

    // Carton conversions (1 carton = configured factor packets/pieces, default 20)
    if (from === 'cartons' && (to === 'packets' || to === 'pieces')) {
      return Math.round(quantity * cartonFactor * 1000) / 1000;
    }
    if ((from === 'packets' || from === 'pieces') && to === 'cartons') {
      return Math.round((quantity / cartonFactor) * 1000) / 1000;
    }

    throw new AppError(`Incompatible unit conversion from '${fromUnit}' to '${toUnit}'`);
  }

  static areUnitsCompatible(unitA: string, unitB: string): boolean {
    const a = unitA.toLowerCase().trim();
    const b = unitB.toLowerCase().trim();
    if (a === b) return true;

    const weights = ['kg', 'g'];
    const volumes = ['litre', 'ml', 'l'];
    const counts = ['pieces', 'packets', 'cartons'];

    if (weights.includes(a) && weights.includes(b)) return true;
    if (volumes.includes(a) && volumes.includes(b)) return true;
    if (counts.includes(a) && counts.includes(b)) return true;

    return false;
  }
}

