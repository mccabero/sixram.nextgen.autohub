import { prisma } from "@/server/db/prisma";
import { getOrCreateVoidJobStatusId } from "@/server/operations/status";
import {
  consumeVoidCode,
  resolveActiveVoidCode,
} from "@/server/void-codes/service";

export class OperationAccessServiceError extends Error {
  readonly status: number;
  readonly body: { error: string };

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OperationAccessServiceError";
    this.status = status;
    this.body = { error: message };
  }
}

export async function unlockJobOrderEditing(
  jobOrderId: number,
  code: string | null | undefined,
  actorUserId: number,
) {
  await assertExists("joborders", jobOrderId);
  const codeId = await verifyCode(code);
  const consumed = await consumeVoidCode(
    codeId,
    actorUserId,
    "joborder-unlock-editing",
    jobOrderId,
  );

  if (!consumed) {
    throw new OperationAccessServiceError("Void code was already used or expired.", 403);
  }

  return { id: jobOrderId, unlocked: true };
}

export async function voidOperationRecord(
  type: string,
  id: number,
  code: string | null | undefined,
  actorUserId: number,
) {
  await assertExists(type, id);
  const codeId = await verifyCode(code);
  const voidStatusId = await getOrCreateVoidJobStatusId(actorUserId);
  const now = new Date();
  const actorId = actorUserId > 0 ? actorUserId : 0;

  await updateOperationStatus(type, id, voidStatusId, actorId, now);

  const consumed = await consumeVoidCode(
    codeId,
    actorUserId,
    `void-${normalizeType(type)}`,
    id,
  );

  if (!consumed) {
    throw new OperationAccessServiceError("Void code was already used or expired.", 403);
  }

  return { id, jobStatusId: voidStatusId, status: "VOID" };
}

async function verifyCode(code: string | null | undefined) {
  const resolution = await resolveActiveVoidCode(code);

  switch (resolution.status) {
    case "Success":
      if (!resolution.codeId) {
        throw new OperationAccessServiceError("Void code could not be resolved.", 403);
      }
      return resolution.codeId;
    case "MissingCode":
      throw new OperationAccessServiceError("Void code is required.");
    case "InvalidFormat":
      throw new OperationAccessServiceError("Void code must be a 6-digit code.");
    default:
      throw new OperationAccessServiceError("Void code is invalid, expired, or used.", 403);
  }
}

async function assertExists(type: string, id: number) {
  const normalized = normalizeType(type);
  const exists = await existsByType(normalized, id);

  if (!exists) {
    throw new OperationAccessServiceError("Operation record not found.", 404);
  }
}

async function existsByType(type: string, id: number) {
  switch (type) {
    case "inspections":
      return !!(await prisma.inspection.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "estimates":
      return !!(await prisma.estimate.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "joborders":
      return !!(await prisma.jobOrder.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "invoices":
      return !!(await prisma.invoice.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "payments":
      return !!(await prisma.payment.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "deposits":
      return !!(await prisma.deposit.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "quicksales":
      return !!(await prisma.quickSale.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "expenses":
      return !!(await prisma.expense.findUnique({ where: { Id: id }, select: { Id: true } }));
    case "pettycashvouchers":
      return !!(await prisma.pettyCash.findUnique({ where: { Id: id }, select: { Id: true } }));
    default:
      throw new OperationAccessServiceError("Unsupported operation type.", 404);
  }
}

async function updateOperationStatus(
  type: string,
  id: number,
  jobStatusId: number,
  actorUserId: number,
  updatedDateTime: Date,
) {
  switch (normalizeType(type)) {
    case "inspections":
      await prisma.inspection.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "estimates":
      await prisma.estimate.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "joborders":
      await prisma.jobOrder.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "invoices":
      await prisma.invoice.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "payments":
      await prisma.payment.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "deposits":
      await prisma.deposit.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "quicksales":
      await prisma.quickSale.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "expenses":
      await prisma.expense.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    case "pettycashvouchers":
      await prisma.pettyCash.update({ where: { Id: id }, data: { JobStatusId: jobStatusId, UpdatedById: actorUserId, UpdatedDateTime: updatedDateTime } });
      return;
    default:
      throw new OperationAccessServiceError("Unsupported operation type.", 404);
  }
}

function normalizeType(type: string) {
  const normalized = decodeURIComponent(type)
    .trim()
    .toLowerCase()
    .replaceAll("-", "")
    .replaceAll("_", "");

  const aliases: Record<string, string> = {
    inspection: "inspections",
    estimate: "estimates",
    joborder: "joborders",
    invoice: "invoices",
    payment: "payments",
    deposit: "deposits",
    quicksale: "quicksales",
    expense: "expenses",
    pettycash: "pettycashvouchers",
    pettycashvoucher: "pettycashvouchers",
  };

  return aliases[normalized] ?? normalized;
}
