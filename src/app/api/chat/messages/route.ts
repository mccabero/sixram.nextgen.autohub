import { readJsonRecord } from "@/server/api/body";
import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const body = await readJsonRecord(request);
  const messages = Array.isArray(body?.messages) ? body.messages : null;

  if (!messages) {
    return badRequest("Messages are required.");
  }

  return legacyJson(
    {
      error:
        "Rapide AI chat requires a configured chat provider before it can answer messages.",
    },
    { status: 503 },
  );
}

