/**
 * Call a Next.js route handler directly, the way the App Router does.
 * Spec Reference: 21-authorization.md - Status Rules
 */

import { NextRequest } from 'next/server';

/** A route handler as exported by a `route.ts` file. */
type RouteHandler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** What a test passes to a route. */
export interface RouteCall {
  /** HTTP method (default GET) */
  method?: string;
  /** JSON body; a FormData body is sent as multipart */
  body?: unknown;
  /** The dynamic segments of the route, such as { gameId } */
  params?: Record<string, string>;
  /** Query string, without the leading '?' */
  search?: string;
}

/** What the route answered. */
export interface RouteResult<T = Record<string, unknown>> {
  status: number;
  body: T;
}

/**
 * Call a route handler and read its JSON answer.
 * @param handler The exported GET, POST, PUT, PATCH or DELETE function
 * @param call Method, body, params and query string
 * @returns The status and the parsed body (null when there is none)
 */
export const callRoute = async <T = Record<string, unknown>>(
  handler: RouteHandler,
  { method = 'GET', body, params = {}, search }: RouteCall = {}
): Promise<RouteResult<T>> => {
  const url = `http://localhost/api/under-test${search ? `?${search}` : ''}`;
  const init: { method: string; body?: BodyInit; headers?: Record<string, string> } = { method };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const response = await handler(new NextRequest(url, init), { params: Promise.resolve(params) });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
};
