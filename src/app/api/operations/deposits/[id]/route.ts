import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteDeposit,
  getDeposit,
  updateDeposit,
} from "@/server/operations/deposits";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type DepositContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: DepositContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const depositId = parsePositiveInt(id);

  if (!depositId) {
    return notFound();
  }

  const deposit = await getDeposit(depositId);

  return deposit ? legacyJson(deposit) : notFound();
}

export async function PUT(request: Request, context: DepositContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const depositId = parsePositiveInt(id);

  if (!depositId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateDeposit(
      depositId,
      body,
      authorization.user.userId,
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: DepositContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const depositId = parsePositiveInt(id);

  if (!depositId) {
    return notFound();
  }

  try {
    const deleted = await deleteDeposit(depositId, authorization.user.userId);

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
