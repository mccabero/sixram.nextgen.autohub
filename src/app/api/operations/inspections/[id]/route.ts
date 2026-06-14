import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteInspection,
  getInspection,
  updateInspection,
} from "@/server/operations/inspections";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type InspectionContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: InspectionContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const inspectionId = parsePositiveInt(id);

  if (!inspectionId) {
    return notFound();
  }

  const inspection = await getInspection(inspectionId);

  return inspection ? legacyJson(inspection) : notFound();
}

export async function PUT(request: Request, context: InspectionContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const inspectionId = parsePositiveInt(id);

  if (!inspectionId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateInspection(
      inspectionId,
      body,
      authorization.user.userId,
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: InspectionContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const inspectionId = parsePositiveInt(id);

  if (!inspectionId) {
    return notFound();
  }

  try {
    const deleted = await deleteInspection(
      inspectionId,
      authorization.user.userId,
    );

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
