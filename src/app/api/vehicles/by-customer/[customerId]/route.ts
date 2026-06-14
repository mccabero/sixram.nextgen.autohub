import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getVehiclesByCustomer } from "@/server/vehicles/service";

export const runtime = "nodejs";

type VehiclesByCustomerContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(
  request: Request,
  context: VehiclesByCustomerContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { customerId } = await context.params;
  const parsedCustomerId = parsePositiveInt(customerId);

  if (!parsedCustomerId) {
    return badRequest("customerId is required");
  }

  const vehicles = await getVehiclesByCustomer(parsedCustomerId);

  return vehicles.length > 0 ? legacyJson(vehicles) : notFound();
}
