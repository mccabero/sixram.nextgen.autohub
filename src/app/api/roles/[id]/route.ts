import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { readRoleMutationInput } from "@/server/roles/request";
import {
  deleteRole,
  getRoleById,
  RoleServiceError,
  updateRole,
} from "@/server/roles/service";

export const runtime = "nodejs";

type RoleRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RoleRouteContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const roleId = parsePositiveInt(id);

  if (!roleId) {
    return notFound();
  }

  const role = await getRoleById(roleId);

  if (!role) {
    return notFound();
  }

  return legacyJson(role);
}

export async function PUT(request: Request, context: RoleRouteContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const roleId = parsePositiveInt(id);

  if (!roleId) {
    return notFound();
  }

  const input = await readRoleMutationInput(request, authorization.user.userId);

  if (!input) {
    return badRequest("Role name is required.");
  }

  try {
    await updateRole(roleId, input);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof RoleServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}

export async function DELETE(request: Request, context: RoleRouteContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const roleId = parsePositiveInt(id);

  if (!roleId) {
    return notFound();
  }

  try {
    await deleteRole(roleId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof RoleServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
