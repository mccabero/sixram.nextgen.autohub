import { readJsonRecord } from "@/server/api/body";
import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  createInventoryCheck,
  listInventoryChecks,
} from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    return legacyJson(
      await listInventoryChecks(new URL(request.url).searchParams),
    );
  } catch (error) {
    return managementErrorResponse(error);
  }
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
      await createInventoryCheck(body, authorization.user.userId),
      { status: 201 },
    );
  } catch (error) {
    return managementErrorResponse(error);
  }
}
