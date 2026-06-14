import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { getQueryParam } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getCustomerByEmail } from "@/server/customers/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const email = getQueryParam(request, "email")?.trim();

  if (!email) {
    return badRequest("email is required");
  }

  const customer = await getCustomerByEmail(email);

  return customer ? legacyJson(customer) : notFound();
}
