// Type definitions for next-auth/jwt in tests
declare module 'next-auth/jwt' {
  export interface JWT {
    sub?: string | null;
    id?: string | null;
    role?: string | null;
    email?: string | null;
    name?: string | null;
    [key: string]: any;
  }

  export function getToken(params: any): Promise<JWT | null>;
}