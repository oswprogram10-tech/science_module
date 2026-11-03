export type Solute = 'salt' | 'sugar' | 'alum' | 'bakingSoda';

export const SOLUTES: readonly Solute[] = ['salt', 'sugar', 'alum', 'bakingSoda'];

/** 물 100 g당 녹는 g (근사값, 교사 검수 대상). */
export const SOLUBILITY_TABLE: Record<Solute, ReadonlyArray<readonly [number, number]>> = {
  salt: [[10, 35.8], [20, 35.9], [30, 36.1], [40, 36.4], [50, 36.7], [60, 37.1]],
  sugar: [[10, 190], [20, 204], [30, 220], [40, 238], [50, 260], [60, 287]],
  alum: [[10, 7.6], [20, 11.4], [30, 16.6], [40, 23.8], [50, 36.4], [60, 57.4]],
  bakingSoda: [[10, 8.2], [20, 9.6], [30, 11.1], [40, 12.7], [50, 14.5], [60, 16.4]],
};

export function solubilityPer100g(solute: Solute, tempC: number): number {
  const rows = SOLUBILITY_TABLE[solute];
  if (!rows) throw new RangeError(`알 수 없는 용질: ${String(solute)}`);
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  if (!(tempC >= first[0] && tempC <= last[0])) {
    throw new RangeError(`온도 ${tempC} °C는 표 범위(${first[0]}~${last[0]} °C)를 벗어났습니다.`);
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const [t0, s0] = rows[i]!;
    const [t1, s1] = rows[i + 1]!;
    if (tempC >= t0 && tempC <= t1) {
      return s0 + ((s1 - s0) * (tempC - t0)) / (t1 - t0);
    }
  }
  return last[1];
}

/** 물 1 mL = 1 g. 포화까지 녹을 수 있는 최대 g. */
export function capacityG(solute: Solute, tempC: number, waterMl: number): number {
  return (solubilityPer100g(solute, tempC) * waterMl) / 100;
}
