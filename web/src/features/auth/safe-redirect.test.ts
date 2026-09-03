import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('prevents open redirects and falls back to /account', () => {
    expect(safeRedirectPath('https://evil.example/steal')).toBe('/account');
    expect(safeRedirectPath('//evil.example')).toBe('/account');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/account');
    expect(safeRedirectPath('')).toBe('/account');
    expect(safeRedirectPath(null)).toBe('/account');
    expect(safeRedirectPath(undefined)).toBe('/account');
  });

  it('permits internal application paths', () => {
    expect(safeRedirectPath('/account')).toBe('/account');
    expect(safeRedirectPath('/connect?client_id=viscue-extension')).toBe(
      '/connect?client_id=viscue-extension'
    );
  });
});
