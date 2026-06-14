import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { listJobOrdersByProduct } from "@/server/operations/job-orders";

export const runtime = "nodejs";

type JobOrdersByProductContext = {
  params: Promise<{
    productId: string;
  }>;
};

export async function GET(
  request: Request,
  context: JobOrdersByProductContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { productId } = await context.params;
  const parsedProductId = parsePositiveInt(productId);

  if (!parsedProductId) {
    return badRequest("productId is required");
  }

  return legacyJson(await listJobOrdersByProduct(parsedProductId));
}
