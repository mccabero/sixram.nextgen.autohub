import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env, requiredDatabaseUrl } from "@/server/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let prismaClient = globalForPrisma.prisma;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: requiredDatabaseUrl(),
  });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

function getPrismaClient() {
  if (!prismaClient) {
    prismaClient = createPrismaClient();

    if (env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaClient;
    }
  }

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = client[property as keyof PrismaClient];

    return typeof value === "function" ? value.bind(client) : value;
  },
});
