import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";
import {
  readBoolean,
  readDate,
  readDecimal,
  readInteger,
  readString,
  setIfProvided,
} from "@/server/operations/simple-fields";

type DecimalJsonValue = {
  toJSON?: () => unknown;
  toString?: () => string;
} | number | null;

const pettyCashSelect = {
  Id: true,
  IsChangan: true,
  PCNo: true,
  TransactionDateTime: true,
  JobStatusId: true,
  PayTo: true,
  Particulars: true,
  CashIn: true,
  CashOut: true,
  Balance: true,
  PaidByUserId: true,
  PaymentReceivedBy: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
  JobStatus: { select: { Name: true } },
  PaidByUser: { select: { Firstname: true, LastName: true, Email: true } },
} as const;

export async function listPettyCash() {
  const rows = await prisma.pettyCash.findMany({
    orderBy: [{ TransactionDateTime: "desc" }, { Id: "desc" }],
    select: pettyCashSelect,
  });

  return rows.map(mapPettyCash);
}

export async function getPettyCash(id: number) {
  const row = await prisma.pettyCash.findUnique({
    where: { Id: id },
    select: pettyCashSelect,
  });

  return row ? mapPettyCash(row) : null;
}

export async function createPettyCash(body: JsonRecord, actorUserId: number) {
  const now = new Date();
  const actorId = actorUserId > 0 ? actorUserId : 0;
  validatePettyCashBody(body);

  try {
    const created = await prisma.pettyCash.create({
      data: {
        IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
        PCNo: readString(body, "pcNo", "PCNo")?.trim() ?? "",
        TransactionDateTime:
          readDate(body, "transactionDateTime", "TransactionDateTime") ?? now,
        JobStatusId: readInteger(body, "jobStatusId", "JobStatusId"),
        PayTo: readString(body, "payTo", "PayTo")?.trim() ?? "",
        Particulars: readString(body, "particulars", "Particulars") ?? "",
        CashIn: readDecimal(body, "cashIn", "CashIn"),
        CashOut: readDecimal(body, "cashOut", "CashOut"),
        Balance: readDecimal(body, "balance", "Balance"),
        PaidByUserId:
          readInteger(body, "paidByUserId", "PaidByUserId") ?? actorId,
        PaymentReceivedBy:
          readString(body, "paymentReceivedBy", "PaymentReceivedBy") ?? "",
        CreatedById: readInteger(body, "createdById", "CreatedById") ?? actorId,
        CreatedDateTime: now,
        UpdatedById: readInteger(body, "updatedById", "UpdatedById") ?? actorId,
        UpdatedDateTime: now,
      },
      select: { Id: true },
    });

    return { id: created.Id };
  } catch (error) {
    throw normalizePettyCashError(error);
  }
}

export async function updatePettyCash(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.pettyCash.findUnique({
    where: { Id: id },
    select: { Id: true, UpdatedById: true },
  });

  if (!existing) return false;

  const actorId = actorUserId > 0 ? actorUserId : 0;
  const data: Record<string, unknown> = {
    UpdatedById:
      readInteger(body, "updatedById", "UpdatedById") ??
      existing.UpdatedById ??
      actorId,
    UpdatedDateTime: new Date(),
  };

  setIfProvided(data, "IsChangan", body, readBoolean, "isChangan", "IsChangan");
  setIfProvided(data, "PCNo", body, readString, "pcNo", "PCNo");
  setIfProvided(
    data,
    "TransactionDateTime",
    body,
    readDate,
    "transactionDateTime",
    "TransactionDateTime",
  );
  setIfProvided(data, "JobStatusId", body, readInteger, "jobStatusId", "JobStatusId");
  setIfProvided(data, "PayTo", body, readString, "payTo", "PayTo");
  setIfProvided(data, "Particulars", body, readString, "particulars", "Particulars");
  setIfProvided(data, "CashIn", body, readDecimal, "cashIn", "CashIn");
  setIfProvided(data, "CashOut", body, readDecimal, "cashOut", "CashOut");
  setIfProvided(data, "Balance", body, readDecimal, "balance", "Balance");
  setIfProvided(
    data,
    "PaidByUserId",
    body,
    readInteger,
    "paidByUserId",
    "PaidByUserId",
  );
  setIfProvided(
    data,
    "PaymentReceivedBy",
    body,
    readString,
    "paymentReceivedBy",
    "PaymentReceivedBy",
  );

  try {
    await prisma.pettyCash.update({ where: { Id: id }, data });
    return true;
  } catch (error) {
    throw normalizePettyCashError(error);
  }
}

export async function deletePettyCash(id: number) {
  const existing = await prisma.pettyCash.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  await prisma.pettyCash.delete({ where: { Id: id } });

  return { id };
}

function mapPettyCash(row: {
  Id: number;
  IsChangan: boolean;
  PCNo: string;
  TransactionDateTime: Date;
  JobStatusId: number | null;
  PayTo: string;
  Particulars: string | null;
  CashIn: DecimalJsonValue;
  CashOut: DecimalJsonValue;
  Balance: DecimalJsonValue;
  PaidByUserId: number;
  PaymentReceivedBy: string;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
  JobStatus?: { Name: string | null } | null;
  PaidByUser?: {
    Firstname: string | null;
    LastName: string | null;
    Email: string | null;
  } | null;
}) {
  if (!row) return row;

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    pcNo: row.PCNo,
    transactionDateTime: row.TransactionDateTime,
    jobStatusId: row.JobStatusId,
    status: row.JobStatus?.Name ?? "",
    payTo: row.PayTo,
    particulars: row.Particulars,
    cashIn: row.CashIn,
    cashOut: row.CashOut,
    balance: row.Balance,
    paidByUserId: row.PaidByUserId,
    paidBy: userName(row.PaidByUser ?? null),
    paymentReceivedBy: row.PaymentReceivedBy,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function validatePettyCashBody(body: JsonRecord) {
  if (!readString(body, "pcNo", "PCNo")?.trim()) {
    throw new OperationServiceError("Petty cash voucher number is required.");
  }

  if (!readString(body, "payTo", "PayTo")?.trim()) {
    throw new OperationServiceError("Pay to is required.");
  }

  const cashIn = readDecimal(body, "cashIn", "CashIn");
  const cashOut = readDecimal(body, "cashOut", "CashOut");
  if (cashIn <= 0 && cashOut <= 0) {
    throw new OperationServiceError("Cash in or cash out must be greater than zero.");
  }
}

function userName(user: {
  Firstname: string | null;
  LastName: string | null;
  Email: string | null;
} | null) {
  return [user?.Firstname, user?.LastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || user?.Email || "";
}

function normalizePettyCashError(error: unknown) {
  if (error instanceof OperationServiceError) return error;

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    if (error.code === "P2025") {
      return new OperationServiceError("petty cash voucher not found", 404);
    }

    if (error.code === "P2003") {
      return new OperationServiceError(
        "Invalid linked record for this petty cash voucher.",
      );
    }
  }

  return error;
}
