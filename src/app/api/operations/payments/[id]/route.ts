import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deletePayment,
  getPayment,
  updatePayment,
} from "@/server/operations/payments";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type PaymentContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: PaymentContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const paymentId = parsePositiveInt(id);

  if (!paymentId) {
    return notFound();
  }

  const payment = await getPayment(paymentId);

  return payment ? legacyJson(payment) : notFound();
}

export async function PUT(request: Request, context: PaymentContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const paymentId = parsePositiveInt(id);

  if (!paymentId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updatePayment(
      paymentId,
      body,
      authorization.user.userId,
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: PaymentContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const paymentId = parsePositiveInt(id);

  if (!paymentId) {
    return notFound();
  }

  try {
    const deleted = await deletePayment(paymentId, authorization.user.userId);

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
