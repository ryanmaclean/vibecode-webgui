// Manual mock for src/lib/prisma.ts
// Stateful for confirmationRequest; simple jest.fn() stubs for all other models/exports.

const store = new Map<string, any>();

const confirmationRequest = {
  create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
    const record = { ...data };
    store.set(record.request_id, record);
    return record;
  }),
  findUnique: jest.fn().mockImplementation(async ({ where }: { where: any }) => {
    return store.get(where.request_id) ?? null;
  }),
  findFirst: jest.fn().mockResolvedValue(null),
  findMany: jest.fn().mockImplementation(async ({ where }: { where?: any } = {}) => {
    let results = Array.from(store.values());
    if (where?.status) results = results.filter((r) => r.status === where.status);
    if (where?.agent_id) results = results.filter((r) => r.agent_id === where.agent_id);
    if (where?.request_id?.in) {
      const ids = new Set(where.request_id.in);
      results = results.filter((r) => ids.has(r.request_id));
    }
    return results;
  }),
  update: jest.fn().mockImplementation(async ({ where, data }: { where: any; data: any }) => {
    const existing = store.get(where.request_id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    store.set(where.request_id, updated);
    return updated;
  }),
  updateMany: jest.fn().mockImplementation(async ({ where, data }: { where?: any; data: any }) => {
    let count = 0;
    for (const [key, record] of store.entries()) {
      const matchesStatus = !where?.status || record.status === where.status;
      const matchesIds = !where?.request_id?.in || where.request_id.in.includes(key);
      if (matchesStatus && matchesIds) {
        store.set(key, { ...record, ...data });
        count++;
      }
    }
    return { count };
  }),
  count: jest.fn().mockImplementation(async ({ where }: { where?: any } = {}) => {
    let results = Array.from(store.values());
    if (where?.status) results = results.filter((r) => r.status === where.status);
    if (where?.agent_id) results = results.filter((r) => r.agent_id === where.agent_id);
    return results.length;
  }),
  delete: jest.fn().mockResolvedValue(null),
  deleteMany: jest.fn().mockImplementation(async () => {
    const count = store.size;
    store.clear();
    return { count };
  }),
  upsert: jest.fn().mockResolvedValue(null),
};

function makeModel() {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue(null),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn().mockResolvedValue(null),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

export const prisma = {
  confirmationRequest,
  user: makeModel(),
  workspace: makeModel(),
  project: makeModel(),
  experiment: makeModel(),
  experimentAssignment: makeModel(),
  experimentMetric: makeModel(),
  file: makeModel(),
  aIRequest: makeModel(),
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  $queryRaw: jest.fn().mockResolvedValue([]),
  $executeRaw: jest.fn().mockResolvedValue(0),
};

// Additional named exports from src/lib/prisma.ts
export const getUserByEmail = jest.fn().mockResolvedValue(null);
export const createWorkspace = jest.fn().mockResolvedValue(null);
export const logAIRequest = jest.fn().mockResolvedValue(null);

export function resetPrismaMock(): void {
  store.clear();
}

export default prisma;
