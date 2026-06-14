import { readJsonRecord } from "@/server/api/body";
import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { createUser, listUsers } from "@/server/users/service";
import { userErrorResponse } from "@/server/users/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(await listUsers());
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(
      await createUser(body, authorization.user.userId),
      { status: 201 },
    );
  } catch (error) {
    return userErrorResponse(error);
  }
}
