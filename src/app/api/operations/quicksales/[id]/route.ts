import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getCanEditPrice } from "@/server/management/service";
import {
  deleteQuickSale,
  getQuickSale,
  updateQuickSale,
} from "@/server/operations/quick-sales";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type QuickSaleContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: QuickSaleContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const quickSaleId = parsePositiveInt(id);

  if (!quickSaleId) {
    return notFound();
  }

  const quickSale = await getQuickSale(quickSaleId);

  return quickSale ? legacyJson(quickSale) : notFound();
}

export async function PUT(request: Request, context: QuickSaleContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const quickSaleId = parsePositiveInt(id);

  if (!quickSaleId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateQuickSale(
      quickSaleId,
      body,
      authorization.user.userId,
      await getCanEditPrice(authorization.user.userId),
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: QuickSaleContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const quickSaleId = parsePositiveInt(id);

  if (!quickSaleId) {
    return notFound();
  }

  try {
    const deleted = await deleteQuickSale(
      quickSaleId,
      authorization.user.userId,
    );

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
