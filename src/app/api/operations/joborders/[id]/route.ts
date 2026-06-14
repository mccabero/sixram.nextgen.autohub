import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteJobOrder,
  getJobOrder,
  updateJobOrder,
} from "@/server/operations/job-orders";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type JobOrderContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: JobOrderContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const jobOrderId = parsePositiveInt(id);

  if (!jobOrderId) {
    return notFound();
  }

  const jobOrder = await getJobOrder(jobOrderId);

  return jobOrder ? legacyJson(jobOrder) : notFound();
}

export async function PUT(request: Request, context: JobOrderContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const jobOrderId = parsePositiveInt(id);

  if (!jobOrderId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateJobOrder(
      jobOrderId,
      body,
      authorization.user.userId,
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: JobOrderContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const jobOrderId = parsePositiveInt(id);

  if (!jobOrderId) {
    return notFound();
  }

  try {
    const deleted = await deleteJobOrder(
      jobOrderId,
      authorization.user.userId,
    );

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
