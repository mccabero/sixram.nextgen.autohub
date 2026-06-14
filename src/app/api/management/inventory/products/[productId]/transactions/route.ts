import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getInventoryProductTransactions } from "@/server/management/service";

export const runtime = "nodejs";

type ProductTransactionsContext = {
  params: Promise<{
    productId: string;
  }>;
};

export async function GET(
  request: Request,
  context: ProductTransactionsContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { productId } = await context.params;
  const parsedProductId = parsePositiveInt(productId);

  if (!parsedProductId) {
    return notFound();
  }

  const transactions = await getInventoryProductTransactions(parsedProductId);

  return transactions ? legacyJson(transactions) : notFound();
}
