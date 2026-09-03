export interface AuthorizationRequest {
  client_id?: string | null;
  redirect_uri?: string | null;
  response_type?: string | null;
  code_challenge?: string | null;
  code_challenge_method?: string | null;
  state?: string | null;
  scope?: string | null;
}

export type AuthorizationValidationResult =
  | {
      ok: true;
      params: {
        client_id: string;
        redirect_uri: string;
        response_type: string;
        code_challenge: string;
        code_challenge_method: string;
        state: string;
        scope: string;
      };
    }
  | {
      ok: false;
      error: 'invalid_client' | 'invalid_redirect_uri' | 'unsupported_response_type' | 'invalid_request';
    };

const REGISTERED_CLIENT_ID = 'viscue-extension';
const CHROMIUM_REDIRECT_REGEX = /^https:\/\/[a-p0-9]{32}\.chromiumapp\.org(\/.*)?$/i;

export function validateAuthorizationRequest(
  request: AuthorizationRequest
): AuthorizationValidationResult {
  if (request.client_id !== REGISTERED_CLIENT_ID) {
    return { ok: false, error: 'invalid_client' };
  }

  if (!request.redirect_uri || !CHROMIUM_REDIRECT_REGEX.test(request.redirect_uri)) {
    return { ok: false, error: 'invalid_redirect_uri' };
  }

  if (request.response_type !== 'code') {
    return { ok: false, error: 'unsupported_response_type' };
  }

  if (!request.code_challenge || request.code_challenge_method !== 'S256') {
    return { ok: false, error: 'invalid_request' };
  }

  // State must be non-empty and at least 16 chars (128 bits of entropy)
  if (!request.state || request.state.length < 16) {
    return { ok: false, error: 'invalid_request' };
  }

  return {
    ok: true,
    params: {
      client_id: request.client_id,
      redirect_uri: request.redirect_uri,
      response_type: request.response_type,
      code_challenge: request.code_challenge,
      code_challenge_method: request.code_challenge_method,
      state: request.state,
      scope: request.scope || 'openid email profile',
    },
  };
}
