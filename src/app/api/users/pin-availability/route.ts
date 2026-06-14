import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { isPinAvailable } from "@/server/users/service";
import { userErrorResponse } from "@/server/users/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const searchParams = new URL(request.url).searchParams;
  const pin = searchParams.get("pin")?.trim();

  if (!pin) {
    return badRequest("PIN is required");
  }

  try {
    return legacyJson({
      available: await isPinAvailable(
        pin,
        parsePositiveInt(searchParams.get("excludeUserId")),
      ),
    });
  } catch (error) {
    return userErrorResponse(error);
  }
}
