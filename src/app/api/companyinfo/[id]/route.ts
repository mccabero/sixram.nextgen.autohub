import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  CompanyInfoServiceError,
  deleteCompanyInfo,
  getCompanyInfoById,
  mapCompanyInfo,
  updateCompanyInfo,
} from "@/server/company-info/service";

export const runtime = "nodejs";

type CompanyInfoRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: CompanyInfoRouteContext,
) {
  const { id } = await context.params;
  const companyId = parsePositiveInt(id);

  if (!companyId) {
    return notFound();
  }

  const item = await getCompanyInfoById(companyId);

  if (!item) {
    return notFound();
  }

  return legacyJson(await mapCompanyInfo(item));
}

export async function PUT(
  request: Request,
  context: CompanyInfoRouteContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const companyId = parsePositiveInt(id);

  if (!companyId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(
      await updateCompanyInfo(companyId, body, authorization.user.userId),
    );
  } catch (error) {
    if (error instanceof CompanyInfoServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}

export async function DELETE(
  request: Request,
  context: CompanyInfoRouteContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const companyId = parsePositiveInt(id);

  if (!companyId) {
    return notFound();
  }

  try {
    await deleteCompanyInfo(companyId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof CompanyInfoServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
