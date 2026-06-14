import { readJsonRecord } from "@/server/api/body";
import { badRequest, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  createCustomer,
  CustomerServiceError,
  listCustomers,
} from "@/server/customers/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(await listCustomers());
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(
      await createCustomer(body, authorization.user.userId),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      return legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
