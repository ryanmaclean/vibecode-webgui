/**
 * Temporary Zod compatibility wrapper.
 *
 * Exports all Zod symbols from a single module so the v4 upgrade can be
 * implemented without sweeping import updates. Once the migration completes,
 * swap or remove this file.
 */
export * from 'zod';
export { z } from 'zod';

import { ZodError } from 'zod';

export const isZodError = (error: unknown): error is ZodError =>
  error instanceof ZodError;
