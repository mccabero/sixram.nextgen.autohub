import { readJsonRecord } from "@/server/api/body";
import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  getLoginSettingsPayload,
  updateLoginSettings,
} from "@/server/login-settings/service";

export const runtime = "nodejs";

export async function GET() {
  return legacyJson(await getLoginSettingsPayload());
}

export async function PUT(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  return legacyJson(await updateLoginSettings(body));
}
