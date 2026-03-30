import { calculateFee, COMMISSION } from './commission.constants';

describe('calculateFee', () => {
  it('calcule la commission correctement', () => {
    expect(calculateFee(1000)).toBe(90);  // 1000 * 0.075 + 15
    expect(calculateFee(100)).toBe(23);   // 100 * 0.075 + 15 = 7.5 + 15 = 22.5 → 23
    expect(calculateFee(0)).toBe(15);     // minimum = frais fixes
  });

  it('applique le taux de 7.5%', () => {
    expect(calculateFee(10000)).toBe(765); // 10000 * 0.075 + 15
    expect(calculateFee(5000)).toBe(390);  // 5000 * 0.075 + 15
  });

  it('arrondit le résultat au centime le plus proche', () => {
    // 333 * 0.075 = 24.975 → round = 25, + 15 = 40
    expect(calculateFee(333)).toBe(40);
  });

  it('expose les constantes COMMISSION correctement', () => {
    expect(COMMISSION.RATE).toBe(0.075);
    expect(COMMISSION.FIXED_CENTS).toBe(15);
  });
});
