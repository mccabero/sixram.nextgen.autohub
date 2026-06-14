import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getVehicleModelApplicableProducts } from "@/server/config/reference-data";

export const runtime = "nodejs";

type ApplicableProductsContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: ApplicableProductsContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const vehicleModelId = parsePositiveInt(id);

  if (!vehicleModelId) {
    return notFound();
  }

  const items = await getVehicleModelApplicableProducts(vehicleModelId);

  return items ? legacyJson(items) : notFound();
}
