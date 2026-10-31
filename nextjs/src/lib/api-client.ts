/**
 * Result of a client-side API call. Failures carry the HTTP status and the
 * `error` string of the response body (null when the body has none), so every
 * call site can choose its own fallback text.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string | null };

/** Options accepted by {@link apiFetch}. `json` is serialised as the request body. */
export type ApiFetchInit = Omit<RequestInit, 'body'> & {
  json?: unknown;
  body?: BodyInit;
};

/**
 * Fetch an API route and parse its JSON body. Never throws.
 *
 * - `json` is stringified and sent with `Content-Type: application/json`.
 * - A network failure or a response whose body is not JSON yields
 *   `{ ok: false, status: 0, error: null }` (no usable response).
 * - A non-2xx JSON response yields `{ ok: false, status, error }`, where
 *   `error` is the body's `error` string, or null if it has none.
 *
 * @param url - Request URL.
 * @param init - Standard fetch options, plus the optional `json` payload.
 * @returns The parsed body on success, or the failure details.
 */
export const apiFetch = async <T>(url: string, init: ApiFetchInit = {}): Promise<ApiResult<T>> => {
  const { json, body, headers, ...rest } = init;
  const requestHeaders = new Headers(headers);
  if (json !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      body: json !== undefined ? JSON.stringify(json) : body,
    });
    const data = (await res.json()) as T & { error?: unknown };
    if (!res.ok) {
      const error = data?.error;
      return { ok: false, status: res.status, error: typeof error === 'string' ? error : null };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: null };
  }
};
