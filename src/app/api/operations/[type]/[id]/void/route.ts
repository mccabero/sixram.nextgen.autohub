import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { voidOperationRecord } from "@/server/operations/access-control";
import { operationAccessErrorResponse } from "@/server/operations/access-route-helpers";

export const runtime = "nodejs";

type VoidContext = {
  params: Promise<{
    type: string;
    id: string;
  }>;
};

export async function POST(request: Request, context: VoidContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { type, id } = await context.params;
  const operationId = parsePositiveInt(id);

  if (!operationId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(
      await voidOperationRecord(
        type,
        operationId,
        typeof body.code === "string" ? body.code : null,
        authorization.user.userId,
      ),
    );
  } catch (error) {
    return operationAccessErrorResponse(error);
  }
}

