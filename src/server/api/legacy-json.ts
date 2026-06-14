import { NextResponse } from "next/server";

type Jsonish =
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  | { toJSON?: () => unknown; toString?: () => string }
  | Jsonish[]
  | { [key: string]: Jsonish | undefined };

function toLegacyValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toLegacyValue);
  }

  if (typeof value === "object") {
    if (
      "toJSON" in value &&
      typeof value.toJSON === "function" &&
      value.constructor?.name === "Decimal"
    ) {
      return value.toJSON();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        toLegacyValue(nestedValue),
      ]),
    );
  }

  return value;
}

export function legacyJson<T extends Jsonish>(data: T, init?: ResponseInit) {
  return NextResponse.json(toLegacyValue(data), init);
}
