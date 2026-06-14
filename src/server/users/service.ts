import type { JsonRecord } from "@/server/api/body";
import { hashSecret, verifySecret } from "@/server/auth/password-hasher";
import { prisma } from "@/server/db/prisma";

const defaultPin = "111111";
const sixDigitPattern = /^\d{6}$/;
const sqlDateTimeMinValue = new Date(Date.UTC(1753, 0, 1));

type UserErrorBody =
  | string
  | {
      [key: string]: string | number | boolean | null;
    };

export class UserServiceError extends Error {
  readonly status: number;
  readonly body: UserErrorBody;

  constructor(
    message: string,
    status = 400,
    body: UserErrorBody = { error: message },
  ) {
    super(message);
    this.name = "UserServiceError";
    this.status = status;
    this.body = body;
  }
}

const userSelect = {
  Id: true,
  Email: true,
  RoleId: true,
  Gender: true,
  Firstname: true,
  MiddleName: true,
  LastName: true,
  MobileNumber: true,
  Birthday: true,
  Address: true,
  IsActive: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
  Role: {
    select: {
      Id: true,
      Name: true,
      Description: true,
    },
  },
  UserRolesAsUser: {
    orderBy: { RoleId: "asc" },
    select: {
      RoleId: true,
      Role: {
        select: {
          Id: true,
          Name: true,
          Description: true,
        },
      },
    },
  },
} as const;

export async function listUsers() {
  const rows = await prisma.user.findMany({
    orderBy: { Id: "asc" },
    select: userSelect,
  });

  return rows.map(mapUser);
}

export async function getUser(id: number) {
  const row = await prisma.user.findUnique({
    where: { Id: id },
    select: userSelect,
  });

  return row ? mapUser(row) : null;
}

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return null;

  const row = await prisma.user.findFirst({
    where: {
      Email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    orderBy: { Id: "asc" },
    select: userSelect,
  });

  return row ? mapUser(row) : null;
}

export async function createUser(body: JsonRecord, actorUserId: number) {
  const email = requiredString(body, "Email is required", "email", "Email");
  const password = requiredString(
    body,
    "Password is required",
    "password",
    "Password",
  );
  const roleId = requiredPositiveInteger(body, "RoleId is required", "roleId", "RoleId");
  await assertRoleExists(roleId);

  const normalizedPin = normalizePinOrDefault(readString(body, "pin", "Pin"));
  await ensurePinAvailable(normalizedPin);

  const passwordHash = hashSecret(password);
  const pinHash = hashSecret(normalizedPin);
  const now = new Date();
  const actorId = actorUserId > 0 ? actorUserId : 0;

  try {
    const row = await prisma.user.create({
      data: {
        Email: email,
        PasswordHash: passwordHash.hash,
        Salt: passwordHash.salt,
        PinHash: pinHash.hash,
        PinSalt: pinHash.salt,
        RoleId: roleId,
        Gender: readInteger(body, "gender", "Gender") ?? 0,
        Firstname: requiredString(
          body,
          "Firstname is required",
          "firstname",
          "Firstname",
          "firstName",
          "FirstName",
        ),
        MiddleName: readString(body, "middleName", "MiddleName"),
        LastName: requiredString(
          body,
          "LastName is required",
          "lastName",
          "LastName",
          "lastname",
          "Lastname",
        ),
        MobileNumber: readString(body, "mobileNumber", "MobileNumber"),
        Birthday: normalizeBirthday(readDate(body, "birthday", "Birthday")),
        Address: readString(body, "address", "Address"),
        IsActive: readBoolean(body, "isActive", "IsActive") ?? true,
        CreatedById: readPositiveInteger(body, "createdById", "CreatedById") ?? actorId,
        CreatedDateTime: now,
        UpdatedById: readPositiveInteger(body, "updatedById", "UpdatedById") ?? actorId,
        UpdatedDateTime: now,
      },
      select: userSelect,
    });

    return mapUser(row);
  } catch (error) {
    throw normalizePrismaError(error, "user");
  }
}

