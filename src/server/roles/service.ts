import { prisma } from "@/server/db/prisma";

export type RoleMutationInput = {
  name: string;
  description: string | null;
  actorUserId: number;
  createdById?: number | null;
  updatedById?: number | null;
};

export class RoleServiceError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(
    message: string,
    status = 400,
    body: Record<string, unknown> = { error: message },
  ) {
    super(message);
    this.name = "RoleServiceError";
    this.status = status;
    this.body = body;
  }
}

function mapRole(role: {
  Id: number;
  Name: string;
  Description: string | null;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
}) {
  return {
    id: role.Id,
    name: role.Name,
    description: role.Description,
    createdById: role.CreatedById,
    createdDateTime: role.CreatedDateTime,
    updatedById: role.UpdatedById,
    updatedDateTime: role.UpdatedDateTime,
  };
}

export async function getRoles() {
  const roles = await prisma.role.findMany({
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      Name: true,
      Description: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      UpdatedDateTime: true,
    },
  });

  return roles.map(mapRole);
}

export async function getRoleById(id: number) {
  const role = await prisma.role.findUnique({
    where: { Id: id },
    select: {
      Id: true,
      Name: true,
      Description: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      UpdatedDateTime: true,
    },
  });

  if (!role) {
    return null;
  }

  const assignedUserIds = await prisma.userRole.findMany({
    where: { RoleId: id },
    select: { UserId: true },
    distinct: ["UserId"],
  });
  const assignedUserIdSet = new Set(
    assignedUserIds.map((assignedUser) => assignedUser.UserId),
  );
  const assignedUsers = await prisma.user.findMany({
    where: {
      OR: [{ RoleId: id }, { Id: { in: [...assignedUserIdSet] } }],
    },
    orderBy: [{ Firstname: "asc" }, { LastName: "asc" }, { Email: "asc" }],
    select: {
      Id: true,
      Email: true,
      Firstname: true,
      MiddleName: true,
      LastName: true,
      IsActive: true,
      RoleId: true,
    },
  });

  return {
    ...mapRole(role),
    assignedUsers: assignedUsers.map((user) => ({
      id: user.Id,
      email: user.Email,
      name: [user.Firstname, user.MiddleName, user.LastName]
        .filter((part) => part?.trim())
        .join(" ")
        .trim(),
      isActive: user.IsActive,
      isPrimaryRole: user.RoleId === id,
      isAssignedRole: assignedUserIdSet.has(user.Id),
    })),
  };
}

export async function createRole(input: RoleMutationInput) {
  const now = new Date();
  const actorUserId = normalizeActorId(input.actorUserId) ?? 0;
  const role = await prisma.role.create({
    data: {
      Name: input.name,
      Description: input.description,
      CreatedById: normalizeActorId(input.createdById) ?? actorUserId,
      CreatedDateTime: now,
      UpdatedById: normalizeActorId(input.updatedById) ?? actorUserId,
      UpdatedDateTime: now,
    },
    select: {
      Id: true,
      Name: true,
      Description: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      UpdatedDateTime: true,
    },
  });

  return mapRole(role);
}

export async function updateRole(id: number, input: RoleMutationInput) {
  const existing = await prisma.role.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) {
    throw new RoleServiceError("Role not found.", 404, {});
  }

  await prisma.role.update({
    where: { Id: id },
    data: {
      Name: input.name,
      Description: input.description,
      UpdatedById:
        normalizeActorId(input.updatedById) ??
        normalizeActorId(input.actorUserId) ??
        0,
      UpdatedDateTime: new Date(),
    },
  });
}

export async function deleteRole(id: number) {
  const existing = await prisma.role.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) {
    throw new RoleServiceError("Role not found.", 404, {});
  }

  const primaryUserCount = await prisma.user.count({
    where: { RoleId: id },
  });

  if (primaryUserCount > 0) {
    const message =
      primaryUserCount === 1
        ? "This role is still assigned as a primary role to 1 user. Reassign that user before deleting the role."
        : `This role is still assigned as a primary role to ${primaryUserCount} users. Reassign those users before deleting the role.`;

    throw new RoleServiceError(
      message,
      400,
      { message },
    );
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({
      where: { RoleId: id },
    }),
    prisma.rolePermission.deleteMany({
      where: { RoleId: id },
    }),
    prisma.role.delete({
      where: { Id: id },
    }),
  ]);
}

function normalizeActorId(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}
