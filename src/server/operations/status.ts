import { prisma } from "@/server/db/prisma";

export async function getOrCreateDeletedJobStatusId(actorUserId: number) {
  return getOrCreateJobStatusId("DELETED", "Soft-deleted operation record", actorUserId);
}

export async function getOrCreateVoidJobStatusId(actorUserId: number) {
  return getOrCreateJobStatusId("VOID", "Voided operation record", actorUserId);
}

async function getOrCreateJobStatusId(
  name: string,
  description: string,
  actorUserId: number,
) {
  const existing = await prisma.jobStatus.findFirst({
    where: { Name: { equals: name, mode: "insensitive" } },
    select: { Id: true },
  });
  if (existing) return existing.Id;

  const now = new Date();
  const actorId = actorUserId > 0 ? actorUserId : 0;
  const created = await prisma.jobStatus.create({
    data: {
      Name: name,
      Description: description,
      CreatedById: actorId,
      CreatedDateTime: now,
      UpdatedById: actorId,
      UpdatedDateTime: now,
    },
    select: { Id: true },
  });

  return created.Id;
}

export async function findJobStatusId(...statusNames: string[]) {
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
