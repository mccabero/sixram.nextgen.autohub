import { forbidden } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  hasAnyPermission,
  rbacManagePermission,
  rbacViewPermission,
} from "@/server/auth/rbac";
import { buildRbacSnapshot } from "@/server/rbac/service";

export const runtime = "nodejs";

const rbacReadPermissions = [
  rbacViewPermission,
  rbacManagePermission,
  "page.administrator.rbac.view",
];

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, []);

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (!(await hasAnyPermission(authorization.user.userId, rbacReadPermissions))) {
    return forbidden();
  }

  return legacyJson(await buildRbacSnapshot());
}
