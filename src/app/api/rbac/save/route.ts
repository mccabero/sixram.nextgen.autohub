import { NextResponse } from "next/server";
import { readJsonRecord, type JsonRecord } from "@/server/api/body";
import { badRequest, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  RbacSaveError,
  saveRbacConfig,
  type RbacRolePermissionInput,
} from "@/server/rbac/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  const input = parseSaveInput(body);

  if (!input) {
    return badRequest("Request is invalid.");
  }

  try {
    return legacyJson(await saveRbacConfig(authorization.user.userId, input));
  } catch (error) {
    if (error instanceof RbacSaveError) {
      return NextResponse.json(
        { error: error.message, ...(error.details ?? {}) },
        { status: error.status },
      );
    }

    return serverError();
  }
}

function parseSaveInput(body: JsonRecord) {
  const userId = readInteger(body, "userId", "UserId");
  const primaryRoleId = readInteger(body, "primaryRoleId", "PrimaryRoleId");

  if (!userId || !primaryRoleId) {
    return null;
  }

  return {
    userId,
    primaryRoleId,
    assignedRoleIds: readIntegerArray(
      body,
      "assignedRoleIds",
      "AssignedRoleIds",
    ),
    rolePermissions: readRolePermissions(body),
  };
}

function readRolePermissions(body: JsonRecord): RbacRolePermissionInput[] {
  const value = body.rolePermissions ?? body.RolePermissions;

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as JsonRecord;
      const roleId = readInteger(record, "roleId", "RoleId");
      const permissionId = readInteger(record, "permissionId", "PermissionId");

      if (!roleId || !permissionId) {
        return null;
      }

      return {
        roleId,
        permissionId,
        allowed: readBoolean(record, "allowed", "Allowed"),
      };
    })
    .filter((item): item is RbacRolePermissionInput => !!item);
}

function readIntegerArray(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (!Array.isArray(value)) {
      continue;
    }

    return [
      ...new Set(
        value
          .map(toInteger)
          .filter((item): item is number => !!item && item > 0),
      ),
    ];
  }

  return [];
}

function readInteger(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = toInteger(body[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function toInteger(value: unknown) {
  const numberValue =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : Number.NaN;

  return Number.isInteger(numberValue) ? numberValue : null;
}

function readBoolean(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
  }

  return false;
}
