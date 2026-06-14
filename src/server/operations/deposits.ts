import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";

const depositSelect = {
  Id: true,
  IsChangan: true,
  IsRefund: true,
  ReferenceNo: true,
  JobStatusId: true,
  TransactionDateTime: true,
  CustomerId: true,
  JobOrderId: true,
  PaymentTypeParameterId: true,
  DepositAmount: true,
  PaymentReferenceNo: true,
  Description: true,
  RefundAmount: true,
  RefundDateTime: true,
  RefundReason: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
} as const;

export async function listDeposits() {
  const rows = await prisma.deposit.findMany({
    orderBy: { Id: "asc" },
    select: depositSelect,
  });

  return rows.map(mapDeposit);
}

export async function listDepositSummary() {
  const rows = await prisma.deposit.findMany({
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsChangan: true,
      ReferenceNo: true,
      TransactionDateTime: true,
      DepositAmount: true,
      Customer: {
        select: {
          FirstName: true,
          LastName: true,
        },
      },
      PaymentTypeParameter: {
        select: {
          Name: true,
        },
      },
      JobStatus: {
        select: {
          Name: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo ?? "",
    transactionDate: row.TransactionDateTime,
    customer: customerName(row.Customer),
    paymentType: row.PaymentTypeParameter?.Name ?? "",
    depositAmount: row.DepositAmount,
    status: row.JobStatus?.Name ?? "",
  }));
}

export async function getDeposit(id: number) {
  const row = await prisma.deposit.findUnique({
    where: { Id: id },
    select: depositSelect,
  });

  return row ? mapDeposit(row) : null;
}

export async function createDeposit(body: JsonRecord, actorUserId: number) {
  const now = new Date();
  const createdById =
    readInteger(body, "createdById", "CreatedById") ??
    (actorUserId > 0 ? actorUserId : 0);
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ?? createdById;

  try {
    const created = await prisma.deposit.create({
      data: {
        IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
        IsRefund: readBoolean(body, "isRefund", "IsRefund") ?? false,
        ReferenceNo: readString(body, "referenceNo", "ReferenceNo") ?? "",
        JobStatusId: readInteger(body, "jobStatusId", "JobStatusId") ?? 0,
        TransactionDateTime:
          readDate(body, "transactionDateTime", "TransactionDateTime") ?? now,
        CustomerId: readInteger(body, "customerId", "CustomerId") ?? 0,
        JobOrderId: readInteger(body, "jobOrderId", "JobOrderId") ?? 0,
        PaymentTypeParameterId:
          readInteger(body, "paymentTypeParameterId", "PaymentTypeParameterId") ??
          0,
        DepositAmount: readDecimal(body, "depositAmount", "DepositAmount"),
        PaymentReferenceNo:
          readString(body, "paymentReferenceNo", "PaymentReferenceNo") ?? "",
        Description: readString(body, "description", "Description") ?? "",
        RefundAmount: readDecimal(body, "refundAmount", "RefundAmount"),
        RefundDateTime: readDate(body, "refundDateTime", "RefundDateTime"),
        RefundReason: readString(body, "refundReason", "RefundReason") ?? "",
        CreatedById: createdById,
        CreatedDateTime: now,
        UpdatedById: updatedById,
        UpdatedDateTime: now,
      },
      select: { Id: true },
    });

    return { id: created.Id };
  } catch (error) {
    throw normalizePrismaError(error, "deposit");
  }
}

export async function updateDeposit(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.deposit.findUnique({
    where: { Id: id },
    select: { Id: true, JobStatusId: true, UpdatedById: true },
  });

  if (!existing) return false;

  const data: Record<string, unknown> = {
    UpdatedDateTime: new Date(),
    UpdatedById:
      readInteger(body, "updatedById", "UpdatedById") ??
      existing.UpdatedById ??
      (actorUserId > 0 ? actorUserId : 0),
  };

  setIfProvided(data, "IsChangan", body, readBoolean, "isChangan", "IsChangan");
  setIfProvided(data, "IsRefund", body, readBoolean, "isRefund", "IsRefund");
  setIfProvided(data, "ReferenceNo", body, readString, "referenceNo", "ReferenceNo");
  setIfProvided(
    data,
    "TransactionDateTime",
    body,
    readDate,
    "transactionDateTime",
    "TransactionDateTime",
  );
  setIfProvided(data, "CustomerId", body, readInteger, "customerId", "CustomerId");
  setIfProvided(data, "JobOrderId", body, readInteger, "jobOrderId", "JobOrderId");
  setIfProvided(
    data,
    "PaymentTypeParameterId",
    body,
    readInteger,
    "paymentTypeParameterId",
    "PaymentTypeParameterId",
  );
  setIfProvided(
    data,
    "DepositAmount",
    body,
    readDecimal,
    "depositAmount",
    "DepositAmount",
  );
  setIfProvided(
    data,
    "PaymentReferenceNo",
    body,
    readString,
    "paymentReferenceNo",
    "PaymentReferenceNo",
  );
  setIfProvided(data, "Description", body, readString, "description", "Description");
  setIfProvided(
    data,
    "RefundAmount",
    body,
    readDecimal,
    "refundAmount",
    "RefundAmount",
  );
  setIfProvided(
    data,
    "RefundDateTime",
    body,
    readDate,
    "refundDateTime",
    "RefundDateTime",
  );
  setIfProvided(
    data,
    "RefundReason",
    body,
    readString,
    "refundReason",
    "RefundReason",
  );

  if (hasField(body, "jobStatusId", "JobStatusId")) {
    const jobStatusId = readInteger(body, "jobStatusId", "JobStatusId");
    if (jobStatusId !== null) {
      await rejectReopenTransition(existing.JobStatusId, jobStatusId);
      data.JobStatusId = jobStatusId;
    }
  }

  try {
    await prisma.deposit.update({
      where: { Id: id },
      data,
    });

    return true;
  } catch (error) {
    throw normalizePrismaError(error, "deposit");
  }
}

export async function deleteDeposit(id: number, actorUserId: number) {
  const existing = await prisma.deposit.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);
  await prisma.deposit.update({
    where: { Id: id },
    data: {
      JobStatusId: deletedStatusId,
      UpdatedById: actorUserId > 0 ? actorUserId : 0,
      UpdatedDateTime: new Date(),
    },
  });

  return {
    id,
    jobStatusId: deletedStatusId,
    status: "DELETED",
  };
}

