/**
 * Mock Prisma Client for testing.
 *
 * The mock is derived from prisma/schema.prisma at load time, so it cannot
 * drift from the schema (issue #2136): every `model X` gets a delegate
 * `x` (first letter lower-cased, as Prisma names it) with every delegate
 * method as a jest.fn(), and every `enum E` is exposed with its values.
 * Previously this file hand-listed 7 of the schema's models and an
 * ExperimentStatus without REVIEW, so newer models (ConfirmationRequest,
 * AgentMemory, ...) and methods (experiment.deleteMany) were undefined.
 *
 * tests/unit/prisma-mock-schema-sync.test.ts guards this contract.
 */
// requireActual: a test that mocks fs/path must not break the Prisma mock.
const { readFileSync } = jest.requireActual<typeof import('fs')>('fs');
const { resolve } = jest.requireActual<typeof import('path')>('path');

export const SCHEMA_PATH = resolve(__dirname, '../../../prisma/schema.prisma');

/** Every method a generated Prisma model delegate exposes (Prisma 6). */
export const DELEGATE_METHODS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
] as const;

type Delegate = Record<(typeof DELEGATE_METHODS)[number], jest.Mock>;

/** Strip `//` comments so they cannot be mistaken for declarations. */
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

/** Parse `model X {` names and `enum E { ... }` values from a Prisma schema. */
export function parsePrismaSchema(source: string): {
  models: string[];
  enums: Record<string, string[]>;
} {
  const clean = stripComments(source);
  const models = Array.from(clean.matchAll(/^\s*model\s+(\w+)\s*\{/gm), (m) => m[1]);
  const enums: Record<string, string[]> = {};
  for (const m of clean.matchAll(/^\s*enum\s+(\w+)\s*\{([^}]*)\}/gm)) {
    enums[m[1]] = m[2]
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((token) => token && !token.startsWith('@'));
  }
  return { models, enums };
}

/** Prisma's client property name for a model: first character lower-cased. */
export function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

const schema = parsePrismaSchema(readFileSync(SCHEMA_PATH, 'utf8'));

function makeDelegate(): Delegate {
  const delegate = {} as Delegate;
  for (const method of DELEGATE_METHODS) {
    delegate[method] = jest.fn();
  }
  return delegate;
}

const enumObjects: Record<string, Record<string, string>> = {};
for (const [name, values] of Object.entries(schema.enums)) {
  enumObjects[name] = Object.freeze(
    Object.fromEntries(values.map((value) => [value, value]))
  ) as Record<string, string>;
}

/** All schema enums, keyed by enum name (mirrors `$Enums` in the real client). */
export const $Enums = enumObjects;

// Named enum exports. tests/unit/prisma-mock-schema-sync.test.ts fails if the
// schema gains an enum that is not exported here.
export const ConversationStatus = enumObjects.ConversationStatus;
export const MessageRole = enumObjects.MessageRole;
export const ExperimentStatus = enumObjects.ExperimentStatus as {
  readonly DRAFT: 'DRAFT';
  readonly REVIEW: 'REVIEW';
  readonly RUNNING: 'RUNNING';
  readonly PAUSED: 'PAUSED';
  readonly COMPLETED: 'COMPLETED';
  readonly ARCHIVED: 'ARCHIVED';
};
export type ExperimentStatus = (typeof ExperimentStatus)[keyof typeof ExperimentStatus];

type MockPrismaClient = Record<string, Delegate> & {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRaw: jest.Mock;
  $executeRawUnsafe: jest.Mock;
  $on: jest.Mock;
  $use: jest.Mock;
  $extends: jest.Mock;
};

export const mockPrismaClient = {
  ...Object.fromEntries(schema.models.map((model) => [delegateName(model), makeDelegate()])),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $on: jest.fn(),
  $use: jest.fn(),
  $extends: jest.fn(),
} as MockPrismaClient;

/** Model names parsed from the schema (for sync tests and helpers). */
export const schemaModels: readonly string[] = schema.models;

export function resetPrismaMock(): void {
  Object.values(mockPrismaClient).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method) => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as jest.Mock).mockReset();
        }
      });
    }
  });
}

export const PrismaClient = jest.fn(() => mockPrismaClient);

// Alias for prismaMock to match what tests expect
export const prismaMock = mockPrismaClient;

export default {
  PrismaClient,
  mockPrismaClient,
  prismaMock,
  resetPrismaMock,
  $Enums,
  ConversationStatus,
  MessageRole,
  ExperimentStatus,
};
