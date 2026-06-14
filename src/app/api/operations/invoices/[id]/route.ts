import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteInvoice,
  getInvoice,
  updateInvoice,
} from "@/server/operations/invoices";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type InvoiceContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: InvoiceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const invoiceId = parsePositiveInt(id);

  if (!invoiceId) {
    return notFound();
  }

  const invoice = await getInvoice(invoiceId);

  return invoice ? legacyJson(invoice) : notFound();
}

export async function PUT(request: Request, context: InvoiceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const invoiceId = parsePositiveInt(id);

  if (!invoiceId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateInvoice(
      invoiceId,
      body,
      authorization.user.userId,
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: InvoiceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const invoiceId = parsePositiveInt(id);

  if (!invoiceId) {
    return notFound();
  }

  try {
    const deleted = await deleteInvoice(invoiceId, authorization.user.userId);

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
