import { calculateFee, COMMISSION, STRIPE_FEES } from './commission.constants';

describe('calculateFee', () => {
  it('calcule la commission correctement', () => {
    expect(calculateFee(1000)).toBe(75); // 1000 * 0.05 + 25
    expect(calculateFee(100)).toBe(30); // 100 * 0.05 + 25 = 5 + 25 = 30
    expect(calculateFee(0)).toBe(25); // minimum = frais fixes
  });

  it('applique le taux de 5%', () => {
    expect(calculateFee(10000)).toBe(525); // 10000 * 0.05 + 25
    expect(calculateFee(5000)).toBe(275); // 5000 * 0.05 + 25
  });

  it('arrondit le résultat au centime le plus proche', () => {
    // 333 * 0.05 = 16.65 → round = 17, + 25 = 42
    expect(calculateFee(333)).toBe(42);
  });

  it('expose les constantes COMMISSION correctement', () => {
    expect(COMMISSION.RATE).toBe(0.05);
    expect(COMMISSION.FIXED_CENTS).toBe(25);
  });

  it('expose les constantes STRIPE_FEES correctement', () => {
    expect(STRIPE_FEES.EEA.rate).toBe(0.015);
    expect(STRIPE_FEES.EEA.fixedCents).toBe(25);
    expect(STRIPE_FEES.UK.rate).toBe(0.025);
    expect(STRIPE_FEES.UK.fixedCents).toBe(25);
  });
});
