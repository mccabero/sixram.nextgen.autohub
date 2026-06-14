import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { getQueryParam } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getVehicleByPlate } from "@/server/vehicles/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const plate = getQueryParam(request, "plate")?.trim();

  if (!plate) {
    return badRequest("plate is required");
  }

  const vehicle = await getVehicleByPlate(plate);

  return vehicle ? legacyJson(vehicle) : notFound();
}
