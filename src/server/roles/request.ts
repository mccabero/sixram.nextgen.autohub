import {
  readJsonRecord,
  readStringField,
  type JsonRecord,
} from "@/server/api/body";
import type { RoleMutationInput } from "@/server/roles/service";

export async function readRoleMutationInput(
  request: Request,
  actorUserId: number,
): Promise<RoleMutationInput | null> {
  const body = await readJsonRecord(request);
  const name = readStringField(body, "name", "Name")?.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    description: readStringField(body, "description", "Description") ?? null,
    actorUserId,
    createdById: readIntegerField(body, "createdById", "CreatedById"),
    updatedById: readIntegerField(body, "updatedById", "UpdatedById"),
  };
}

function readIntegerField(body: JsonRecord | null, ...keys: string[]) {
  if (!body) {
    return null;
  }

  for (const key of keys) {
    const value = body[key];
    const numberValue =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;

    if (Number.isInteger(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }

  return null;
}
