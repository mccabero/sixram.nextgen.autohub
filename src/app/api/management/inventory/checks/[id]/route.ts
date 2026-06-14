import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { getInventoryCheck } from "@/server/management/service";

export const runtime = "nodejs";

type InventoryCheckContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: InventoryCheckContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const checkId = parsePositiveInt(id);

  if (!checkId) {
    return notFound();
  }

  const check = await getInventoryCheck(checkId);

  return check ? legacyJson(check) : notFound();
}
