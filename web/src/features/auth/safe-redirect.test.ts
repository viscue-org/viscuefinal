import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('prevents open redirects and falls back to the extension landing page', () => {
    expect(safeRedirectPath('https://evil.example/steal')).toBe('/');
    expect(safeRedirectPath('//evil.example')).toBe('/');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
    expect(safeRedirectPath('')).toBe('/');
    expect(safeRedirectPath(null)).toBe('/');
    expect(safeRedirectPath(undefined)).toBe('/');
  });

  it('permits internal application paths', () => {
    expect(safeRedirectPath('/account')).toBe('/account');
    expect(safeRedirectPath('/connect?client_id=viscue-extension')).toBe(
      '/connect?client_id=viscue-extension'
    );
  });
});
