import { legacyJson } from "@/server/api/legacy-json";
import { getLoginSettingsPayload } from "@/server/login-settings/service";

export const runtime = "nodejs";

export async function GET() {
  return legacyJson(getLoginSettingsPayload());
}
