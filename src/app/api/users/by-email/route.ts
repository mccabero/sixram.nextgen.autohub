import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getUserByEmail } from "@/server/users/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const email = new URL(request.url).searchParams.get("email")?.trim();

  if (!email) {
    return badRequest("email is required");
  }

  const user = await getUserByEmail(email);

  return user ? legacyJson(user) : notFound();
}
