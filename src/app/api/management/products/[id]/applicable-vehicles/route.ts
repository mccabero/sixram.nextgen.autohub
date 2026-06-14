import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  getProductApplicableVehicles,
  updateProductApplicableVehicles,
} from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

type ProductApplicableVehiclesContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: ProductApplicableVehiclesContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const productId = parsePositiveInt(id);

  if (!productId) {
    return notFound();
  }

  const result = await getProductApplicableVehicles(productId);

  return result ? legacyJson(result) : notFound();
}

export async function PUT(
  request: Request,
  context: ProductApplicableVehiclesContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const productId = parsePositiveInt(id);

  if (!productId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const result = await updateProductApplicableVehicles(
      productId,
      body,
      authorization.user.userId,
    );

    return result ? legacyJson(result) : notFound();
  } catch (error) {
    return managementErrorResponse(error);
  }
}
