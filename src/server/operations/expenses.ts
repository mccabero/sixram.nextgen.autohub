import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";
import {
  hasField,
  readBoolean,
  readDate,
  readDecimal,
  readInteger,
  readString,
  setIfProvided,
} from "@/server/operations/simple-fields";
import {
  findJobStatusId,
  getOrCreateDeletedJobStatusId,
} from "@/server/operations/status";

const defaultExpenseReference = "EXP0000001";
type DecimalJsonValue = {
  toJSON?: () => unknown;
  toString?: () => string;
} | number | null;

const expenseSelect = {
  Id: true,
  IsChangan: true,
  IsPaid: true,
  ReferenceNo: true,
  ExpenseDateTime: true,
  Amount: true,
  VAT12: true,
  PayTo: true,
  Remarks: true,
  PaymentReferenceNo: true,
  PaymentTypeParameterId: true,
  JobStatusId: true,
  ExpenseByUserId: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
  JobStatus: { select: { Name: true } },
  PaymentTypeParameter: { select: { Name: true } },
  ExpenseByUser: { select: { Firstname: true, LastName: true, Email: true } },
} as const;

export async function listExpenses() {
  const rows = await prisma.expense.findMany({
    orderBy: [{ ExpenseDateTime: "desc" }, { Id: "desc" }],
    select: expenseSelect,
  });

  return rows.map(mapExpense);
}

export async function listExpenseSummary() {
  const rows = await prisma.expense.findMany({
    orderBy: [{ ExpenseDateTime: "desc" }, { Id: "desc" }],
    select: expenseSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo,
    expensesBy: userName(row.ExpenseByUser),
    expenseDateTime: row.ExpenseDateTime,
    createdDateTime: row.CreatedDateTime,
    amount: row.Amount,
    status: row.JobStatus?.Name ?? "",
  }));
}

export async function getExpense(id: number) {
  const row = await prisma.expense.findUnique({
    where: { Id: id },
    select: expenseSelect,
  });

  return row ? mapExpense(row) : null;
}

export async function getNextExpenseReferenceNo() {
  const latestRef = await prisma.expense.findFirst({
    where: { ReferenceNo: { not: "" } },
    orderBy: { Id: "desc" },
    select: { ReferenceNo: true },
  });
  const referenceNo = nextReferenceValue(latestRef?.ReferenceNo ?? "");

  return { referenceNo, ReferenceNo: referenceNo };
}

export async function createExpense(body: JsonRecord, actorUserId: number) {
  const now = new Date();
  const actorId = actorUserId > 0 ? actorUserId : 0;
  const referenceNo =
    readString(body, "referenceNo", "ReferenceNo")?.trim() ||
    (await getNextExpenseReferenceNo()).referenceNo;
  const jobStatusId =
    readInteger(body, "jobStatusId", "JobStatusId") ??
    (await findJobStatusId("OPEN")) ??
    0;

  validateExpenseBody(body, jobStatusId);

  try {
    const created = await prisma.expense.create({
      data: {
        IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
        IsPaid: readBoolean(body, "isPaid", "IsPaid") ?? false,
        ReferenceNo: referenceNo,
        ExpenseDateTime:
          readDate(body, "expenseDateTime", "ExpenseDateTime", "transactionDate") ??
          now,
        Amount: readDecimal(body, "amount", "Amount", "expensesAmount"),
        VAT12: readDecimal(body, "vat12", "VAT12"),
        PayTo: readString(body, "payTo", "PayTo", "paymentTo")?.trim() ?? "",
        Remarks: readString(body, "remarks", "Remarks") ?? "",
        PaymentReferenceNo:
          readString(body, "paymentReferenceNo", "PaymentReferenceNo") ?? "",
        PaymentTypeParameterId:
          readInteger(body, "paymentTypeParameterId", "PaymentTypeParameterId") ??
          0,
        JobStatusId: jobStatusId,
        ExpenseByUserId:
          readInteger(body, "expenseByUserId", "ExpenseByUserId") ?? actorId,
        CreatedById: readInteger(body, "createdById", "CreatedById") ?? actorId,
        CreatedDateTime: now,
        UpdatedById: readInteger(body, "updatedById", "UpdatedById") ?? actorId,
        UpdatedDateTime: now,
      },
      select: { Id: true },
    });

    return { id: created.Id };
  } catch (error) {
    throw normalizeOperationWriteError(error, "expense");
  }
}

