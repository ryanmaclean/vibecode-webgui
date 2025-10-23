/**
 * @deprecated This file has been consolidated into postgres-vector-database-adapter.ts
 *
 * Import from postgres-vector-database-adapter.ts instead:
 * import { PostgresVectorDatabaseAdapter } from './postgres-vector-database-adapter';
 *
 * This compatibility export will be removed in a future version.
 */

console.warn(
  '[DEPRECATION] postgres-vector-database-adapter-new.ts is deprecated. ' +
  'Import from postgres-vector-database-adapter.ts instead. ' +
  'See /claudedocs/DATABASE_CONSOLIDATION_PHASE2_POSTGRES.md for migration details.'
);

export * from './postgres-vector-database-adapter';
export { PostgresVectorDatabaseAdapter, PostgresVectorDatabaseAdapter as default } from './postgres-vector-database-adapter';
