import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getManufacturerProducts } from "@/server/management/service";

export const runtime = "nodejs";

type ManufacturerProductsContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: ManufacturerProductsContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const manufacturerId = parsePositiveInt(id);

  if (!manufacturerId) {
    return notFound();
  }

  const products = await getManufacturerProducts(manufacturerId);

  return products ? legacyJson(products) : notFound();
}