export async function updateExpense(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.expense.findUnique({
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
  setIfProvided(data, "IsPaid", body, readBoolean, "isPaid", "IsPaid");
  setIfProvided(data, "ReferenceNo", body, readString, "referenceNo", "ReferenceNo");
  setIfProvided(
    data,
    "ExpenseDateTime",
    body,
    readDate,
    "expenseDateTime",
    "ExpenseDateTime",
    "transactionDate",
  );
  setIfProvided(data, "Amount", body, readDecimal, "amount", "Amount", "expensesAmount");
  setIfProvided(data, "VAT12", body, readDecimal, "vat12", "VAT12");
  setIfProvided(data, "PayTo", body, readString, "payTo", "PayTo", "paymentTo");
  setIfProvided(data, "Remarks", body, readString, "remarks", "Remarks");
  setIfProvided(
    data,
    "PaymentReferenceNo",
    body,
    readString,
    "paymentReferenceNo",
    "PaymentReferenceNo",
  );
  setIfProvided(
    data,
    "PaymentTypeParameterId",
    body,
    readInteger,
    "paymentTypeParameterId",
    "PaymentTypeParameterId",
  );
  setIfProvided(data, "JobStatusId", body, readInteger, "jobStatusId", "JobStatusId");
  setIfProvided(
    data,
    "ExpenseByUserId",
    body,
    readInteger,
    "expenseByUserId",
    "ExpenseByUserId",
  );

  if (hasField(body, "amount", "Amount", "expensesAmount")) {
    const amount = Number(data.Amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new OperationServiceError("Expense amount must be greater than zero.");
    }
  }

  try {
    await prisma.expense.update({ where: { Id: id }, data });
    return true;
  } catch (error) {
    throw normalizeOperationWriteError(error, "expense");
  }
}

export async function deleteExpense(id: number, actorUserId: number) {
  const existing = await prisma.expense.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);
  await prisma.expense.update({
    where: { Id: id },
    data: {
      JobStatusId: deletedStatusId,
      UpdatedById: actorUserId > 0 ? actorUserId : 0,
      UpdatedDateTime: new Date(),
    },
  });

  return { id, jobStatusId: deletedStatusId, status: "DELETED" };
}

function mapExpense(row: {
  Id: number;
  IsChangan: boolean;
  IsPaid: boolean;
  ReferenceNo: string;
  ExpenseDateTime: Date;
  Amount: DecimalJsonValue;
  VAT12: DecimalJsonValue;
  PayTo: string;
  Remarks: string;
  PaymentReferenceNo: string | null;
  PaymentTypeParameterId: number;
  JobStatusId: number;
  ExpenseByUserId: number;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
  PaymentTypeParameter?: { Name: string | null } | null;
  JobStatus?: { Name: string | null } | null;
  ExpenseByUser?: {
    Firstname: string | null;
    LastName: string | null;
    Email: string | null;
  } | null;
}) {
  if (!row) return row;

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    isPaid: row.IsPaid,
    referenceNo: row.ReferenceNo,
    expenseDateTime: row.ExpenseDateTime,
    amount: row.Amount,
    vat12: row.VAT12,
    payTo: row.PayTo,
    remarks: row.Remarks,
    paymentReferenceNo: row.PaymentReferenceNo,
    paymentTypeParameterId: row.PaymentTypeParameterId,
    paymentType: row.PaymentTypeParameter?.Name ?? "",
    jobStatusId: row.JobStatusId,
    status: row.JobStatus?.Name ?? "",
    expenseByUserId: row.ExpenseByUserId,
    expensesBy: userName(row.ExpenseByUser ?? null),
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function validateExpenseBody(body: JsonRecord, jobStatusId: number) {
  if (jobStatusId <= 0) {
    throw new OperationServiceError("Expense status is not configured.");
  }

  if (readDecimal(body, "amount", "Amount", "expensesAmount") <= 0) {
    throw new OperationServiceError("Expense amount must be greater than zero.");
  }

  if (!readString(body, "payTo", "PayTo", "paymentTo")?.trim()) {
    throw new OperationServiceError("Pay to is required.");
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

function nextReferenceValue(latestRef: string) {
  if (!latestRef) return defaultExpenseReference;

  const match = /^([A-Za-z]*)(\d+)$/.exec(latestRef);
  if (!match) return latestRef;

  const [, prefix, numberText] = match;
  const numberValue = Number(numberText);

  if (!Number.isSafeInteger(numberValue)) return latestRef;

  return `${prefix}${String(numberValue + 1).padStart(numberText.length, "0")}`;
}

function normalizeOperationWriteError(error: unknown, entityName: string) {
  if (error instanceof OperationServiceError) return error;

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
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
