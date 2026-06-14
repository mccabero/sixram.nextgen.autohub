import { readJsonRecord } from "@/server/api/body";
import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getCanEditPrice } from "@/server/management/service";
import {
  createEstimate,
  listEstimates,
} from "@/server/operations/estimates";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(await listEstimates());
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
      await createEstimate(
        body,
        authorization.user.userId,
        await getCanEditPrice(authorization.user.userId),
      ),
      { status: 201 },
    );
  } catch (error) {
    return operationErrorResponse(error);
  }
}
