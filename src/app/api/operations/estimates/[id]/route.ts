import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getCanEditPrice } from "@/server/management/service";
import {
  deleteEstimate,
  getEstimate,
  updateEstimate,
} from "@/server/operations/estimates";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type EstimateContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: EstimateContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const estimateId = parsePositiveInt(id);

  if (!estimateId) {
    return notFound();
  }

  const estimate = await getEstimate(estimateId);

  return estimate ? legacyJson(estimate) : notFound();
}

export async function PUT(request: Request, context: EstimateContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const estimateId = parsePositiveInt(id);

  if (!estimateId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateEstimate(
      estimateId,
      body,
      authorization.user.userId,
      await getCanEditPrice(authorization.user.userId),
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: EstimateContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const estimateId = parsePositiveInt(id);

  if (!estimateId) {
    return notFound();
  }

  try {
    const deleted = await deleteEstimate(
      estimateId,
      authorization.user.userId,
    );

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
