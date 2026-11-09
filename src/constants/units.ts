import type { Food } from '../types/index.js';

// 量の単位。食パンは「枚」、バナナやウインナーは「本」で数えられるようにしている
export const UNITS: Food['unit'][] = ['g', '個', '枚', '本', '杯', '食'];

// 「1個」「1枚」「1本」のように個数で数える単位
export type CountUnit = '個' | '枚' | '本';
export const COUNT_UNITS: CountUnit[] = ['個', '枚', '本'];

// 量を入れるときに出す「よく使う量」のボタン
export function quickAmounts(unit: Food['unit']): number[] {
  switch (unit) {
    case 'g':
      return [50, 100, 150, 200, 250];
    case '食':
      return [0.5, 1, 1.5];
    case '杯':
      return [0.5, 1, 2];
    default:
      return [1, 2, 3];
  }
}
