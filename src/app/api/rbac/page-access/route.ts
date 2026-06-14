import { getQueryParam } from "@/server/api/params";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  hasPermission,
  isPublicPage,
  resolvePagePermission,
} from "@/server/auth/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, []);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const path = getQueryParam(request, "path");
  const permissionKey = resolvePagePermission(path);

  if (!permissionKey) {
    return legacyJson({
      allowed: isPublicPage(path),
      permissionKey: null,
    });
  }

  return legacyJson({
    allowed: await hasPermission(authorization.user.userId, permissionKey),
    permissionKey,
  });
}
