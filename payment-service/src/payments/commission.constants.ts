export const COMMISSION = {
  RATE: 0.05,          // 5% brut prélevé sur la transaction
  FIXED_CENTS: 25,     // 0.25€ fixe (couvre le fixe Stripe)
} as const;

// Frais Stripe selon origine de la carte (pour affichage transparent)
export const STRIPE_FEES = {
  EEA: { rate: 0.015, fixedCents: 25 },  // 1.5% + 0.25€
  UK:  { rate: 0.025, fixedCents: 25 },  // 2.5% + 0.25€
} as const;

/**
 * Calculates the platform fee in cents for a given amount in cents.
 * Formula: round(amount × 5%) + 25 cents
 */
export function calculateFee(amountCents: number): number {
  return Math.round(amountCents * COMMISSION.RATE) + COMMISSION.FIXED_CENTS;
}
