import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteVehicle,
  getVehicle,
  updateVehicle,
  VehicleServiceError,
} from "@/server/vehicles/service";

export const runtime = "nodejs";

type VehicleContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: VehicleContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const vehicleId = parsePositiveInt(id);

  if (!vehicleId) {
    return notFound();
  }

  const vehicle = await getVehicle(vehicleId);

  return vehicle ? legacyJson(vehicle) : notFound();
}

export async function PUT(request: Request, context: VehicleContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const vehicleId = parsePositiveInt(id);

  if (!vehicleId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    await updateVehicle(vehicleId, body, authorization.user.userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof VehicleServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}

export async function DELETE(request: Request, context: VehicleContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const vehicleId = parsePositiveInt(id);

  if (!vehicleId) {
    return notFound();
  }

  try {
    await deleteVehicle(vehicleId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof VehicleServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
