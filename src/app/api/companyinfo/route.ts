import { legacyJson } from "@/server/api/legacy-json";
import { getCompanyInfos, mapCompanyInfo } from "@/server/company-info/service";

export const runtime = "nodejs";

export async function GET() {
  const items = await getCompanyInfos();
  return legacyJson(items.map(mapCompanyInfo));
}
