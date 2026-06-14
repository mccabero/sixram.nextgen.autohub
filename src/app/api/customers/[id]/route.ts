import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  CustomerServiceError,
  deleteCustomer,
  getCustomer,
  updateCustomer,
} from "@/server/customers/service";

export const runtime = "nodejs";

type CustomerContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: CustomerContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const customerId = parsePositiveInt(id);

  if (!customerId) {
    return notFound();
  }

  const customer = await getCustomer(customerId);

  return customer ? legacyJson(customer) : notFound();
}

export async function PUT(request: Request, context: CustomerContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const customerId = parsePositiveInt(id);

  if (!customerId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    await updateCustomer(customerId, body, authorization.user.userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}

export async function DELETE(request: Request, context: CustomerContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const customerId = parsePositiveInt(id);

  if (!customerId) {
    return notFound();
  }

  try {
    await deleteCustomer(customerId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
