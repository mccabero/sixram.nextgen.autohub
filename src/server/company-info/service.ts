import path from "node:path";
import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { findUploadedImageFile, getUploadsRoot } from "@/server/api/uploads";
import {
  findBlobImageByPrefix,
  getPublicBlobToken,
} from "@/server/storage/blob-images";

type CompanyInfoErrorBody =
  | string
  | {
      [key: string]: string | number | boolean | null;
    };

type CompanyInfoRow = {
  Id: number;
  Name: string;
  Address: string;
  Email: string;
  MobileNumber: string;
  TIN: string;
  GCash: string;
  BankNo: string;
  IsPrimaryCompany: boolean;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
};

const companyInfoSelect = {
  Id: true,
  Name: true,
  Address: true,
  Email: true,
  MobileNumber: true,
  TIN: true,
  GCash: true,
  BankNo: true,
  IsPrimaryCompany: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

export class CompanyInfoServiceError extends Error {
  readonly status: number;
  readonly body: CompanyInfoErrorBody;

  constructor(
    message: string,
    status = 400,
    body: CompanyInfoErrorBody = { error: message },
  ) {
    super(message);
    this.name = "CompanyInfoServiceError";
    this.status = status;
    this.body = body;
  }
}

async function buildCompanyLogoPath(companyId: number) {
  const token = getPublicBlobToken();

  if (token) {
    const blob = await findBlobImageByPrefix(
      `company-logo/${companyId}/company_logo`,
      token,
    );
    if (blob) return blob.url;
  }

  const directory = path.join(
    getUploadsRoot(),
    "company-logo",
    String(companyId),
  );
  const logo = findUploadedImageFile(directory, "company_logo");

  return logo ? `/api/companyinfo/${companyId}/logo` : null;
}

export async function mapCompanyInfo(item: CompanyInfoRow) {
  const logoPath = await buildCompanyLogoPath(item.Id);

  return {
    id: item.Id,
    companyId: item.Id,
    name: item.Name,
    companyName: item.Name,
    address: item.Address,
    email: item.Email,
    mobileNumber: item.MobileNumber,
    mobile: item.MobileNumber,
    tin: item.TIN,
    gCash: item.GCash,
    bankNo: item.BankNo,
    isPrimaryCompany: item.IsPrimaryCompany,
    primaryCompany: item.IsPrimaryCompany,
    createdById: item.CreatedById,
    createdDateTime: item.CreatedDateTime,
    updatedById: item.UpdatedById,
    updatedDateTime: item.UpdatedDateTime,
    logo: logoPath,
    logoPath,
    logoUrl: logoPath,
    Id: item.Id,
    CompanyId: item.Id,
    Name: item.Name,
    CompanyName: item.Name,
    Address: item.Address,
    Email: item.Email,
    MobileNumber: item.MobileNumber,
    Mobile: item.MobileNumber,
    TIN: item.TIN,
    GCash: item.GCash,
    BankNo: item.BankNo,
    IsPrimaryCompany: item.IsPrimaryCompany,
    PrimaryCompany: item.IsPrimaryCompany,
    CreatedById: item.CreatedById,
    CreatedDateTime: item.CreatedDateTime,
    UpdatedById: item.UpdatedById,
    UpdatedDateTime: item.UpdatedDateTime,
    Logo: logoPath,
    LogoPath: logoPath,
    LogoUrl: logoPath,
  };
}

export function getCompanyInfos() {
  return prisma.companyInfo.findMany({
    orderBy: [{ IsPrimaryCompany: "desc" }, { Id: "asc" }],
    select: companyInfoSelect,
  });
}

export function getCompanyInfoById(id: number) {
  return prisma.companyInfo.findUnique({
    where: { Id: id },
    select: companyInfoSelect,
  });
}

export async function createCompanyInfo(
  body: JsonRecord,
  actorUserId: number,
) {
  const name = readString(body, "name", "Name", "companyName", "CompanyName") ?? "";
  const address = readString(body, "address", "Address") ?? "";
  const email = readString(body, "email", "Email") ?? "";
  const mobileNumber =
    readString(body, "mobileNumber", "MobileNumber", "mobile", "Mobile") ?? "";
  const tin = readString(body, "tin", "TIN", "tinNumber", "TinNumber") ?? "";
  const gCash = readString(body, "gCash", "GCash", "gcash", "Gcash") ?? "";
  const bankNo =
    readString(body, "bankNo", "BankNo", "bankAccount", "BankAccount") ?? "";
  const isPrimaryCompany =
    readBoolean(body, "isPrimaryCompany", "IsPrimaryCompany", "primaryCompany") ??
    false;
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const now = new Date();

  try {
    const row = await prisma.$transaction(async (tx) => {
      if (isPrimaryCompany) {
        await tx.companyInfo.updateMany({
          data: { IsPrimaryCompany: false },
        });
      }

      return tx.companyInfo.create({
        data: {
          Name: name,
          Address: address,
          Email: email,
          MobileNumber: mobileNumber,
          TIN: tin,
          GCash: gCash,
          BankNo: bankNo,
          Name1: name,
          Address1: address,
          Email1: email,
          MobileNumber1: mobileNumber,
          TIN1: tin,
          GCash1: gCash,
          BankNo1: bankNo,
          IsPrimaryCompany: isPrimaryCompany,
          CreatedById: createdById,
          CreatedDateTime: now,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
        select: companyInfoSelect,
      });
    });

    return mapCompanyInfo(row);
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function updateCompanyInfo(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const data: Record<string, unknown> = {
    UpdatedById: readPositiveInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };

  setStringPairIfPresent(data, "Name", "Name1", body, "name", "Name", "companyName", "CompanyName");
  setStringPairIfPresent(data, "Address", "Address1", body, "address", "Address");
  setStringPairIfPresent(data, "Email", "Email1", body, "email", "Email");
  setStringPairIfPresent(
    data,
    "MobileNumber",
    "MobileNumber1",
    body,
    "mobileNumber",
    "MobileNumber",
    "mobile",
    "Mobile",
  );
  setStringPairIfPresent(data, "TIN", "TIN1", body, "tin", "TIN", "tinNumber", "TinNumber");
  setStringPairIfPresent(data, "GCash", "GCash1", body, "gCash", "GCash", "gcash", "Gcash");
  setStringPairIfPresent(data, "BankNo", "BankNo1", body, "bankNo", "BankNo", "bankAccount", "BankAccount");

  if (hasField(body, "isPrimaryCompany", "IsPrimaryCompany", "primaryCompany")) {
    data.IsPrimaryCompany =
      readBoolean(body, "isPrimaryCompany", "IsPrimaryCompany", "primaryCompany") ??
      false;
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      if (data.IsPrimaryCompany === true) {
        await tx.companyInfo.updateMany({
          where: { Id: { not: id } },
          data: { IsPrimaryCompany: false },
        });
      }

      return tx.companyInfo.update({
        where: { Id: id },
        data,
        select: companyInfoSelect,
      });
    });

    return mapCompanyInfo(row);
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function deleteCompanyInfo(id: number) {
  try {
    await prisma.companyInfo.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

function setStringPairIfPresent(
  data: Record<string, unknown>,
  primaryKey: string,
  legacyKey: string,
  body: JsonRecord,
  ...keys: string[]
) {
  if (!hasField(body, ...keys)) {
    return;
  }

  const value = readString(body, ...keys) ?? "";
  data[primaryKey] = value;
  data[legacyKey] = value;
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

function readPositiveInteger(body: JsonRecord, ...keys: string[]) {
  const value = readInteger(body, ...keys);
  return value && value > 0 ? value : null;
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

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

function normalizePrismaError(error: unknown): CompanyInfoServiceError {
  if (error instanceof CompanyInfoServiceError) {
    return error;
  }

  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new CompanyInfoServiceError("Record not found.", 404, {});
    }

    if (error.code === "P2003") {
      return new CompanyInfoServiceError(
        "Cannot delete this company because it is already used by other records.",
        409,
        "Cannot delete this company because it is already used by other records.",
      );
    }
  }

  return new CompanyInfoServiceError("An unexpected error occurred.", 500);
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
