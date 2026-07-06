import crypto from "crypto";
import { vi } from "vitest";

// ==============================================================
// A minimal, generic, stateful in-memory double for the Prisma
// client used by our e2e suites.
//
// The global mock in tests/setup.js returns `undefined` for every
// call, which is fine for unit tests (which mock exactly what they
// need) but breaks e2e tests that need a real create -> read ->
// update flow across several requests within the same test.
//
// This helper keeps an in-memory array per "model" and implements
// just enough of the Prisma Client surface (findUnique, findFirst,
// findMany, create, update, upsert, delete, count, aggregate,
// groupBy) to support the flows exercised by our e2e tests. It is
// NOT a full Prisma re-implementation.
// ==============================================================

function matchesValue(actual, expected) {
  if (expected === null) return actual === null || actual === undefined;

  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    // Operator object, e.g. { in: [...] }, { contains: "x" }, { not: null }
    return Object.entries(expected).every(([op, val]) => {
      switch (op) {
        case "in":
          return val.includes(actual);
        case "notIn":
          return !val.includes(actual);
        case "not":
          return !matchesValue(actual, val);
        case "contains":
          return typeof actual === "string" && actual.toLowerCase().includes(String(val).toLowerCase());
        case "gte":
          return actual >= val;
        case "gt":
          return actual > val;
        case "lte":
          return actual <= val;
        case "lt":
          return actual < val;
        case "equals":
          return actual === val;
        default:
          return true;
      }
    });
  }

  return actual === expected;
}

function matchesWhere(record, where) {
  if (!where) return true;

  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((clause) => matchesWhere(record, clause));
    if (key === "AND") return value.every((clause) => matchesWhere(record, clause));
    if (key === "NOT") return !matchesWhere(record, value);
    return matchesValue(record[key], value);
  });
}

