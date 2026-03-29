// Utility functions for API routes

import { getCurrentUser } from '@/lib/auth';
import { NextResponse, NextRequest } from 'next/server';
import type { User } from '@/lib/db';

const DEFAULT_ERROR_MESSAGE: string = 'An error occurred';

/**
 * Unified context type for authenticated API route handlers with dynamic parameters
 * @example { params, currentUser }: AuthContext<{ teamId: string }>
 */
export type AuthContext<ParamShape = {}> = {
  params: Promise<ParamShape>;
  currentUser: User;
};

/**
 * Simplified context type for routes without dynamic parameters
 * @example { currentUser }: AuthContextNoParams
 */
export type AuthContextNoParams = {
  currentUser: User;
};

/**
 * Wrapper for API route handlers to authenticate the user and catch errors and return a consistent error response
 * The authenticated user is passed to the handler via the params object (e.g., params.currentUser)
 * @param handler The API route handler function to wrap (e.g., POST, GET, etc.) with signature (request:NextRequest, params?: any) => Promise<NextResponse>
 * @returns A new API route handler function that includes authentication and error handling
 * Usage:
 * export const POST = withAuth(async (request: NextRequest, { currentUser }) => {
 *   // Your API logic here, with access to currentUser
 * });
 */
export function withAuth(handler: (request: NextRequest, params?: any) => Promise<NextResponse>) {
  return async (request: NextRequest, context?: any) => {
    try {
        const currentUser = await getCurrentUser();
        
        if (!currentUser) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }
        const handlerParams = {
          ...(context ?? {}),
          currentUser,
          params: Promise.resolve(context?.params ?? {}),
        };
        return await handler(request, handlerParams);
    } catch (error) {
        console.error('API route error:', error);
        return NextResponse.json(
          { error: 'An error occurred' },
          { status: 500 }
        );
    }
  };
}

/**
 * Return error response with the provided message and status code
 * @param message The error message to return in the response
 * @param statusCode The HTTP status code to use for the response (default: 400)
 * @returns A NextResponse object with the error message and status code
 * Usage:
 * return errorResponse('Invalid input', 422);
 */
export function errorResponse(message: string | null | undefined, statusCode: number = 400) {
  return NextResponse.json(
    { error: message != null ? message : DEFAULT_ERROR_MESSAGE },
    { status: statusCode }
  );
}