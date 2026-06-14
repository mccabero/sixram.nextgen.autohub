import type { JsonRecord } from "@/server/api/body";

export function readString(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    if (value === null) return null;
    if (typeof value === "string") return value;
  }

  return null;
}

export function readInteger(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    const numberValue =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;

    if (Number.isInteger(numberValue)) return numberValue;
  }

  return null;
}

export function readDecimal(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return 0;

  for (const key of keys) {
    const value = body[key];
    const numberValue =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;

    if (Number.isFinite(numberValue)) return numberValue;
  }

  return 0;
}

export function readBoolean(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
  }

  return null;
}

export function readDate(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    if (value === null || value === "") return null;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.valueOf())) return date;
    }
  }

  return null;
}

export function setIfProvided<T>(
  data: Record<string, unknown>,
  field: string,
  body: JsonRecord,
  reader: (body: JsonRecord, ...keys: string[]) => T,
  ...keys: string[]
) {
  if (hasField(body, ...keys)) {
    const value = reader(body, ...keys);
    if (value !== null) data[field] = value;
  }
}

export function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

export function numberFromDecimal(value: { toString: () => string } | number | null) {
  if (value === null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

