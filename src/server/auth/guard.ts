import { NextResponse } from "next/server";
import {
  getBearerToken,
  getUserIdFromClaims,
  verifyJwt,
  type JarvisClaims,
} from "@/server/auth/claims";
import {
  canLoginPermission,
  getApiPermissionKeys,
  getEffectivePermissionKeys,
} from "@/server/auth/rbac";

export type AuthorizedApiUser = {
  userId: number;
  claims: JarvisClaims;
};

export type ApiAuthorizationResult =
  | {
      authorized: true;
      user: AuthorizedApiUser;
    }
  | {
      authorized: false;
      response: NextResponse;
    };

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function authorizeApiRequest(
  request: Request,
  requiredPermissions = getApiPermissionKeys(
    new URL(request.url).pathname,
    request.method,
  ),
): Promise<ApiAuthorizationResult> {
  const token = getBearerToken(request.headers.get("authorization"));

  if (!token) {
    return {
      authorized: false,
      response: error("Unauthorized", 401),
    };
  }

  try {
    const claims = await verifyJwt(token);
    const userId = getUserIdFromClaims(claims);

    if (!userId) {
      return {
        authorized: false,
        response: error("Forbidden", 403),
      };
    }

    const permissionKeys = await getEffectivePermissionKeys(userId);

    if (!permissionKeys.has(canLoginPermission)) {
      return {
        authorized: false,
        response: error("Your account is not allowed to sign in.", 403),
      };
    }

    if (
      requiredPermissions.length > 0 &&
      !requiredPermissions.every((permission) => permissionKeys.has(permission))
    ) {
      return {
        authorized: false,
        response: error("Forbidden", 403),
      };
    }

    return {
      authorized: true,
      user: {
        userId,
        claims,
      },
    };
  } catch {
    return {
      authorized: false,
      response: error("Unauthorized", 401),
    };
  }
}
