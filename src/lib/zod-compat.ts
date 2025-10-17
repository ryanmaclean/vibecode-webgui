/**
 * Temporary Zod compatibility wrapper.
 *
 * Re-export Zod from a single location so migrating to v4 requires touching
 * only this module. Once the upgrade is complete, we can remove this file
 * or swap the exports without sweeping the codebase.
 */
export * from 'zod';
export { z } from 'zod';

import { ZodError } from 'zod';

export const isZodError = (error: unknown): error is ZodError =>
  error instanceof ZodError;
