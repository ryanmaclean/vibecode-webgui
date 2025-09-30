// Type definitions for next-auth/jwt in tests
declare module 'next-auth/jwt' {
  export interface JWT {
    sub?: string | null;
    id?: string | null;
    role?: string | null;
    email?: string | null;
    name?: string | null;
    [key: string]: unknown;
  }

  export interface GetTokenParams {
    req: unknown;
    secret?: string;
    raw?: boolean;
  }

  export function getToken(params: GetTokenParams): Promise<JWT | null>;
}
