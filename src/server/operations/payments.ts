import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";

const defaultPaymentReference = "PY0000001";

const paymentListSelect = {
  Id: true,
  IsChangan: true,
  IsFullyPaid: true,
  ReferenceNo: true,
  PaymentDate: true,
  JobStatusId: true,
  CustomerId: true,
  InvoiceTotalAmount: true,
  VAT12: true,
  DepositAmount: true,
  AmountPayable: true,
  TotalPaidAmount: true,
  Balance: true,
  Remarks: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
} as const;

export async function listPayments() {
  const rows = await prisma.payment.findMany({
    orderBy: { Id: "asc" },
    select: paymentListSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    isFullyPaid: row.IsFullyPaid,
    referenceNo: row.ReferenceNo ?? "",
    paymentDate: row.PaymentDate,
    jobStatusId: row.JobStatusId,
    customerId: row.CustomerId,
    invoiceTotalAmount: row.InvoiceTotalAmount,
    vat12: row.VAT12,
    depositAmount: row.DepositAmount,
    amountPayable: row.AmountPayable,
    totalPaidAmount: row.TotalPaidAmount,
    balance: row.Balance,
    remarks: row.Remarks,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  }));
}

export async function getNextPaymentReferenceNo() {
  const latestRef = await prisma.payment.findFirst({
    where: {
      ReferenceNo: {
        not: "",
      },
    },
    orderBy: { Id: "desc" },
    select: { ReferenceNo: true },
  });

  return {
    referenceNo: nextReferenceValue(latestRef?.ReferenceNo ?? ""),
  };
}

