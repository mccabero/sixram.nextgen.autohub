import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";

type CustomerErrorBody =
  | string
  | {
      [key: string]: string | number | boolean | null;
    };
type DecimalValue =
  | number
  | string
  | {
      toJSON?: () => unknown;
      toString?: () => string;
    };

type CustomerRow = {
  Id: number;
  IsChangan: boolean;
  FirstName: string;
  MiddleName: string | null;
  LastName: string;
  Gender: number;
  Birthday: Date | null;
  CustomerCode: string | null;
  MobileNumber: string;
  Email: string | null;
  HomeAddress: string | null;
  Notes: string | null;
  CompanyName: string | null;
  CompanyAddress: string | null;
  CompanyNo: string | null;
  IsActive: boolean;
  LaborDiscountRate: DecimalValue;
  ProductDiscountRate: DecimalValue;
  IsVATExempt: boolean;
  IsAllowWithholidingTax: boolean;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
};

export const customerSelect = {
  Id: true,
  IsChangan: true,
  FirstName: true,
  MiddleName: true,
  LastName: true,
  Gender: true,
  Birthday: true,
  CustomerCode: true,
  MobileNumber: true,
  Email: true,
  HomeAddress: true,
  Notes: true,
  CompanyName: true,
  CompanyAddress: true,
  CompanyNo: true,
  IsActive: true,
  LaborDiscountRate: true,
  ProductDiscountRate: true,
  IsVATExempt: true,
  IsAllowWithholidingTax: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

export class CustomerServiceError extends Error {
  readonly status: number;
  readonly body: CustomerErrorBody;

  constructor(
    message: string,
    status = 400,
    body: CustomerErrorBody = { error: message },
  ) {
    super(message);
    this.name = "CustomerServiceError";
    this.status = status;
    this.body = body;
  }
}

export async function listCustomers() {
  const rows = await prisma.customer.findMany({
    orderBy: { Id: "asc" },
    select: customerSelect,
  });

  return rows.map(mapCustomer);
}

export async function listCustomerSummary() {
  const rows = await prisma.customer.findMany({
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsChangan: true,
      FirstName: true,
      LastName: true,
      HomeAddress: true,
      MobileNumber: true,
      CreatedDateTime: true,
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    firstName: row.FirstName,
    lastName: row.LastName,
    homeAddress: row.HomeAddress,
    mobileNumber: row.MobileNumber,
    createdDate: row.CreatedDateTime,
  }));
}

export async function getCustomer(id: number) {
  const row = await prisma.customer.findUnique({
    where: { Id: id },
    select: customerSelect,
  });

  return row ? mapCustomer(row) : null;
}

export async function getCustomerByEmail(email: string) {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return null;
  }

  const row = await prisma.customer.findFirst({
    where: {
      Email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    orderBy: { Id: "asc" },
    select: customerSelect,
  });

  return row ? mapCustomer(row) : null;
}

