import { describe, it, expect } from 'vitest';
import { validateAuthorizationRequest } from './authorize';

describe('validateAuthorizationRequest', () => {
  const validRequest = {
    client_id: 'viscue-extension',
    redirect_uri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth',
    response_type: 'code',
    code_challenge: 'E9Melhoa2OwvFrGMTJguCH5Zw_l5UG39WgpmJ351min',
    code_challenge_method: 'S256',
    state: 'abcdef0123456789abcdef0123456789',
    scope: 'openid email profile',
  };

  it('rejects an unknown client or invalid redirect URI', () => {
    expect(
      validateAuthorizationRequest({
        ...validRequest,
        client_id: 'unknown-client',
      })
    ).toEqual({ ok: false, error: 'invalid_client' });

    expect(
      validateAuthorizationRequest({
        ...validRequest,
        redirect_uri: 'https://evil.example/callback',
      })
    ).toEqual({ ok: false, error: 'invalid_redirect_uri' });
  });

  it('rejects unsupported response types or missing PKCE challenge', () => {
    expect(
      validateAuthorizationRequest({
        ...validRequest,
        response_type: 'token',
      })
    ).toEqual({ ok: false, error: 'unsupported_response_type' });

    expect(
      validateAuthorizationRequest({
        ...validRequest,
        code_challenge: '',
      })
    ).toEqual({ ok: false, error: 'invalid_request' });

    expect(
      validateAuthorizationRequest({
        ...validRequest,
        code_challenge_method: 'plain',
      })
    ).toEqual({ ok: false, error: 'invalid_request' });
  });

  it('rejects short or weak state parameters', () => {
    expect(
      validateAuthorizationRequest({
        ...validRequest,
        state: 'short',
      })
    ).toEqual({ ok: false, error: 'invalid_request' });
  });

  it('approves a registered extension OAuth 2.1 authorization request', () => {
    expect(validateAuthorizationRequest(validRequest)).toMatchObject({
      ok: true,
      params: validRequest,
    });
  });
});