export async function listPaymentSummary() {
  const rows = await prisma.payment.findMany({
    orderBy: [{ CreatedDateTime: "desc" }, { Id: "desc" }],
    select: {
      Id: true,
      IsChangan: true,
      ReferenceNo: true,
      PaymentDate: true,
      AmountPayable: true,
      TotalPaidAmount: true,
      Balance: true,
      Customer: {
        select: {
          FirstName: true,
          LastName: true,
        },
      },
      JobStatus: {
        select: {
          Name: true,
        },
      },
      PaymentDetailsAsPayment: {
        orderBy: { Id: "asc" },
        select: {
          Id: true,
          InvoiceId: true,
          AmountPaid: true,
          PaymentDate: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo ?? "",
    paymentDate: row.PaymentDate,
    customer: customerName(row.Customer),
    amountPayable: row.AmountPayable,
    totalPaidAmount: row.TotalPaidAmount,
    balance: row.Balance,
    status: row.JobStatus?.Name ?? "",
    paymentDetails: row.PaymentDetailsAsPayment.map((detail) => ({
      id: detail.Id,
      invoiceId: detail.InvoiceId,
      amountPaid: detail.AmountPaid,
      paymentDate: detail.PaymentDate,
    })),
  }));
}

export async function getPayment(id: number) {
  const row = await prisma.payment.findUnique({
    where: { Id: id },
    select: {
      ...paymentListSelect,
      Customer: {
        select: {
          FirstName: true,
          LastName: true,
        },
      },
      JobStatus: {
        select: {
          Name: true,
        },
      },
      PaymentDetailsAsPayment: {
        orderBy: { Id: "asc" },
        select: {
          Id: true,
          PaymentTypeParameterId: true,
          PaymentTypeParameter: {
            select: {
              Name: true,
            },
          },
          InvoiceId: true,
          Invoice: {
            select: {
              InvoiceNo: true,
              InvoiceDate: true,
              DueDate: true,
              JobOrderId: true,
              TotalAmount: true,
              JobOrder: {
                select: {
                  ReferenceNo: true,
                },
              },
            },
          },
          IsFullyPaid: true,
          AmountPaid: true,
          IsDeposit: true,
          PaymentDate: true,
          PaymentReferenceNo: true,
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    isFullyPaid: row.IsFullyPaid,
    referenceNo: row.ReferenceNo,
    paymentDate: row.PaymentDate,
    jobStatusId: row.JobStatusId,
    jobStatusName: row.JobStatus?.Name ?? "",
    customerId: row.CustomerId,
    customerName: customerName(row.Customer),
    invoiceTotalAmount: row.InvoiceTotalAmount,
    vat12: row.VAT12,
    depositAmount: row.DepositAmount,
    amountPayable: row.AmountPayable,
    totalPaidAmount: row.TotalPaidAmount,
    balance: row.Balance,
    remarks: row.Remarks,
    paymentDetails: row.PaymentDetailsAsPayment.map((detail) => ({
      id: detail.Id,
      paymentTypeParameterId: detail.PaymentTypeParameterId,
      paymentTypeName: detail.PaymentTypeParameter?.Name ?? "",
      invoiceId: detail.InvoiceId,
      invoiceNo: detail.Invoice?.InvoiceNo ?? "",
      invoiceDate: detail.Invoice?.InvoiceDate ?? null,
      dueDate: detail.Invoice?.DueDate ?? null,
      jobOrderId: detail.Invoice?.JobOrderId ?? null,
      jobOrderNo: detail.Invoice?.JobOrder?.ReferenceNo ?? "",
      invoiceTotalAmount: detail.Invoice?.TotalAmount ?? 0,
      isFullyPaid: detail.IsFullyPaid,
      amountPaid: detail.AmountPaid,
      isDeposit: detail.IsDeposit,
      paymentDate: detail.PaymentDate,
      paymentReferenceNo: detail.PaymentReferenceNo,
    })),
  };
}

export async function createPayment(body: JsonRecord, actorUserId: number) {
  const now = new Date();
  const createdById =
    readInteger(body, "createdById", "CreatedById") ??
    (actorUserId > 0 ? actorUserId : 0);
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const requestedReferenceNo = readString(body, "referenceNo", "ReferenceNo") ?? "";
  const referenceNo = (await getNextPaymentReferenceNo()).referenceNo;
  const details = readPaymentDetails(body).map((detail) => ({
    ...detail,
    paymentReferenceNo:
      !detail.paymentReferenceNo.trim() ||
      detail.paymentReferenceNo === requestedReferenceNo
        ? referenceNo
        : detail.paymentReferenceNo,
  }));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
          IsFullyPaid: readBoolean(body, "isFullyPaid", "IsFullyPaid") ?? false,
          ReferenceNo: referenceNo,
          PaymentDate: readDate(body, "paymentDate", "PaymentDate") ?? now,
          JobStatusId: readInteger(body, "jobStatusId", "JobStatusId") ?? 0,
          CustomerId: readInteger(body, "customerId", "CustomerId") ?? 0,
          InvoiceTotalAmount: readDecimal(
            body,
            "invoiceTotalAmount",
            "InvoiceTotalAmount",
          ),
          VAT12: readDecimal(body, "vat12", "VAT12"),
          DepositAmount: readDecimal(body, "depositAmount", "DepositAmount"),
          AmountPayable: readDecimal(body, "amountPayable", "AmountPayable"),
          TotalPaidAmount: readDecimal(
            body,
            "totalPaidAmount",
            "TotalPaidAmount",
          ),
          Balance: readDecimal(body, "balance", "Balance"),
          Remarks: readString(body, "remarks", "Remarks") ?? "",
          CreatedById: createdById,
          CreatedDateTime: now,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
        select: { Id: true },
      });

      await writePaymentDetails(tx, payment.Id, details, {
        createdById,
        updatedById,
        now,
      });

      return payment;
    });

    return { id: created.Id };
  } catch (error) {
    throw normalizePrismaError(error, "payment");
  }
}

export async function updatePayment(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.payment.findUnique({
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
  setIfProvided(
    data,
    "IsFullyPaid",
    body,
    readBoolean,
    "isFullyPaid",
    "IsFullyPaid",
  );
  setIfProvided(data, "ReferenceNo", body, readString, "referenceNo", "ReferenceNo");
  setIfProvided(data, "PaymentDate", body, readDate, "paymentDate", "PaymentDate");
  setIfProvided(data, "CustomerId", body, readInteger, "customerId", "CustomerId");
  setIfProvided(
    data,
    "InvoiceTotalAmount",
    body,
    readDecimal,
    "invoiceTotalAmount",
    "InvoiceTotalAmount",
  );
  setIfProvided(data, "VAT12", body, readDecimal, "vat12", "VAT12");
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
    "AmountPayable",
    body,
    readDecimal,
    "amountPayable",
    "AmountPayable",
  );
  setIfProvided(
    data,
    "TotalPaidAmount",
    body,
    readDecimal,
    "totalPaidAmount",
    "TotalPaidAmount",
  );
  setIfProvided(data, "Balance", body, readDecimal, "balance", "Balance");
  setIfProvided(data, "Remarks", body, readString, "remarks", "Remarks");

  if (hasField(body, "jobStatusId", "JobStatusId")) {
    const jobStatusId = readInteger(body, "jobStatusId", "JobStatusId");
    if (jobStatusId !== null) {
      await rejectReopenTransition(existing.JobStatusId, jobStatusId);
      data.JobStatusId = jobStatusId;
    }
  }

  const shouldReplaceDetails = hasField(body, "paymentDetails", "PaymentDetails");
  const details = shouldReplaceDetails ? readPaymentDetails(body) : [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { Id: id },
        data,
      });

      if (shouldReplaceDetails) {
        await tx.paymentDetail.deleteMany({ where: { PaymentId: id } });
        await writePaymentDetails(tx, id, details, {
          createdById: Number(data.UpdatedById ?? 0),
          updatedById: Number(data.UpdatedById ?? 0),
          now: new Date(),
        });
      }
    });

    return true;
  } catch (error) {
    throw normalizePrismaError(error, "payment");
  }
}

