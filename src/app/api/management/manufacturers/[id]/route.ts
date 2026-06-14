import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteManufacturer,
  getManufacturer,
  updateManufacturer,
} from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

type ManufacturerContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: ManufacturerContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const manufacturerId = parsePositiveInt(id);

  if (!manufacturerId) {
    return notFound();
  }

  const manufacturer = await getManufacturer(manufacturerId);

  return manufacturer ? legacyJson(manufacturer) : notFound();
}

export async function PUT(request: Request, context: ManufacturerContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const manufacturerId = parsePositiveInt(id);

  if (!manufacturerId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    await updateManufacturer(manufacturerId, body, authorization.user.userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: ManufacturerContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const manufacturerId = parsePositiveInt(id);

  if (!manufacturerId) {
    return notFound();
  }

  try {
    await deleteManufacturer(manufacturerId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}
