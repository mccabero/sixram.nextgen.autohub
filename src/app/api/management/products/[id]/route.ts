import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteProduct,
  getCanEditPrice,
  getProduct,
  updateProduct,
} from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

type ProductContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: ProductContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const productId = parsePositiveInt(id);

  if (!productId) {
    return notFound();
  }

  const product = await getProduct(productId);

  return product ? legacyJson(product) : notFound();
}

export async function PUT(request: Request, context: ProductContext) {
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
    await updateProduct(
      productId,
      body,
      authorization.user.userId,
      await getCanEditPrice(authorization.user.userId),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: ProductContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const productId = parsePositiveInt(id);

  if (!productId) {
    return notFound();
  }

  try {
    await deleteProduct(productId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}
