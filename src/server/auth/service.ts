import { prisma } from "@/server/db/prisma";
import { issueJwt, type IssuedToken, type JwtUser } from "@/server/auth/claims";
import { hashSecret, verifySecret } from "@/server/auth/password-hasher";
import { canSignIn } from "@/server/auth/rbac";

const sixDigitPinPattern = /^\d{6}$/;
const inactiveAccountMessage =
  "Your account is inactive. Please contact an administrator.";
const cannotLoginMessage =
  "Your account is not allowed to sign in. Please contact an administrator.";

const authUserSelect = {
  Id: true,
  Email: true,
  PasswordHash: true,
  Salt: true,
  PinHash: true,
  PinSalt: true,
  RoleId: true,
  Firstname: true,
  MiddleName: true,
  LastName: true,
  IsActive: true,
  Role: {
    select: {
      Name: true,
    },
  },
  UserRolesAsUser: {
    select: {
      Role: {
        select: {
          Name: true,
        },
      },
    },
  },
} as const;

type AuthUser = {
  Id: number;
  Email: string;
  PasswordHash: string;
  Salt: string;
  PinHash: string;
  PinSalt: string;
  RoleId: number;
  Firstname: string;
  MiddleName: string | null;
  LastName: string;
  IsActive: boolean;
  Role: { Name: string } | null;
  UserRolesAsUser: Array<{ Role: { Name: string } }>;
};

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export type LoginInput = {
  email?: string | null;
  password?: string | null;
  pin?: string | null;
};

export type ForgotPinInput = {
  username?: string | null;
  password?: string | null;
  newPin?: string | null;
  confirmPin?: string | null;
};

function unauthorized(message = "Invalid credentials") {
  return new AuthServiceError(message, 401);
}

function badRequest(message: string) {
  return new AuthServiceError(message, 400);
}

function toJwtUser(user: AuthUser): JwtUser {
  return {
    Id: user.Id,
    Email: user.Email,
    RoleId: user.RoleId,
    Firstname: user.Firstname,
    MiddleName: user.MiddleName,
    LastName: user.LastName,
  };
}

function getRoleNames(user: AuthUser) {
  const roleNames = [
    user.Role?.Name,
    ...user.UserRolesAsUser.map((userRole) => userRole.Role.Name),
  ].filter((roleName): roleName is string => Boolean(roleName?.trim()));

  return [
    ...new Map(
      roleNames.map((roleName) => [roleName.toLowerCase(), roleName]),
    ).values(),
  ];
}

async function getUserByEmail(email: string, activeOnly: boolean) {
  return prisma.user.findFirst({
    where: {
      Email: {
        equals: email.trim(),
        mode: "insensitive",
      },
      ...(activeOnly ? { IsActive: true } : {}),
    },
    select: authUserSelect,
  });
}

async function assertCanLogin(user: AuthUser) {
  if (!(await canSignIn(user.Id))) {
    throw unauthorized(cannotLoginMessage);
  }
}

export async function login(input: LoginInput): Promise<IssuedToken> {
  const usePin = Boolean(input.pin?.trim());

  if (usePin) {
    const pin = input.pin ?? "";

    if (!sixDigitPinPattern.test(pin)) {
      throw unauthorized();
    }

    const candidates = await prisma.user.findMany({
      where: { IsActive: true },
      select: authUserSelect,
    });
    const matches: AuthUser[] = [];

    for (const candidate of candidates) {
      if (verifySecret(pin, candidate.PinHash, candidate.PinSalt)) {
        matches.push(candidate);
      }
    }

    if (matches.length === 0) {
      throw unauthorized();
    }

    if (matches.length > 1) {
      throw unauthorized(
        "PIN is assigned to multiple users. Please sign in with password or ask an administrator to assign unique PINs.",
      );
    }

    const user = matches[0];
    await assertCanLogin(user);

    return issueJwt(toJwtUser(user), getRoleNames(user));
  }

  if (!input.email?.trim() || !input.password?.trim()) {
    throw unauthorized();
  }

  const user = await getUserByEmail(input.email, true);
  if (!user) {
    throw unauthorized();
  }

  if (!verifySecret(input.password, user.PasswordHash, user.Salt)) {
    throw unauthorized();
  }

  if (!user.IsActive) {
    throw unauthorized(inactiveAccountMessage);
  }

  await assertCanLogin(user);

  return issueJwt(toJwtUser(user), getRoleNames(user));
}

export async function resetPin(input: ForgotPinInput) {
  if (!input.username?.trim() || !input.password?.trim()) {
    throw unauthorized();
  }

  const newPin = input.newPin?.trim() ?? "";
  const confirmPin = input.confirmPin?.trim() ?? "";

  if (newPin !== confirmPin) {
    throw badRequest("PIN and Confirm PIN do not match.");
  }

  if (!sixDigitPinPattern.test(newPin)) {
    throw badRequest("PIN must be exactly 6 numbers.");
  }

  const user = await getUserByEmail(input.username, false);

  if (!user) {
    throw unauthorized();
  }

  if (!user.IsActive) {
    throw unauthorized(inactiveAccountMessage);
  }

  if (!verifySecret(input.password, user.PasswordHash, user.Salt)) {
    throw unauthorized();
  }

  const activeUsers = await prisma.user.findMany({
    where: {
      IsActive: true,
      NOT: { Id: user.Id },
    },
    select: {
      PinHash: true,
      PinSalt: true,
    },
  });
  const duplicate = activeUsers.some((activeUser) =>
    verifySecret(newPin, activeUser.PinHash, activeUser.PinSalt),
  );

  if (duplicate) {
    throw badRequest("PIN is already assigned to another active user.");
  }

  const hashedPin = hashSecret(newPin);

  await prisma.user.update({
    where: { Id: user.Id },
    data: {
      PinHash: hashedPin.hash,
      PinSalt: hashedPin.salt,
    },
  });
}
