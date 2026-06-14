import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getNextJobOrderReferenceNo } from "@/server/operations/job-orders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(await getNextJobOrderReferenceNo());
}
