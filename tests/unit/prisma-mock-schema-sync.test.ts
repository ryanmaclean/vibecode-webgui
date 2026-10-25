/**
 * Guard for issue #2136: the @prisma/client jest mock must track
 * prisma/schema.prisma. Parses the schema independently of the mock.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as prismaMock from '../__mocks__/@prisma/client';

const schemaSource = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

const schemaModels = Array.from(schemaSource.matchAll(/^\s*model\s+(\w+)\s*\{/gm), (m) => m[1]);
const schemaEnums = Array.from(schemaSource.matchAll(/^\s*enum\s+(\w+)\s*\{([^}]*)\}/gm), (m) => ({
  name: m[1],
  values: m[2]
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((token) => token && !token.startsWith('@')),
}));

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

describe('@prisma/client mock stays in sync with prisma/schema.prisma (#2136)', () => {
  it('finds models and enums in the schema', () => {
    expect(schemaModels.length).toBeGreaterThan(0);
    expect(schemaEnums.length).toBeGreaterThan(0);
  });

  it.each(schemaModels)('exposes a full delegate for model %s', (model) => {
    const delegate = (prismaMock.mockPrismaClient as Record<string, Record<string, unknown>>)[
      lowerFirst(model)
    ];
    expect(delegate).toBeDefined();
    for (const method of prismaMock.DELEGATE_METHODS) {
      expect(jest.isMockFunction(delegate[method])).toBe(true);
    }
  });

  it('has no delegates for models that are not in the schema', () => {
    const delegates = Object.keys(prismaMock.mockPrismaClient).filter((k) => !k.startsWith('$'));
    expect(delegates.sort()).toEqual(schemaModels.map(lowerFirst).sort());
  });

  it('covers the delegates whose absence broke CI on #2133/#2135', () => {
    expect(jest.isMockFunction(prismaMock.mockPrismaClient.experiment.deleteMany)).toBe(true);
    expect(jest.isMockFunction(prismaMock.mockPrismaClient.confirmationRequest.updateMany)).toBe(true);
  });

  it.each(schemaEnums.map((e) => [e.name, e.values] as const))(
    'exports enum %s with the schema values',
    (name, values) => {
      expect(Object.values(prismaMock.$Enums[name] ?? {})).toEqual(values);
      const named = (prismaMock as unknown as Record<string, unknown>)[name];
      expect(named).toBe(prismaMock.$Enums[name]);
    }
  );

  it('ExperimentStatus includes REVIEW', () => {
    expect(prismaMock.ExperimentStatus.REVIEW).toBe('REVIEW');
  });

  it('PrismaClient constructs the shared mock', () => {
    expect(new prismaMock.PrismaClient()).toBe(prismaMock.mockPrismaClient);
  });
});
