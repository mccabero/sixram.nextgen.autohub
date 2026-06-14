import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { getCompanyInfoById, mapCompanyInfo } from "@/server/company-info/service";

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

  return legacyJson(mapCompanyInfo(item));
}
