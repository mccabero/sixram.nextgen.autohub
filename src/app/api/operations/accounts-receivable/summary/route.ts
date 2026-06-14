import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { listAccountsReceivable } from "@/server/operations/invoices";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    return legacyJson(
      await listAccountsReceivable(new URL(request.url).searchParams),
    );
  } catch (error) {
    return operationErrorResponse(error);
  }
}
