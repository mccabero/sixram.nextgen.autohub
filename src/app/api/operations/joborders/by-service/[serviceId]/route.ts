import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { listJobOrdersByService } from "@/server/operations/job-orders";

export const runtime = "nodejs";

type JobOrdersByServiceContext = {
  params: Promise<{
    serviceId: string;
  }>;
};

export async function GET(
  request: Request,
  context: JobOrdersByServiceContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { serviceId } = await context.params;
  const parsedServiceId = parsePositiveInt(serviceId);

  if (!parsedServiceId) {
    return badRequest("serviceId is required");
  }

  return legacyJson(await listJobOrdersByService(parsedServiceId));
}
