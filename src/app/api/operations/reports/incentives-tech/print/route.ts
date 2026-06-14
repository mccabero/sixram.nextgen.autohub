import { handleIncentivesTechnicianPrint } from "@/server/reports/route-handlers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleIncentivesTechnicianPrint(request);
}
