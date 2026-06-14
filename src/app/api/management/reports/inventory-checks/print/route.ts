import { authorizeApiRequest } from "@/server/auth/guard";
import { managementErrorResponse } from "@/server/management/route-helpers";
import { printHtmlResponse } from "@/server/reports/html";
import { buildInventoryChecksPrintPage } from "@/server/reports/management";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { page, filename } = await buildInventoryChecksPrintPage(
      new URL(request.url).searchParams,
    );

    return printHtmlResponse(page, filename);
  } catch (error) {
    return managementErrorResponse(error);
  }
}

