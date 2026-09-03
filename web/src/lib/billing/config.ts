export type PaidPlan = 'plus' | 'pro';

export const BILLING_PLANS: Record<
  PaidPlan,
  { name: string; priceCents: number; dailyCues: number }
> = {
  plus: {
    name: 'Viscue Plus',
    priceCents: 490,
    dailyCues: 28,
  },
  pro: {
    name: 'Viscue Pro',
    priceCents: 900,
    dailyCues: 99,
  },
};

export function getPlusProductId(): string {
  return process.env.DODO_PLUS_PRODUCT_ID || 'pdt_0Njwkcsm5QrrZxWwkAe3L';
}

export function getProProductId(): string {
  return process.env.DODO_PRO_PRODUCT_ID || 'pdt_0Njwkcq27QRFcZ5cACBD5';
}

export function productIdForPlan(plan: PaidPlan): string {
  if (plan === 'plus') {
    return getPlusProductId();
  }
  if (plan === 'pro') {
    return getProProductId();
  }
  throw new Error(`Unsupported plan: ${plan}`);
}

export function planForProductId(productId: string): PaidPlan | null {
  if (!productId) return null;
  if (productId === getPlusProductId()) return 'plus';
  if (productId === getProProductId()) return 'pro';
  return null;
}
