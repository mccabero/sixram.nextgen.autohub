import { legacyJson } from "@/server/api/legacy-json";
import { badRequest, serverError } from "@/server/api/errors";
import { authorizeApiRequest } from "@/server/auth/guard";
import { readRoleMutationInput } from "@/server/roles/request";
import {
  createRole,
  getRoles,
  RoleServiceError,
} from "@/server/roles/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(await getRoles());
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const input = await readRoleMutationInput(request, authorization.user.userId);

  if (!input) {
    return badRequest("Role name is required.");
  }

  try {
    return legacyJson(await createRole(input), { status: 201 });
  } catch (error) {
    if (error instanceof RoleServiceError) {
      return legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
