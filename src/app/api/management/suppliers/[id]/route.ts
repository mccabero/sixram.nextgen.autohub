import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteSupplier,
  getSupplier,
  updateSupplier,
} from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

type SupplierContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: SupplierContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const supplierId = parsePositiveInt(id);

  if (!supplierId) {
    return notFound();
  }

  const supplier = await getSupplier(supplierId);

  return supplier ? legacyJson(supplier) : notFound();
}

export async function PUT(request: Request, context: SupplierContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const supplierId = parsePositiveInt(id);

  if (!supplierId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    await updateSupplier(supplierId, body, authorization.user.userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: SupplierContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const supplierId = parsePositiveInt(id);

  if (!supplierId) {
    return notFound();
  }

  try {
    await deleteSupplier(supplierId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}
