import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { unlockJobOrderEditing } from "@/server/operations/access-control";
import { operationAccessErrorResponse } from "@/server/operations/access-route-helpers";

export const runtime = "nodejs";

type UnlockContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: UnlockContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const jobOrderId = parsePositiveInt((await context.params).id);

  if (!jobOrderId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(
      await unlockJobOrderEditing(
        jobOrderId,
        typeof body.code === "string" ? body.code : null,
        authorization.user.userId,
      ),
    );
  } catch (error) {
    return operationAccessErrorResponse(error);
  }
}

