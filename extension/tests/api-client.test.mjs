import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, ApiError } from '../api/client.mjs';

describe('Extension API Client', () => {
  it('sends bearer authorization and request id headers', async () => {
    let capturedHeaders = null;
    const mockFetch = async (url, opts) => {
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { test: 1 } }),
      };
    };

    const mockStorage = {
      get: async () => ({
        viscue_oauth_session: { accessToken: 'valid_tok_777' },
      }),
    };

    const data = await apiFetch('/test', {}, {
      fetch: mockFetch,
      storage: mockStorage,
      apiUrl: 'https://viscue.com/api',
    });

    assert.strictEqual(data.ok, true);
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer valid_tok_777');
    assert.ok(capturedHeaders['x-viscue-request-id']);
  });

  it('throws ApiError with quota_exhausted on 429', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 429,
    });

    await assert.rejects(
      async () => {
        await apiFetch('/test', {}, { fetch: mockFetch });
      },
      err => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 429);
        assert.strictEqual(err.code, 'quota_exhausted');
        return true;
      }
    );
  });
});
