import { readJsonRecord } from "@/server/api/body";
import { badRequest, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  createInspectionTemplate,
  listInspectionTemplates,
} from "@/server/config/inspection-templates";
import { ConfigServiceError } from "@/server/config/reference-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(await listInspectionTemplates());
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
      await createInspectionTemplate(body, authorization.user.userId),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      return legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
