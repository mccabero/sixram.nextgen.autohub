export type JsonRecord = Record<string, unknown>;

export async function readJsonRecord(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body as JsonRecord;
  } catch {
    return null;
  }
}

export function readStringField(body: JsonRecord | null, ...keys: string[]) {
  if (!body) {
    return null;
  }

  for (const key of keys) {
    const value = body[key];

    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}
