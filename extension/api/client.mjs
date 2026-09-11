import { getAccessToken, refreshSession, getSession } from '../auth/session.mjs';
import { VISCUE_API_URL } from './config.mjs';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function apiFetch(endpoint, options = {}, deps = {}) {
  const apiUrl = deps.apiUrl || VISCUE_API_URL;
  const storage = deps.storage;
  const fetchFn = deps.fetch || fetch;

  let token = await getAccessToken(deps.config || {}, storage);

  const url = `${apiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-viscue-request-id': crypto.randomUUID(),
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetchFn(url, {
    ...options,
    headers,
  });

  // Handle single 401 retry with refreshed token
  if (response.status === 401) {
    const session = await getSession(storage);
    if (session?.refreshToken) {
      try {
        const refreshed = await refreshSession(session.refreshToken, deps.config || {}, storage);
        if (refreshed?.accessToken) {
          headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
          response = await fetchFn(url, {
            ...options,
            headers,
          });
        }
      } catch {
        // Fall through to 401 handler
      }
    }
    // If still 401 after refresh attempt, try re-fetching a fresh token from storage
    // (accounts for the case where another tab already refreshed the session)
    if (response.status === 401) {
      const freshToken = await getAccessToken(deps.config || {}, storage, true);
      if (freshToken && freshToken !== token) {
        headers['Authorization'] = `Bearer ${freshToken}`;
        response = await fetchFn(url, {
          ...options,
          headers,
        });
      }
    }
  }

  if (response.status === 429) {
    throw new ApiError('Daily cue quota exhausted', 429, 'quota_exhausted');
  }

  if (response.status === 401) {
    // Signal to caller that re-authentication is needed, not just a generic error
    throw new ApiError('Session expired. Please sign in again to continue.', 401, 'session_expired');
  }

  if (!response.ok) {
    let errorMsg = 'API request failed';
    try {
      const errBody = await response.json();
      errorMsg = errBody?.error || errorMsg;
    } catch {
      // Ignore json parse error on failure
    }
    throw new ApiError(errorMsg, response.status, 'api_error');
  }

  return response.json();
}