function applyOrderBy(records, orderBy) {
  if (!orderBy) return records;
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  const sorted = [...records];
  sorted.sort((a, b) => {
    for (const entry of entries) {
      const [field, dir] = Object.entries(entry)[0];
      const av = a[field];
      const bv = b[field];
      let cmp = 0;
      if (av instanceof Date || bv instanceof Date) {
        cmp = new Date(av).getTime() - new Date(bv).getTime();
      } else if (av > bv) cmp = 1;
      else if (av < bv) cmp = -1;
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}

// Naive relation table: modelName -> { relationField: { model, from (fk on this record), to (field on target, default "id") } }
const RELATIONS = {
  user: {
    trainerProfile: { model: "trainerProfile", from: "id", to: "userId" },
    settings: { model: "userSettings", from: "id", to: "userId" },
  },
  gymSession: {
    user: { model: "user", from: "userId", to: "id" },
  },
  socialChallenge: {
    user: { model: "user", from: "userId", to: "id" },
    partner: { model: "user", from: "partnerUserId", to: "id" },
  },
  rewardRedemption: {
    reward: { model: "reward", from: "rewardId", to: "id" },
  },
  machineUsage: {
    machine: { model: "machine", from: "machineId", to: "id" },
  },
  gymSession: {
    user: { model: "user", from: "userId", to: "id" },
    // Reverse (one-to-many) relation: all machine-usage rows for this session.
    machineUsages: { model: "machineUsage", from: "id", to: "gymSessionId", many: true },
  },
  userAchievement: {
    achievement: { model: "achievement", from: "achievementId", to: "id" },
  },
  pointReviewRequest: {
    user: { model: "user", from: "userId", to: "id" },
  },
};

function attachRelations(modelName, record, include) {
  if (!include || !record) return record;
  const relations = RELATIONS[modelName];
  if (!relations) return record;

  const enriched = { ...record };
  for (const relField of Object.keys(include)) {
    const rel = relations[relField];
    if (!rel) continue;
    const targetStore = this.stores[rel.model];
    if (!targetStore) continue;
    const fromValue = record[rel.from];

    if (rel.many) {
      enriched[relField] = targetStore.records
        .filter((r) => r[rel.to] === fromValue)
        .map((r) => {
          // Support nested include, e.g. machineUsages: { include: { machine: true } }
          const nestedInclude = include[relField]?.include;
          return nestedInclude
            ? attachRelations.call(this, rel.model, r, nestedInclude)
            : { ...r };
        });
    } else {
      const found = targetStore.records.find((r) => r[rel.to] === fromValue) ?? null;
      const nestedInclude = include[relField]?.include;
      enriched[relField] =
        found && nestedInclude ? attachRelations.call(this, rel.model, found, nestedInclude) : found;
    }
  }
  return enriched;
}

class ModelStore {
  constructor(name, ctx, options) {
    this.name = name;
    this.records = [];
    this.ctx = ctx;
    this.options = options;
  }

  _clone(record) {
    return record ? { ...record } : record;
  }

  _withInclude(record, args) {
    if (!record) return record;
    const withRel = attachRelations.call(this.ctx, this.name, record, args?.include);
    return this._clone(withRel);
  }

  async findUnique(args = {}) {
    const found = this.records.find((r) => matchesWhere(r, args.where));
    return this._withInclude(found ?? null, args);
  }

  async findFirst(args = {}) {
    // Special-case seeding: some suites need every user to appear to have
    // an open gym session (so social-challenge creation, which requires
    // both participants to be checked in, works without an explicit
    // check-in call in the test).
    if (
      this.name === "gymSession" &&
      this.options.autoOpenGymSessions &&
      args.where &&
      "userId" in args.where &&
      args.where.checkOutAt === null
    ) {
      const existing = this.records.find((r) => matchesWhere(r, args.where));
      if (existing) return this._withInclude(existing, args);

      const session = {
        id: crypto.randomUUID(),
        userId: args.where.userId,
        checkInAt: new Date(),
        checkOutAt: null,
        durationMinutes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.records.push(session);
      return this._withInclude(session, args);
    }

    let matches = this.records.filter((r) => matchesWhere(r, args.where));
    matches = applyOrderBy(matches, args.orderBy);
    return this._withInclude(matches[0] ?? null, args);
  }

  async findMany(args = {}) {
    let matches = this.records.filter((r) => matchesWhere(r, args.where));
    matches = applyOrderBy(matches, args.orderBy);
    if (args.distinct) {
      const seen = new Set();
      matches = matches.filter((r) => {
        const key = args.distinct.map((f) => r[f]).join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (typeof args.skip === "number") matches = matches.slice(args.skip);
    if (typeof args.take === "number") matches = matches.slice(0, args.take);
    return matches.map((r) => this._withInclude(r, args));
  }

  async create(args = {}) {
    const now = new Date();
    let data = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...args.data };

    if (this.name === "user" && this.options.roleFromName) {
      const name = `${data.firstName ?? ""}`.toLowerCase();
      if (name.includes("admin")) data.role = "ADMIN";
      else if (name.includes("trainer")) data.role = "TRAINER";
    }

    if (this.name === "user") {
      data.isActive = data.isActive ?? true;
    }

    if (this.name === "gymSession") {
      data.checkOutAt = data.checkOutAt ?? null;
      data.durationMinutes = data.durationMinutes ?? null;
    }

    if (this.name === "reward" || this.name === "machine") {
      data.active = data.active ?? true;
    }

    this.records.push(data);
    return this._withInclude(data, args);
  }

  async update(args = {}) {
    const idx = this.records.findIndex((r) => matchesWhere(r, args.where));
    if (idx === -1) {
      const err = new Error(`Record to update not found for model ${this.name}.`);
      err.code = "P2025";
      throw err;
    }
    this.records[idx] = { ...this.records[idx], ...args.data, updatedAt: new Date() };
    return this._withInclude(this.records[idx], args);
  }

  async updateMany(args = {}) {
    let count = 0;
    this.records = this.records.map((r) => {
      if (!matchesWhere(r, args.where)) return r;
      count += 1;
      return { ...r, ...args.data, updatedAt: new Date() };
    });
    return { count };
  }

  async upsert(args = {}) {
    const idx = this.records.findIndex((r) => matchesWhere(r, args.where));
    if (idx === -1) {
      return this.create({ data: args.create });
    }
    this.records[idx] = { ...this.records[idx], ...args.update, updatedAt: new Date() };
    return this._withInclude(this.records[idx], args);
  }

  async delete(args = {}) {
    const idx = this.records.findIndex((r) => matchesWhere(r, args.where));
    if (idx === -1) {
      const err = new Error(`Record to delete not found for model ${this.name}.`);
      err.code = "P2025";
      throw err;
    }
    const [removed] = this.records.splice(idx, 1);
    return removed;
  }

  async count(args = {}) {
    return this.records.filter((r) => matchesWhere(r, args.where)).length;
  }

  async aggregate(args = {}) {
    const matches = this.records.filter((r) => matchesWhere(r, args.where));
    const result = {};
    if (args._sum) {
      result._sum = {};
      for (const field of Object.keys(args._sum)) {
        result._sum[field] = matches.reduce((acc, r) => acc + (r[field] ?? 0), 0) || null;
      }
    }
    if (args._avg) {
      result._avg = {};
      for (const field of Object.keys(args._avg)) {
        const vals = matches.map((r) => r[field]).filter((v) => v !== undefined && v !== null);
        result._avg[field] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
    }
    if (args._count) {
      result._count = {};
      for (const field of Object.keys(args._count)) {
        result._count[field] = matches.filter((r) => r[field] !== undefined && r[field] !== null).length;
      }
    }
    return result;
  }

  async groupBy(args = {}) {
    const matches = this.records.filter((r) => matchesWhere(r, args.where));
    const groups = new Map();
    for (const record of matches) {
      const key = args.by.map((f) => record[f]).join("||");
      if (!groups.has(key)) {
        const groupBase = {};
        args.by.forEach((f) => (groupBase[f] = record[f]));
        groups.set(key, { base: groupBase, records: [] });
      }
      groups.get(key).records.push(record);
    }

    let entries = Array.from(groups.values()).map(({ base, records }) => {
      const entry = { ...base };
      if (args._count) {
        entry._count = {};
        for (const field of Object.keys(args._count)) {
          entry._count[field] = records.length;
        }
      }
      if (args._sum) {
        entry._sum = {};
        for (const field of Object.keys(args._sum)) {
          entry._sum[field] = records.reduce((acc, r) => acc + (r[field] ?? 0), 0);
        }
      }
      if (args._avg) {
        entry._avg = {};
        for (const field of Object.keys(args._avg)) {
          const vals = records.map((r) => r[field]).filter((v) => v !== undefined && v !== null);
          entry._avg[field] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        }
      }
      return entry;
    });

    if (args.having) {
      entries = entries.filter((entry) =>
        Object.entries(args.having).every(([field, aggConditions]) =>
          Object.entries(aggConditions).every(([aggFn, condition]) =>
            matchesValue(entry[aggFn]?.[field], condition)
          )
        )
      );
    }

    return entries;
  }
}

export function createE2EPrismaMock(options = {}) {
  const ctx = { stores: {} };

  const prismaMock = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "$transaction") {
          return vi.fn((arg) => {
            if (typeof arg === "function") return arg(prismaMock);
            return Promise.all(arg);
          });
        }
        if (prop === "$connect" || prop === "$disconnect") {
          return vi.fn().mockResolvedValue(undefined);
        }
        if (typeof prop !== "string") return undefined;

        if (!ctx.stores[prop]) ctx.stores[prop] = new ModelStore(prop, ctx, options);
        return ctx.stores[prop];
      },
    }
  );

  return prismaMock;
}

export function createE2ERedisMock() {
  const store = new Map();

  return {
    get: vi.fn(async (key) => store.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      store.set(key, value);
      return "OK";
    }),
    setex: vi.fn(async (key, _ttl, value) => {
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key) => {
      store.delete(key);
      return 1;
    }),
    expire: vi.fn(async () => 1),
  };
}
