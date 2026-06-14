import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteService,
  getCanEditPrice,
  getService,
  updateService,
} from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

type ServiceContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: ServiceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const serviceId = parsePositiveInt(id);

  if (!serviceId) {
    return notFound();
  }

  const service = await getService(serviceId);

  return service ? legacyJson(service) : notFound();
}

export async function PUT(request: Request, context: ServiceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const serviceId = parsePositiveInt(id);

  if (!serviceId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    await updateService(
      serviceId,
      body,
      authorization.user.userId,
      await getCanEditPrice(authorization.user.userId),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: ServiceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const serviceId = parsePositiveInt(id);

  if (!serviceId) {
    return notFound();
  }

  try {
    await deleteService(serviceId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}
