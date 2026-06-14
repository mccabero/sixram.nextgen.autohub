import { readJsonRecord } from "@/server/api/body";
import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { proceedInvoiceToPayment } from "@/server/operations/payments";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type InvoicePaymentContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: InvoicePaymentContext) {
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
    const result = await proceedInvoiceToPayment(
      invoiceId,
      await readJsonRecord(request),
    );

    return result ? legacyJson(result) : notFound("Invoice record was not found.");
  } catch (error) {
    return operationErrorResponse(error);
  }
}
