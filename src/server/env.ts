import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  JWT_EXPIRY_MINUTES: z.coerce.number().int().positive().default(60),
  PASSWORD_HASHING_ITERATIONS: z.coerce
    .number()
    .int()
    .positive()
    .default(100_000),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.2"),
  STORAGE_PROVIDER: z.string().default("local"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  PRIVATE_BLOB_READ_WRITE_TOKEN: z.string().optional(),
  PUBLIC_BLOB_READ_WRITE_TOKEN: z.string().optional(),
  HIKVISION_WEBHOOK_SECRET: z.string().optional(),
  HIKVISION_GATEWAY_BASE_URL: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);

export function requiredDatabaseUrl() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return env.DATABASE_URL;
}
