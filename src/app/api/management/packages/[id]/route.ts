import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deletePackage,
  getCanEditPrice,
  getPackage,
  updatePackage,
} from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

type PackageContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: PackageContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const packageId = parsePositiveInt(id);

  if (!packageId) {
    return notFound();
  }

  const packageItem = await getPackage(packageId);

  return packageItem ? legacyJson(packageItem) : notFound();
}

export async function PUT(request: Request, context: PackageContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const packageId = parsePositiveInt(id);

  if (!packageId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    await updatePackage(
      packageId,
      body,
      authorization.user.userId,
      await getCanEditPrice(authorization.user.userId),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: PackageContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const packageId = parsePositiveInt(id);

  if (!packageId) {
    return notFound();
  }

  try {
    await deletePackage(packageId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}
