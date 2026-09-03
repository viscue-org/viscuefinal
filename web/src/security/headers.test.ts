import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

describe('Security Headers', () => {
  it('enforces hardened security headers on all routes', async () => {
    if (!nextConfig.headers) {
      throw new Error('nextConfig.headers is required');
    }

    const headersList = await nextConfig.headers();
    const globalHeader = headersList.find(h => h.source === '/:path*');

    expect(globalHeader).toBeDefined();
    const headersMap = Object.fromEntries(
      globalHeader!.headers.map(h => [h.key, h.value])
    );

    expect(headersMap['Content-Security-Policy']).toBeDefined();
    expect(headersMap['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headersMap['Content-Security-Policy']).not.toContain("'unsafe-eval'");
    expect(headersMap['Referrer-Policy']).toBe('no-referrer');
    expect(headersMap['X-Content-Type-Options']).toBe('nosniff');
    expect(headersMap['X-Frame-Options']).toBe('DENY');
    expect(headersMap['Permissions-Policy']).toBeDefined();
  });
});
