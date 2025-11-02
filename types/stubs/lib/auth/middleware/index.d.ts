import type { NextRequest } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id?: string;
    role?: string;
    email?: string;
  };
}

export function withAIAuth<T>(handler: (request: AuthenticatedRequest) => Promise<T>): (request: NextRequest) => Promise<T>;
