import { handlePaymentReceiptPrint } from "@/server/reports/route-handlers";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: Context) {
  return handlePaymentReceiptPrint(request, context);
}
