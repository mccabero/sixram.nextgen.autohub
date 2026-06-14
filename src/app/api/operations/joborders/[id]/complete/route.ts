import { readJsonRecord } from "@/server/api/body";
import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { completeJobOrderAsInvoice } from "@/server/operations/invoices";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type JobOrderCompleteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: JobOrderCompleteContext) {
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
    const result = await completeJobOrderAsInvoice(
      jobOrderId,
      await readJsonRecord(request),
      authorization.user.userId,
    );

    return result ? legacyJson(result) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}
