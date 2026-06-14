import path from "node:path";
import { notFound } from "@/server/api/errors";
import {
  saveUploadedImage,
  serveUploadedImage,
} from "@/server/api/image-assets";
import { parsePositiveInt } from "@/server/api/params";
import { getUploadsRoot } from "@/server/api/uploads";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getCompanyInfoById, mapCompanyInfo } from "@/server/company-info/service";

export const runtime = "nodejs";

type CompanyLogoContext = {
  params: Promise<{
    id: string;
  }>;
};

function directory(companyId: number) {
  return path.join(getUploadsRoot(), "company-logo", String(companyId));
}

export async function GET(_request: Request, context: CompanyLogoContext) {
  const companyId = parsePositiveInt((await context.params).id);

  if (!companyId) {
    return notFound();
  }

  return serveUploadedImage(directory(companyId), "company_logo");
}

export async function POST(request: Request, context: CompanyLogoContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const companyId = parsePositiveInt((await context.params).id);

  if (!companyId) {
    return notFound();
  }

  const company = await getCompanyInfoById(companyId);

  if (!company) {
    return notFound();
  }

  return saveUploadedImage(
    request,
    directory(companyId),
    "company_logo",
    mapCompanyInfo(company),
  );
}

