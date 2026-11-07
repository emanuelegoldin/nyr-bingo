/**
 * In-memory stand-in for the request cookies of `next/headers`, shared by a test and the route it calls.
 * Spec Reference: 01-authentication.md - Login
 */

/** Options a route passes when it sets a cookie. */
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  expires?: Date;
  path?: string;
}

/** One stored cookie. */
export interface StoredCookie extends CookieOptions {
  name: string;
  value: string;
}

const cookies = new Map<string, StoredCookie>();

/** The cookie store `cookies()` resolves to inside a route under test. */
export const cookieJar = {
  get: (name: string): StoredCookie | undefined => cookies.get(name),
  set: (name: string, value: string, options: CookieOptions = {}): void => {
    cookies.set(name, { name, value, ...options });
  },
  delete: (name: string): void => {
    cookies.delete(name);
  },
  has: (name: string): boolean => cookies.has(name),
};

/** Forget every cookie, so each test starts logged out. */
export const clearCookies = (): void => {
  cookies.clear();
};