export async function updateUser(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.user.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return false;

  const data: Record<string, unknown> = {
    UpdatedById:
      readPositiveInteger(body, "updatedById", "UpdatedById") ??
      (actorUserId > 0 ? actorUserId : 0),
    UpdatedDateTime: readDate(body, "updatedDateTime", "UpdatedDateTime") ?? new Date(),
  };

  setIfPresent(data, "Email", body, readStringOrEmpty, "email", "Email");
  if (hasField(body, "roleId", "RoleId")) {
    const roleId = requiredPositiveInteger(
      body,
      "RoleId is required",
      "roleId",
      "RoleId",
    );
    await assertRoleExists(roleId);
    data.RoleId = roleId;
  }
  setIfPresent(data, "Gender", body, readIntegerOrZero, "gender", "Gender");
  setIfPresent(
    data,
    "Firstname",
    body,
    readStringOrEmpty,
    "firstname",
    "Firstname",
    "firstName",
    "FirstName",
  );
  setIfPresent(data, "MiddleName", body, readString, "middleName", "MiddleName");
  setIfPresent(
    data,
    "LastName",
    body,
    readStringOrEmpty,
    "lastName",
    "LastName",
    "lastname",
    "Lastname",
  );
  setIfPresent(data, "MobileNumber", body, readString, "mobileNumber", "MobileNumber");
  if (hasField(body, "birthday", "Birthday")) {
    data.Birthday = normalizeBirthday(readDate(body, "birthday", "Birthday"));
  }
  setIfPresent(data, "Address", body, readString, "address", "Address");
  setIfPresent(data, "IsActive", body, readBoolean, "isActive", "IsActive");

  const password = readString(body, "password", "Password");
  if (password) {
    const hashed = hashSecret(password);
    data.PasswordHash = hashed.hash;
    data.Salt = hashed.salt;
  }

  const pin = readString(body, "pin", "Pin");
  if (pin) {
    const normalizedPin = normalizePin(pin);
    await ensurePinAvailable(normalizedPin, id);
    const hashed = hashSecret(normalizedPin);
    data.PinHash = hashed.hash;
    data.PinSalt = hashed.salt;
  }

  const roleIds = hasField(body, "roles", "Roles")
    ? readIntegerArray(body, "roles", "Roles")
        .filter((roleId) => roleId > 0)
        .filter((roleId, index, values) => values.indexOf(roleId) === index)
    : null;

  if (roleIds) {
    await assertRolesExist(roleIds);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { Id: id },
        data,
      });

      if (roleIds) {
        const now = new Date();
        const actorId =
          readPositiveInteger(body, "updatedById", "UpdatedById") ??
          (actorUserId > 0 ? actorUserId : 0);

        await tx.userRole.deleteMany({ where: { UserId: id } });

        if (roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({
              UserId: id,
              RoleId: roleId,
              CreatedById: actorId,
              CreatedDateTime: now,
              UpdatedById: actorId,
              UpdatedDateTime: now,
            })),
          });
        }
      }
    });
  } catch (error) {
    throw normalizePrismaError(error, "user");
  }

  return true;
}

export async function deleteUser(id: number) {
  try {
    await prisma.user.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error, "user");
  }
}

export async function changePasswordByEmail(body: JsonRecord) {
  const email = requiredString(body, "Email is required", "email", "Email");
  const newPassword = requiredString(
    body,
    "NewPassword is required",
    "newPassword",
    "NewPassword",
    "password",
    "Password",
  );

  const user = await prisma.user.findFirst({
    where: {
      Email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { Id: true },
  });

  if (!user) return false;

  const hashed = hashSecret(newPassword);
  await prisma.user.update({
    where: { Id: user.Id },
    data: {
      PasswordHash: hashed.hash,
      Salt: hashed.salt,
      UpdatedDateTime: new Date(),
    },
  });

  return true;
}

export async function isPinAvailable(pin: string, excludeUserId?: number | null) {
  const normalizedPin = normalizePin(pin);
  const users = await prisma.user.findMany({
    where:
      excludeUserId && excludeUserId > 0
        ? { Id: { not: excludeUserId } }
        : undefined,
    select: {
      PinHash: true,
      PinSalt: true,
    },
  });

  return !users.some((user) =>
    verifySecret(normalizedPin, user.PinHash, user.PinSalt),
  );
}

async function ensurePinAvailable(pin: string, excludeUserId?: number | null) {
  if (!(await isPinAvailable(pin, excludeUserId))) {
    throw new UserServiceError(
      "PIN is not available. Please choose another 6-digit PIN.",
    );
  }
}

function mapUser(row: {
  Id: number;
  Email: string;
  RoleId: number;
  Gender: number;
  Firstname: string;
  MiddleName: string | null;
  LastName: string;
  MobileNumber: string | null;
  Birthday: Date;
  Address: string | null;
  IsActive: boolean;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
  Role: {
    Id: number;
    Name: string;
    Description: string | null;
  };
  UserRolesAsUser: {
    RoleId: number;
    Role: {
      Id: number;
      Name: string;
      Description: string | null;
    };
  }[];
}) {
  const role = mapRoleSummary(row.Role);

  return {
    id: row.Id,
    email: row.Email,
    roleId: row.RoleId,
    gender: row.Gender,
    firstname: row.Firstname,
    middleName: row.MiddleName,
    lastName: row.LastName,
    mobileNumber: row.MobileNumber,
    birthday: row.Birthday,
    address: row.Address,
    isActive: row.IsActive,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
    roleName: role.name,
    roleDescription: role.description,
    role,
    roles: row.UserRolesAsUser.map((userRole) => mapRoleSummary(userRole.Role)),
  };
}

function mapRoleSummary(row: {
  Id: number;
  Name: string;
  Description: string | null;
}) {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
  };
}

