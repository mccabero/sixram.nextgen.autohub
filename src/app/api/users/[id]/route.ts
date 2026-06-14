import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteUser,
  getUser,
  updateUser,
} from "@/server/users/service";
import { userErrorResponse } from "@/server/users/route-helpers";

export const runtime = "nodejs";

type UserContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: UserContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const userId = parsePositiveInt(id);

  if (!userId) {
    return notFound();
  }

  const user = await getUser(userId);

  return user ? legacyJson(user) : notFound();
}

export async function PUT(request: Request, context: UserContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const userId = parsePositiveInt(id);

  if (!userId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateUser(userId, body, authorization.user.userId);
    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return userErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: UserContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const userId = parsePositiveInt(id);

  if (!userId) {
    return notFound();
  }

  try {
    await deleteUser(userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return userErrorResponse(error);
  }
}
