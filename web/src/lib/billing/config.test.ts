import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { productIdForPlan, planForProductId } from './config';

describe('Billing Config and Allowlist', () => {
  const origPlus = process.env.DODO_PLUS_PRODUCT_ID;
  const origPro = process.env.DODO_PRO_PRODUCT_ID;

  beforeEach(() => {
    process.env.DODO_PLUS_PRODUCT_ID = 'pdt_plus_test_123';
    process.env.DODO_PRO_PRODUCT_ID = 'pdt_pro_test_456';
  });

  afterEach(() => {
    process.env.DODO_PLUS_PRODUCT_ID = origPlus;
    process.env.DODO_PRO_PRODUCT_ID = origPro;
  });

  it('maps plan to allowlisted product id', () => {
    expect(productIdForPlan('plus')).toBe('pdt_plus_test_123');
    expect(productIdForPlan('pro')).toBe('pdt_pro_test_456');
    expect(() => productIdForPlan('enterprise' as never)).toThrow();
  });

  it('maps product id back to plan slug', () => {
    expect(planForProductId('pdt_plus_test_123')).toBe('plus');
    expect(planForProductId('pdt_pro_test_456')).toBe('pro');
    expect(planForProductId('pdt_unknown')).toBeNull();
  });
});
