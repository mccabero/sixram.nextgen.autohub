import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getSupplierProducts } from "@/server/management/service";

export const runtime = "nodejs";

type SupplierProductsContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: SupplierProductsContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const supplierId = parsePositiveInt(id);

  if (!supplierId) {
    return notFound();
  }

  const products = await getSupplierProducts(supplierId);

  return products ? legacyJson(products) : notFound();
}
