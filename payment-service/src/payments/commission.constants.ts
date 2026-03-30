export const COMMISSION = {
  RATE: 0.065,       // 7.5%
  FIXED_CENTS: 15,   // 0.15€
} as const;

/**
 * Calculates the platform fee in cents for a given amount in cents.
 * Formula: round(amount × 7.5%) + 15 cents
 */
export function calculateFee(amountCents: number): number {
  return Math.round(amountCents * COMMISSION.RATE) + COMMISSION.FIXED_CENTS;
}
