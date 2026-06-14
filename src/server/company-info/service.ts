import path from "node:path";
import { prisma } from "@/server/db/prisma";
import { findUploadedImageFile, getUploadsRoot } from "@/server/api/uploads";

type CompanyInfoRow = Awaited<ReturnType<typeof getCompanyInfoById>>;

function buildCompanyLogoPath(companyId: number) {
  const directory = path.join(
    getUploadsRoot(),
    "company-logo",
    String(companyId),
  );
  const logo = findUploadedImageFile(directory, "company_logo");

  return logo ? `/api/companyinfo/${companyId}/logo` : null;
}

export function mapCompanyInfo(item: NonNullable<CompanyInfoRow>) {
  const logoPath = buildCompanyLogoPath(item.Id);

  return {
    Id: item.Id,
    Name: item.Name,
    Address: item.Address,
    Email: item.Email,
    MobileNumber: item.MobileNumber,
    TIN: item.TIN,
    GCash: item.GCash,
    BankNo: item.BankNo,
    IsPrimaryCompany: item.IsPrimaryCompany,
    PrimaryCompany: item.IsPrimaryCompany,
    CreatedById: item.CreatedById,
    CreatedDateTime: item.CreatedDateTime,
    UpdatedById: item.UpdatedById,
    UpdatedDateTime: item.UpdatedDateTime,
    Logo: logoPath,
    LogoPath: logoPath,
    LogoUrl: logoPath,
  };
}

export function getCompanyInfos() {
  return prisma.companyInfo.findMany({
    orderBy: [{ IsPrimaryCompany: "desc" }, { Id: "asc" }],
  });
}

export function getCompanyInfoById(id: number) {
  return prisma.companyInfo.findUnique({
    where: { Id: id },
  });
}
