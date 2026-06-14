import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getEffectivePermissionKeys } from "@/server/auth/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, []);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const permissionKeys = [...(await getEffectivePermissionKeys(authorization.user.userId))].sort();

  return legacyJson({ permissionKeys });
}
