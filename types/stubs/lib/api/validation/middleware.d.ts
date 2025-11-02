import type { NextRequest } from 'next/server';
import type { ZodTypeAny } from 'zod';

export function validateRequestBody<T extends ZodTypeAny>(request: NextRequest, schema: T): Promise<
  | { success: true; data: any }
  | { success: false; error: any }
>;
