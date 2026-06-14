import { randomInt } from "node:crypto";
import { hashSecret, verifySecret } from "@/server/auth/password-hasher";
import { prisma } from "@/server/db/prisma";

const sixDigitPattern = /^\d{6}$/;

type VoidCodeErrorBody =
  | string
  | {
      [key: string]: string | number | boolean | null;
    };

export type OperationAccessCodeResolutionStatus =
  | "Success"
  | "MissingCode"
  | "InvalidFormat"
  | "InvalidExpiredOrUsed";

export class VoidCodeServiceError extends Error {
  readonly status: number;
  readonly body: VoidCodeErrorBody;

  constructor(
    message: string,
    status = 400,
    body: VoidCodeErrorBody = { error: message },
  ) {
    super(message);
    this.name = "VoidCodeServiceError";
    this.status = status;
    this.body = body;
  }
}

export async function listVoidCodes(take: number) {
  const safeTake = Math.min(Math.max(Number.isInteger(take) ? take : 25, 1), 100);
  const now = new Date();
  const rows = await prisma.operationAccessCode.findMany({
    orderBy: [{ GeneratedDateTime: "desc" }, { Id: "desc" }],
    take: safeTake,
    select: {
      Id: true,
      CodeValue: true,
      CodeSuffix: true,
      GeneratedById: true,
      GeneratedDateTime: true,
      ExpiresAt: true,
      UsedById: true,
      UsedDateTime: true,
      UsedForAction: true,
      UsedForReferenceId: true,
    },
  });

  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.GeneratedById, row.UsedById ?? 0])
        .filter((userId) => userId > 0),
    ),
  ];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { Id: { in: userIds } },
        select: {
          Id: true,
          Email: true,
          Firstname: true,
          LastName: true,
        },
      })
    : [];
  const userNameById = new Map(
    users.map((user) => [user.Id, userDisplayName(user)]),
  );

  return rows.map((row) => ({
    id: row.Id,
    code: row.CodeValue,
    maskedCode: formatMaskedCode(row.CodeSuffix),
    generatedById: row.GeneratedById,
    generatedByName: userNameById.get(row.GeneratedById) ?? null,
    generatedDateTime: row.GeneratedDateTime,
    expiresAt: row.ExpiresAt,
    usedById: row.UsedById,
    usedByName: row.UsedById ? userNameById.get(row.UsedById) ?? null : null,
    usedDateTime: row.UsedDateTime,
    usedForAction: row.UsedForAction,
    usedForReferenceId: row.UsedForReferenceId,
    status: row.UsedDateTime ? "USED" : row.ExpiresAt <= now ? "EXPIRED" : "ACTIVE",
  }));
}

export async function generateVoidCode(
  generatedById: number,
  expiresInMinutes: number,
) {
  if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > 1440) {
    throw new VoidCodeServiceError(
      "Expiration time must be between 1 and 1440 minutes.",
      400,
      "Expiration time must be between 1 and 1440 minutes.",
    );
  }

  const now = new Date();
  const activeCodes = await prisma.operationAccessCode.findMany({
    where: {
      UsedDateTime: null,
      ExpiresAt: { gt: now },
    },
    select: {
      CodeHash: true,
      CodeSalt: true,
    },
  });

  let plainCode = "";
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const duplicateExists = activeCodes.some((existing) =>
      verifySecret(candidate, existing.CodeHash, existing.CodeSalt),
    );

    if (!duplicateExists) {
      plainCode = candidate;
      break;
    }
  }

  if (!plainCode) {
    throw new VoidCodeServiceError(
      "Unable to generate a unique 6-digit code. Please try again.",
      500,
    );
  }

  const hashed = hashSecret(plainCode);
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60_000);
  const row = await prisma.operationAccessCode.create({
    data: {
      CodeHash: hashed.hash,
      CodeSalt: hashed.salt,
      CodeSuffix: plainCode.slice(-2),
      CodeValue: plainCode,
      GeneratedById: generatedById,
      GeneratedDateTime: now,
      ExpiresAt: expiresAt,
    },
    select: {
      Id: true,
      GeneratedDateTime: true,
      ExpiresAt: true,
      CodeSuffix: true,
    },
  });

  return {
    id: row.Id,
    code: plainCode,
    maskedCode: formatMaskedCode(row.CodeSuffix),
    expiresInMinutes,
    generatedDateTime: row.GeneratedDateTime,
    expiresAt: row.ExpiresAt,
  };
}

export async function resolveActiveVoidCode(code: string | null | undefined) {
  if (!code?.trim()) {
    return { status: "MissingCode" as OperationAccessCodeResolutionStatus };
  }

  const normalizedCode = code.trim();
  if (!sixDigitPattern.test(normalizedCode)) {
    return { status: "InvalidFormat" as OperationAccessCodeResolutionStatus };
  }

  const now = new Date();
  const activeCodes = await prisma.operationAccessCode.findMany({
    where: {
      UsedDateTime: null,
      ExpiresAt: { gt: now },
    },
    select: {
      Id: true,
      CodeHash: true,
      CodeSalt: true,
    },
  });
  const match = activeCodes.find((item) =>
    verifySecret(normalizedCode, item.CodeHash, item.CodeSalt),
  );

  return match
    ? {
        status: "Success" as OperationAccessCodeResolutionStatus,
        codeId: match.Id,
      }
    : {
        status: "InvalidExpiredOrUsed" as OperationAccessCodeResolutionStatus,
      };
}

export async function consumeVoidCode(
  codeId: number,
  usedById: number,
  usedForAction: string,
  usedForReferenceId?: number | null,
) {
  const now = new Date();
  const result = await prisma.operationAccessCode.updateMany({
    where: {
      Id: codeId,
      UsedDateTime: null,
      ExpiresAt: { gt: now },
    },
    data: {
      UsedById: usedById,
      UsedDateTime: now,
      UsedForAction: usedForAction,
      UsedForReferenceId: usedForReferenceId ?? null,
    },
  });

  return result.count > 0;
}

export function formatMaskedCode(codeSuffix: string | null | undefined) {
  if (!codeSuffix?.trim()) return "******";
  const suffix = codeSuffix.trim();
  return suffix.length >= 2 ? `****${suffix.slice(-2)}` : `*****${suffix}`;
}

function userDisplayName(user: {
  Id: number;
  Email: string;
  Firstname: string;
  LastName: string;
}) {
  const fullName = [user.Firstname, user.LastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || user.Email || `User #${user.Id}`;
}
