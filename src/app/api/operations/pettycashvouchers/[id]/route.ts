import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deletePettyCash,
  getPettyCash,
  updatePettyCash,
} from "@/server/operations/petty-cash";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type PettyCashContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: PettyCashContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const pettyCashId = parsePositiveInt(id);

  if (!pettyCashId) {
    return notFound();
  }

  const pettyCash = await getPettyCash(pettyCashId);

  return pettyCash ? legacyJson(pettyCash) : notFound();
}

export async function PUT(request: Request, context: PettyCashContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const pettyCashId = parsePositiveInt(id);

  if (!pettyCashId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updatePettyCash(
      pettyCashId,
      body,
      authorization.user.userId,
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: PettyCashContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const pettyCashId = parsePositiveInt(id);

  if (!pettyCashId) {
    return notFound();
  }

  try {
    const deleted = await deletePettyCash(pettyCashId);

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

