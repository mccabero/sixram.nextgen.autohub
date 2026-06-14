import { prisma } from "@/server/db/prisma";
import {
  canLoginPermission,
  rbacManagePermission,
} from "@/server/auth/rbac";

export type RbacRolePermissionInput = {
  roleId: number;
  permissionId: number;
  allowed: boolean;
};

export type RbacSaveInput = {
  userId: number;
  primaryRoleId: number;
  assignedRoleIds: number[];
  rolePermissions: RbacRolePermissionInput[];
};

export class RbacSaveError extends Error {
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = "RbacSaveError";
    this.status = status;
    this.details = details;
  }
}

export async function buildRbacSnapshot() {
  const [roles, permissions, users, userRoles, rolePermissions] =
    await Promise.all([
      prisma.role.findMany({
        orderBy: { Name: "asc" },
        select: {
          Id: true,
          Name: true,
          Description: true,
        },
      }),
      prisma.permission.findMany({
        orderBy: [
          { Group: "asc" },
          { Name: "asc" },
        ],
        select: {
          Id: true,
          Key: true,
          Name: true,
          Group: true,
        },
      }),
      prisma.user.findMany({
        orderBy: [{ Firstname: "asc" }, { LastName: "asc" }, { Email: "asc" }],
        select: {
          Id: true,
          Email: true,
          Firstname: true,
          LastName: true,
          RoleId: true,
          IsActive: true,
        },
      }),
      prisma.userRole.findMany({
        select: {
          UserId: true,
          RoleId: true,
        },
      }),
      prisma.rolePermission.findMany({
        orderBy: [{ RoleId: "asc" }, { PermissionId: "asc" }],
        select: {
          RoleId: true,
          PermissionId: true,
          Allowed: true,
        },
      }),
    ]);

  const roleIdsByUserId = new Map<number, Set<number>>();

  for (const userRole of userRoles) {
    const roleIds = roleIdsByUserId.get(userRole.UserId) ?? new Set<number>();
    roleIds.add(userRole.RoleId);
    roleIdsByUserId.set(userRole.UserId, roleIds);
  }

  return {
    users: users.map((user) => {
      const roleIds = roleIdsByUserId.get(user.Id) ?? new Set<number>();
      roleIds.add(user.RoleId);
      const name = [user.Firstname, user.LastName]
        .filter((part) => part?.trim())
        .join(" ")
        .trim();

      return {
        id: user.Id,
        email: user.Email,
        name: name || user.Email,
        primaryRoleId: user.RoleId,
        roleIds: [...roleIds].filter((roleId) => roleId > 0),
        isActive: user.IsActive,
      };
    }),
    roles: roles.map((role) => ({
      id: role.Id,
      name: role.Name,
      description: role.Description,
    })),
    permissions: permissions
      .sort((left, right) => {
        const groupOrder = (group: string) =>
          group === "Management Permission" ? 0 : group === "Page Access" ? 1 : 2;
        const groupCompare = groupOrder(left.Group) - groupOrder(right.Group);
        return groupCompare || left.Name.localeCompare(right.Name);
      })
      .map((permission) => ({
        id: permission.Id,
        key: permission.Key,
        name: permission.Name,
        group: permission.Group,
      })),
    rolePermissions: rolePermissions.map((rolePermission) => ({
      roleId: rolePermission.RoleId,
      permissionId: rolePermission.PermissionId,
      allowed: rolePermission.Allowed,
    })),
  };
}