export async function deletePayment(id: number, actorUserId: number) {
  const existing = await prisma.payment.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);
  await prisma.payment.update({
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

export async function proceedInvoiceToPayment(
  invoiceId: number,
  body: JsonRecord | null,
) {
  const invoice = await prisma.invoice.findUnique({
    where: { Id: invoiceId },
    select: {
      Id: true,
      IsChangan: true,
      JobStatusId: true,
      JobOrderId: true,
      CustomerId: true,
      TotalAmount: true,
      VAT12: true,
      UpdatedById: true,
    },
  });

  if (!invoice) return null;

  const existingPayment = await prisma.paymentDetail.findFirst({
    where: { InvoiceId: invoice.Id },
    orderBy: { PaymentId: "desc" },
    select: {
      PaymentId: true,
      Payment: {
        select: {
          ReferenceNo: true,
        },
      },
    },
  });

  if (existingPayment) {
    return {
      paymentId: existingPayment.PaymentId,
      referenceNo: existingPayment.Payment.ReferenceNo ?? "",
      status: "CONVERTED",
      existingPayment: true,
    };
  }

  const openStatusId = await findJobStatusId("OPEN");
  if (!openStatusId) {
    throw new OperationServiceError("The OPEN job status is not configured.");
  }

  if (invoice.JobStatusId !== openStatusId) {
    throw new OperationServiceError("Only OPEN invoices can proceed to payment.");
  }

  const convertedStatusId = await findJobStatusId("CONVERTED");
  if (!convertedStatusId) {
    throw new OperationServiceError(
      "The CONVERTED job status is not configured.",
    );
  }

  const [depositAmount, paidAmount] = await Promise.all([
    getDepositAmountForJobOrder(invoice.JobOrderId),
    getPaidAmountForInvoice(invoice.Id),
  ]);
  const balance = Math.max(
    0,
    numberFromDecimal(invoice.TotalAmount) - depositAmount - paidAmount,
  );

  if (balance <= 0) {
    throw new OperationServiceError(
      "This invoice has no remaining balance to pay.",
    );
  }

  const createdById =
    readInteger(body, "createdById", "CreatedById") ??
    readInteger(body, "updatedById", "UpdatedById") ??
    invoice.UpdatedById;
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ??
    readInteger(body, "createdById", "CreatedById") ??
    invoice.UpdatedById;
  const paymentDate = readDate(body, "paymentDate", "PaymentDate") ?? new Date();
  const referenceNo = (await getNextPaymentReferenceNo()).referenceNo;

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const row = await tx.payment.create({
        data: {
          IsChangan: invoice.IsChangan,
          IsFullyPaid: false,
          ReferenceNo: referenceNo,
          PaymentDate: paymentDate,
          JobStatusId: openStatusId,
          CustomerId: invoice.CustomerId,
          InvoiceTotalAmount: invoice.TotalAmount,
          VAT12: invoice.VAT12,
          DepositAmount: depositAmount,
          AmountPayable: balance,
          TotalPaidAmount: 0,
          Balance: balance,
          Remarks: "",
          CreatedById: createdById,
          CreatedDateTime: new Date(),
          UpdatedById: updatedById,
          UpdatedDateTime: new Date(),
        },
        select: { Id: true },
      });

      await tx.invoice.update({
        where: { Id: invoice.Id },
        data: {
          JobStatusId: convertedStatusId,
          UpdatedById: updatedById,
          UpdatedDateTime: new Date(),
        },
      });

      return row;
    });

    return {
      paymentId: payment.Id,
      status: "CONVERTED",
    };
  } catch (error) {
    throw normalizePrismaError(error, "payment");
  }
}

type PaymentDetailLine = {
  paymentTypeParameterId: number;
  invoiceId: number;
  isFullyPaid: boolean;
  amountPaid: number;
  isDeposit: boolean;
  paymentDate: Date | null;
  paymentReferenceNo: string;
};

type PaymentDetailWriteContext = {
  createdById: number;
  updatedById: number;
  now: Date;
};

type PaymentTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function writePaymentDetails(
  tx: PaymentTransaction,
  paymentId: number,
  details: PaymentDetailLine[],
  context: PaymentDetailWriteContext,
) {
  const validDetails = details.filter(
    (detail) => detail.invoiceId > 0 && detail.paymentTypeParameterId > 0,
  );

  if (validDetails.length === 0) return;

  await tx.paymentDetail.createMany({
    data: validDetails.map((detail) => ({
      PaymentId: paymentId,
      PaymentTypeParameterId: detail.paymentTypeParameterId,
      InvoiceId: detail.invoiceId,
      IsFullyPaid: detail.isFullyPaid,
      AmountPaid: detail.amountPaid,
      IsDeposit: detail.isDeposit,
      PaymentDate: detail.paymentDate,
      PaymentReferenceNo: detail.paymentReferenceNo,
      CreatedById: context.createdById,
      CreatedDateTime: context.now,
      UpdatedById: context.updatedById,
      UpdatedDateTime: context.now,
    })),
  });
}

async function getDepositAmountForJobOrder(jobOrderId: number) {
  const rows = await prisma.deposit.findMany({
    where: { JobOrderId: jobOrderId },
    select: {
      DepositAmount: true,
      JobStatus: {
        select: {
          Name: true,
          Description: true,
        },
      },
    },
  });

  return rows
    .filter((row) => !isNonPostingStatus(row.JobStatus))
    .reduce((total, row) => total + numberFromDecimal(row.DepositAmount), 0);
}

async function getPaidAmountForInvoice(invoiceId: number) {
  const rows = await prisma.paymentDetail.findMany({
    where: { InvoiceId: invoiceId },
    select: {
      AmountPaid: true,
      Payment: {
        select: {
          JobStatus: {
            select: {
              Name: true,
              Description: true,
            },
          },
        },
      },
    },
  });

  return rows
    .filter((row) => !isNonPostingStatus(row.Payment.JobStatus))
    .reduce((total, row) => total + numberFromDecimal(row.AmountPaid), 0);
}

function readPaymentDetails(body: JsonRecord) {
  return readRecordArray(body, "paymentDetails", "PaymentDetails").map((detail) => ({
    paymentTypeParameterId:
      readInteger(detail, "paymentTypeParameterId", "PaymentTypeParameterId") ?? 0,
    invoiceId: readInteger(detail, "invoiceId", "InvoiceId") ?? 0,
    isFullyPaid:
      readBoolean(detail, "isFullyPaid", "IsFullyPaid") ?? false,
    amountPaid: readDecimal(detail, "amountPaid", "AmountPaid"),
    isDeposit: readBoolean(detail, "isDeposit", "IsDeposit") ?? false,
    paymentDate: readDate(detail, "paymentDate", "PaymentDate"),
    paymentReferenceNo:
      readString(detail, "paymentReferenceNo", "PaymentReferenceNo") ?? "",
  }));
}

function readRecordArray(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) {
      return value.filter(isJsonRecord);
    }
  }

  return [];
}

function customerName(
  customer: { FirstName: string | null; LastName: string | null } | null,
) {
  return `${customer?.FirstName ?? ""} ${customer?.LastName ?? ""}`.trim();
}

function nextReferenceValue(latestRef: string) {
  if (!latestRef) return defaultPaymentReference;

  const match = /^([A-Za-z]*)(\d+)$/.exec(latestRef);
  if (!match) return latestRef;

  const [, prefix, numberText] = match;
  const numberValue = Number(numberText);

  if (!Number.isSafeInteger(numberValue)) return latestRef;

  return `${prefix}${String(numberValue + 1).padStart(numberText.length, "0")}`;
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

async function findJobStatusId(...statusNames: string[]) {
  const normalized = statusNames
    .map((statusName) => statusName.trim())
    .filter(Boolean);

  if (normalized.length === 0) return null;

  const status = await prisma.jobStatus.findFirst({
    where: {
      OR: normalized.map((statusName) => ({
        Name: { equals: statusName, mode: "insensitive" as const },
      })),
    },
    orderBy: { Id: "asc" },
    select: { Id: true },
  });

  return status?.Id ?? null;
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

function isNonPostingStatus(
  status: { Name: string | null; Description: string | null } | null,
) {
  const text = `${status?.Name ?? ""} ${status?.Description ?? ""}`.toUpperCase();

  return (
    text.includes("DELETE") ||
    text.includes("VOID") ||
    text.includes("CANCEL")
  );
}

function numberFromDecimal(value: { toString: () => string } | number | null) {
  if (value === null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
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

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