export async function createCustomer(body: JsonRecord, actorUserId: number) {
  try {
    const row = await prisma.customer.create({
      data: {
        IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
        FirstName: readString(body, "firstName", "FirstName", "name") ?? "",
        MiddleName: readString(body, "middleName", "MiddleName"),
        LastName: readString(body, "lastName", "LastName", "name") ?? "",
        Gender: readInteger(body, "gender", "Gender") ?? 0,
        Birthday: readDate(body, "birthday", "Birthday"),
        CustomerCode: readString(body, "customerCode", "CustomerCode"),
        MobileNumber:
          readString(body, "mobileNumber", "MobileNumber", "mobile", "phone") ??
          "",
        Email: readString(body, "email", "Email"),
        HomeAddress:
          readString(body, "homeAddress", "HomeAddress", "address") ?? null,
        Notes: readString(body, "notes", "Notes"),
        CompanyName: readString(body, "companyName", "CompanyName"),
        CompanyAddress: readString(body, "companyAddress", "CompanyAddress"),
        CompanyNo: readString(body, "companyNo", "CompanyNo"),
        IsActive: readBoolean(body, "isActive", "IsActive") ?? false,
        LaborDiscountRate:
          readDecimal(body, "laborDiscountRate", "LaborDiscountRate") ?? 0,
        ProductDiscountRate:
          readDecimal(body, "productDiscountRate", "ProductDiscountRate") ?? 0,
        IsVATExempt:
          readBoolean(body, "isVATExempt", "IsVATExempt") ?? false,
        IsAllowWithholidingTax:
          readBoolean(
            body,
            "isAllowWithholidingTax",
            "isAllowWithholdingTax",
            "IsAllowWithholidingTax",
            "IsAllowWithholdingTax",
          ) ?? false,
        ...createAudit(body, actorUserId),
      },
      select: customerSelect,
    });

    return mapCustomer(row);
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function updateCustomer(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const data: Record<string, unknown> = {
    UpdatedById: readPositiveInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };

  setIfPresent(data, "IsChangan", body, readBoolean, "isChangan", "IsChangan");
  setIfPresent(data, "FirstName", body, readStringOrEmpty, "firstName", "FirstName");
  setIfPresent(data, "MiddleName", body, readString, "middleName", "MiddleName");
  setIfPresent(data, "LastName", body, readStringOrEmpty, "lastName", "LastName");
  setIfPresent(data, "Gender", body, readIntegerOrZero, "gender", "Gender");
  setIfPresent(data, "Birthday", body, readDate, "birthday", "Birthday");
  setIfPresent(data, "CustomerCode", body, readString, "customerCode", "CustomerCode");
  setIfPresent(
    data,
    "MobileNumber",
    body,
    readStringOrEmpty,
    "mobileNumber",
    "MobileNumber",
    "mobile",
    "phone",
  );
  setIfPresent(data, "Email", body, readString, "email", "Email");
  setIfPresent(
    data,
    "HomeAddress",
    body,
    readString,
    "homeAddress",
    "HomeAddress",
    "address",
  );
  setIfPresent(data, "Notes", body, readString, "notes", "Notes");
  setIfPresent(data, "CompanyName", body, readString, "companyName", "CompanyName");
  setIfPresent(
    data,
    "CompanyAddress",
    body,
    readString,
    "companyAddress",
    "CompanyAddress",
  );
  setIfPresent(data, "CompanyNo", body, readString, "companyNo", "CompanyNo");
  setIfPresent(data, "IsActive", body, readBoolean, "isActive", "IsActive");
  setIfPresent(
    data,
    "LaborDiscountRate",
    body,
    readDecimalOrZero,
    "laborDiscountRate",
    "LaborDiscountRate",
  );
  setIfPresent(
    data,
    "ProductDiscountRate",
    body,
    readDecimalOrZero,
    "productDiscountRate",
    "ProductDiscountRate",
  );
  setIfPresent(data, "IsVATExempt", body, readBoolean, "isVATExempt", "IsVATExempt");
  setIfPresent(
    data,
    "IsAllowWithholidingTax",
    body,
    readBoolean,
    "isAllowWithholidingTax",
    "isAllowWithholdingTax",
    "IsAllowWithholidingTax",
    "IsAllowWithholdingTax",
  );

  try {
    await prisma.customer.update({
      where: { Id: id },
      data,
    });
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function deleteCustomer(id: number) {
  try {
    await prisma.customer.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export function mapCustomer(row: CustomerRow) {
  return {
    id: row.Id,
    isChangan: row.IsChangan,
    firstName: row.FirstName,
    middleName: row.MiddleName,
    lastName: row.LastName,
    gender: row.Gender,
    birthday: row.Birthday,
    customerCode: row.CustomerCode,
    mobileNumber: row.MobileNumber,
    email: row.Email,
    homeAddress: row.HomeAddress,
    notes: row.Notes,
    companyName: row.CompanyName,
    companyAddress: row.CompanyAddress,
    companyNo: row.CompanyNo,
    isActive: row.IsActive,
    laborDiscountRate: row.LaborDiscountRate,
    productDiscountRate: row.ProductDiscountRate,
    isVATExempt: row.IsVATExempt,
    isAllowWithholidingTax: row.IsAllowWithholidingTax,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function createAudit(body: JsonRecord, actorUserId: number) {
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const now = new Date();

  return {
    CreatedById: createdById,
    CreatedDateTime: now,
    UpdatedById: updatedById,
    UpdatedDateTime: now,
  };
}

function setIfPresent(
  data: Record<string, unknown>,
  targetKey: string,
  body: JsonRecord,
  reader: (body: JsonRecord, ...keys: string[]) => unknown,
  ...keys: string[]
) {
  if (hasField(body, ...keys)) {
    data[targetKey] = reader(body, ...keys);
  }
}

function readString(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
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

    if (Number.isInteger(numberValue) && numberValue >= 0) {
      return numberValue;
    }
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

function readDecimal(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const numberValue = Number(value);

      if (Number.isFinite(numberValue)) {
        return value.trim();
      }
    }
  }

  return null;
}

function readDecimalOrZero(body: JsonRecord, ...keys: string[]) {
  return readDecimal(body, ...keys) ?? 0;
}

function readBoolean(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

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

    if (value === null || value === "") {
      return null;
    }

    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);

      if (!Number.isNaN(date.valueOf())) {
        return date;
      }
    }
  }

  return null;
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

function normalizePrismaError(error: unknown): CustomerServiceError {
  if (error instanceof CustomerServiceError) {
    return error;
  }

  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new CustomerServiceError("Record not found.", 404, {});
    }

    if (error.code === "P2003") {
      return new CustomerServiceError(
        "Cannot delete this customer because it is already used by other records.",
        409,
        "Cannot delete this customer because it is already used by other records.",
      );
    }
  }

  return new CustomerServiceError("An unexpected error occurred.", 500);
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
