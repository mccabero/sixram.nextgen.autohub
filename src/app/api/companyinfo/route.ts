import { readJsonRecord } from "@/server/api/body";
import { badRequest, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  CompanyInfoServiceError,
  createCompanyInfo,
  getCompanyInfos,
  mapCompanyInfo,
} from "@/server/company-info/service";

export const runtime = "nodejs";

export async function GET() {
  const items = await getCompanyInfos();
  return legacyJson(await Promise.all(items.map(mapCompanyInfo)));
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
      await createCompanyInfo(body, authorization.user.userId),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CompanyInfoServiceError) {
      return legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