type DecimalJsonValue = {
  toJSON?: () => unknown;
  toString: () => string;
};

type DepositRow = {
  Id: number;
  IsChangan: boolean;
  IsRefund: boolean;
  ReferenceNo: string;
  JobStatusId: number;
  TransactionDateTime: Date;
  CustomerId: number;
  JobOrderId: number;
  PaymentTypeParameterId: number;
  DepositAmount: DecimalJsonValue | number;
  PaymentReferenceNo: string | null;
  Description: string | null;
  RefundAmount: DecimalJsonValue | number | null;
  RefundDateTime: Date | null;
  RefundReason: string | null;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
};

function mapDeposit(row: DepositRow) {
  return {
    id: row.Id,
    isChangan: row.IsChangan,
    isRefund: row.IsRefund,
    referenceNo: row.ReferenceNo ?? "",
    jobStatusId: row.JobStatusId,
    transactionDateTime: row.TransactionDateTime,
    customerId: row.CustomerId,
    jobOrderId: row.JobOrderId,
    paymentTypeParameterId: row.PaymentTypeParameterId,
    depositAmount: row.DepositAmount,
    paymentReferenceNo: row.PaymentReferenceNo,
    description: row.Description,
    refundAmount: row.RefundAmount,
    refundDateTime: row.RefundDateTime,
    refundReason: row.RefundReason,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function customerName(
  customer: { FirstName: string | null; LastName: string | null } | null,
) {
  return `${customer?.FirstName ?? ""} ${customer?.LastName ?? ""}`.trim();
}

function readString(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    if (value === null) return null;
    if (typeof value === "string") return value;
  }

  return null;
}

function readInteger(body: JsonRecord | null, ...keys: string[]) {
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

function readDecimal(body: JsonRecord | null, ...keys: string[]) {
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

function readBoolean(body: JsonRecord | null, ...keys: string[]) {
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

function readDate(body: JsonRecord | null, ...keys: string[]) {
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

function setIfProvided<T>(
  data: Record<string, unknown>,
  field: string,
  body: JsonRecord,
  reader: (body: JsonRecord, ...keys: string[]) => T,
  ...keys: string[]
) {
  if (hasField(body, ...keys)) {
    const value = reader(body, ...keys);

    if (value !== null) {
      data[field] = value;
    }
  }
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

async function rejectReopenTransition(
  currentJobStatusId: number,
  requestedJobStatusId: number,
) {
  if (requestedJobStatusId <= 0) return;
  if (!(await isOpenJobStatus(requestedJobStatusId))) return;

  if (currentJobStatusId > 0 && !(await isOpenJobStatus(currentJobStatusId))) {
    throw new OperationServiceError(
      "Re-opening operation records is no longer supported.",
    );
  }
}

async function isOpenJobStatus(jobStatusId: number) {
  const status = await prisma.jobStatus.findFirst({
    where: {
      Id: jobStatusId,
      Name: { equals: "OPEN", mode: "insensitive" },
    },
    select: { Id: true },
  });

  return !!status;
}

async function getOrCreateDeletedJobStatusId(actorUserId: number) {
  const existing = await prisma.jobStatus.findFirst({
    where: { Name: { equals: "DELETED", mode: "insensitive" } },
    select: { Id: true },
  });

  if (existing) return existing.Id;

  const now = new Date();
  const actorId = actorUserId > 0 ? actorUserId : 0;
  const created = await prisma.jobStatus.create({
    data: {
      Name: "DELETED",
      Description: "Soft-deleted operation record",
      CreatedById: actorId,
      CreatedDateTime: now,
      UpdatedById: actorId,
      UpdatedDateTime: now,
    },
    select: { Id: true },
  });

  return created.Id;
}

function normalizePrismaError(error: unknown, entityName: string) {
  if (error instanceof OperationServiceError) return error;

  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new OperationServiceError(`${entityName} not found`, 404);
    }

    if (error.code === "P2003") {
      return new OperationServiceError(
        `Invalid linked record for this ${entityName}.`,
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
