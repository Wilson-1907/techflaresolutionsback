import { ensureDatabaseUrl } from "./database-url";
import { PrismaClient } from "@prisma/client";
import { decryptReadData, encryptWriteData } from "./field-encryption";

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrismaClient> };

const READ_OPS = new Set([
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "update",
  "upsert",
  "delete",
  "aggregate",
]);

function createPrismaClient() {
  ensureDatabaseUrl();
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const writeOps = ["create", "createMany", "update", "updateMany", "upsert"];
          if (writeOps.includes(operation) && args) {
            const a = args as Record<string, unknown>;
            if (a.data) a.data = encryptWriteData(model, a.data);
            if (a.create) a.create = encryptWriteData(model, a.create);
            if (a.update) a.update = encryptWriteData(model, a.update);
          }

          const result = await query(args);

          if (READ_OPS.has(operation) && result) {
            return decryptReadData(model, result);
          }
          return result;
        },
      },
    },
  });
}

type PrismaClientType = ReturnType<typeof createPrismaClient>;

function getPrismaClient(): PrismaClientType {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClientType];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type ExtendedPrisma = typeof prisma;
