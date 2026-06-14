import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getActiveInspectionTemplate } from "@/server/config/inspection-templates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const template = await getActiveInspectionTemplate();

  return template ? legacyJson(template) : notFound();
}