async function assertRoleExists(roleId: number) {
  const role = await prisma.role.findUnique({
    where: { Id: roleId },
    select: { Id: true },
  });

  if (!role) {
    throw new UserServiceError("RoleId does not exist");
  }
}

async function assertRolesExist(roleIds: number[]) {
  if (roleIds.length === 0) return;

  const roles = await prisma.role.findMany({
    where: { Id: { in: roleIds } },
    select: { Id: true },
  });
  const foundIds = new Set(roles.map((role) => role.Id));
  const missing = roleIds.filter((roleId) => !foundIds.has(roleId));

  if (missing.length > 0) {
    throw new UserServiceError(`Some RoleIds do not exist: ${missing.join(",")}`);
  }
}

function normalizePinOrDefault(value: string | null) {
  return value?.trim() ? normalizePin(value) : defaultPin;
}

function normalizePin(value: string) {
  const pin = value.trim();
  if (!sixDigitPattern.test(pin)) {
    throw new UserServiceError("PIN must be exactly 6 numbers.");
  }
  return pin;
}

function normalizeBirthday(value: Date | null) {
  if (!value || value < sqlDateTimeMinValue) return sqlDateTimeMinValue;
  return value;
}

function requiredString(body: JsonRecord, message: string, ...keys: string[]) {
  const value = readString(body, ...keys)?.trim();
  if (!value) throw new UserServiceError(message);
  return value;
}

function requiredPositiveInteger(
  body: JsonRecord,
  message: string,
  ...keys: string[]
) {
  const value = readPositiveInteger(body, ...keys);
  if (!value) throw new UserServiceError(message);
  return value;
}

function readString(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (value === null) return null;
    if (typeof value === "string") return value;
  }
  return null;
}

function readStringOrEmpty(body: JsonRecord, ...keys: string[]) {
  return readString(body, ...keys) ?? "";
}

function readInteger(body: JsonRecord, ...keys: string[]) {
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

function readIntegerOrZero(body: JsonRecord, ...keys: string[]) {
  return readInteger(body, ...keys) ?? 0;
}

function readPositiveInteger(body: JsonRecord, ...keys: string[]) {
  const value = readInteger(body, ...keys);
  return value && value > 0 ? value : null;
}

function readBoolean(body: JsonRecord, ...keys: string[]) {
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

function readDate(body: JsonRecord, ...keys: string[]) {
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

function readIntegerArray(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "number" || typeof item === "string"
            ? Number(item)
            : Number.NaN,
        )
        .filter((item) => Number.isInteger(item));
    }
  }
  return [];
}

function setIfPresent<T>(
  data: Record<string, unknown>,
  field: string,
  body: JsonRecord,
  reader: (body: JsonRecord, ...keys: string[]) => T,
  ...keys: string[]
) {
  if (hasField(body, ...keys)) {
    data[field] = reader(body, ...keys);
  }
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

function normalizePrismaError(error: unknown, entityName: string) {
  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new UserServiceError(`${entityName} not found`, 404);
    }

    if (error.code === "P2003") {
      return new UserServiceError(
        `Cannot delete this ${entityName} because it is linked to other records.`,
        409,
      );
    }
  }

  return error;
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  );
}