export async function saveRbacConfig(actorUserId: number, input: RbacSaveInput) {
  if (!Number.isInteger(input.userId) || input.userId <= 0) {
    throw new RbacSaveError("A valid user is required.");
  }

  if (!Number.isInteger(input.primaryRoleId) || input.primaryRoleId <= 0) {
    throw new RbacSaveError("A valid primary role is required.");
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const user = await tx.user.findUnique({
      where: { Id: input.userId },
      select: { Id: true },
    });

    if (!user) {
      throw new RbacSaveError("User not found.", 404);
    }

    const requestedRoleIds = [
      input.primaryRoleId,
      ...input.assignedRoleIds,
    ].filter((roleId) => Number.isInteger(roleId) && roleId > 0);
    const distinctRequestedRoleIds = [...new Set(requestedRoleIds)];

    const matrix = new Map<string, RbacRolePermissionInput>();
    for (const item of input.rolePermissions) {
      if (
        Number.isInteger(item.roleId) &&
        item.roleId > 0 &&
        Number.isInteger(item.permissionId) &&
        item.permissionId > 0
      ) {
        matrix.set(`${item.roleId}:${item.permissionId}`, item);
      }
    }

    const matrixItems = [...matrix.values()];
    const allRoleIds = [
      ...new Set([
        ...distinctRequestedRoleIds,
        ...matrixItems.map((item) => item.roleId),
      ]),
    ];

    const existingRoles = await tx.role.findMany({
      where: { Id: { in: allRoleIds } },
      select: { Id: true },
    });
    const existingRoleIds = new Set(existingRoles.map((role) => role.Id));
    const missingRoleIds = allRoleIds.filter((roleId) => !existingRoleIds.has(roleId));

    if (missingRoleIds.length > 0) {
      throw new RbacSaveError("One or more role IDs are invalid.", 400, {
        roleIds: missingRoleIds,
      });
    }

    const permissionIds = [
      ...new Set(matrixItems.map((item) => item.permissionId)),
    ];
    const existingPermissions = await tx.permission.findMany({
      where: { Id: { in: permissionIds } },
      select: { Id: true },
    });
    const existingPermissionIds = new Set(
      existingPermissions.map((permission) => permission.Id),
    );
    const missingPermissionIds = permissionIds.filter(
      (permissionId) => !existingPermissionIds.has(permissionId),
    );

    if (missingPermissionIds.length > 0) {
      throw new RbacSaveError("One or more permission IDs are invalid.", 400, {
        permissionIds: missingPermissionIds,
      });
    }

    await tx.user.update({
      where: { Id: input.userId },
      data: {
        RoleId: input.primaryRoleId,
        UpdatedById: actorUserId,
        UpdatedDateTime: now,
      },
    });

    await tx.userRole.deleteMany({
      where: { UserId: input.userId },
    });

    if (distinctRequestedRoleIds.length > 0) {
      await tx.userRole.createMany({
        data: distinctRequestedRoleIds.map((roleId) => ({
          UserId: input.userId,
          RoleId: roleId,
          CreatedById: actorUserId,
          CreatedDateTime: now,
          UpdatedById: actorUserId,
          UpdatedDateTime: now,
        })),
      });
    }

    if (matrixItems.length > 0) {
      const roleIds = [...new Set(matrixItems.map((item) => item.roleId))];
      const rolePermissionIds = [
        ...new Set(matrixItems.map((item) => item.permissionId)),
      ];
      const existingRolePermissions = await tx.rolePermission.findMany({
        where: {
          RoleId: { in: roleIds },
          PermissionId: { in: rolePermissionIds },
        },
        select: {
          Id: true,
          RoleId: true,
          PermissionId: true,
        },
      });
      const existingMap = new Map(
        existingRolePermissions.map((item) => [
          `${item.RoleId}:${item.PermissionId}`,
          item.Id,
        ]),
      );

      for (const item of matrixItems) {
        const id = existingMap.get(`${item.roleId}:${item.permissionId}`);

        if (id) {
          await tx.rolePermission.update({
            where: { Id: id },
            data: {
              Allowed: item.allowed,
              UpdatedById: actorUserId,
              UpdatedDateTime: now,
            },
          });
          continue;
        }

        await tx.rolePermission.create({
          data: {
            RoleId: item.roleId,
            PermissionId: item.permissionId,
            Allowed: item.allowed,
            CreatedById: actorUserId,
            CreatedDateTime: now,
            UpdatedById: actorUserId,
            UpdatedDateTime: now,
          },
        });
      }
    }

    const actor = await tx.user.findUnique({
      where: { Id: actorUserId },
      select: { RoleId: true },
    });
    const actorUserRoles = await tx.userRole.findMany({
      where: { UserId: actorUserId },
      select: { RoleId: true },
    });
    const actorRoleIds = [
      ...new Set(
        [actor?.RoleId, ...actorUserRoles.map((userRole) => userRole.RoleId)]
          .filter((roleId): roleId is number => !!roleId && roleId > 0),
      ),
    ];

    const actorPermissions = await tx.rolePermission.findMany({
      where: {
        RoleId: { in: actorRoleIds },
        Allowed: true,
        Permission: {
          Key: {
            in: [
              canLoginPermission,
              rbacManagePermission,
              "page.administrator.rbac.view",
            ],
          },
        },
      },
      select: {
        Permission: {
          select: {
            Key: true,
          },
        },
      },
    });
    const actorPermissionKeys = new Set(
      actorPermissions.map((permission) => permission.Permission.Key),
    );

    if (
      !actorPermissionKeys.has(canLoginPermission) ||
      !actorPermissionKeys.has(rbacManagePermission) ||
      !actorPermissionKeys.has("page.administrator.rbac.view")
    ) {
      throw new RbacSaveError(
        "Save blocked because it would remove your ability to manage RBAC.",
      );
    }
  });

  return buildRbacSnapshot();
}
