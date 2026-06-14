import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

const saltByteLength = 32;
const hashByteLength = 32;
const digest = "sha256";

export type HashedSecret = {
  hash: string;
  salt: string;
};

export function hashSecret(secret: string): HashedSecret {
  const salt = randomBytes(saltByteLength);
  const hash = pbkdf2Sync(
    secret,
    salt,
    env.PASSWORD_HASHING_ITERATIONS,
    hashByteLength,
    digest,
  );

  return {
    hash: hash.toString("base64"),
    salt: salt.toString("base64"),
  };
}

export function verifySecret(
  secret: string,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined,
) {
  if (!storedHash || !storedSalt) {
    return false;
  }

  try {
    const salt = Buffer.from(storedSalt, "base64");
    const expectedHash = Buffer.from(storedHash, "base64");
    const actualHash = pbkdf2Sync(
      secret,
      salt,
      env.PASSWORD_HASHING_ITERATIONS,
      expectedHash.length,
      digest,
    );

    return (
      actualHash.length === expectedHash.length &&
      timingSafeEqual(actualHash, expectedHash)
    );
  } catch {
    return false;
  }
}
