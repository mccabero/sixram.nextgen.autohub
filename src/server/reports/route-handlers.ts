import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { OperationServiceError } from "@/server/operations/inspections";
import { printHtmlResponse, type PrintPage } from "@/server/reports/html";
import {
  buildAccountsReceivablePrintPage,
  buildCreditCardPaymentPrintPage,
  buildDailySalesJson,
  buildDailySalesPrintPage,
  buildMonthlySalesSummaryPrintPage,
  buildOperationPrintPage,
  buildPaymentTypePrintPage,
  buildPettyCashVoucherPrintPage,
  buildStaffMatrixPrintPage,
} from "@/server/reports/service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PrintBuildResult = {
  filename: string;
  page: PrintPage;
};

export async function handleDailySalesJson(request: Request) {
  const authorization = await authorizeApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  try {
    return legacyJson(await buildDailySalesJson(new URL(request.url).searchParams));
  } catch (error) {
    return reportErrorResponse(error);
  }
}

export async function handleDailySalesPrint(request: Request) {
  return printReport(request, () =>
    buildDailySalesPrintPage(new URL(request.url).searchParams),
  );
}

export async function handleMonthlySalesSummaryPrint(request: Request) {
  return printReport(request, () =>
    buildMonthlySalesSummaryPrintPage(new URL(request.url).searchParams),
  );
}

export async function handleCreditCardPaymentPrint(request: Request) {
  return printReport(request, () =>
    buildCreditCardPaymentPrintPage(new URL(request.url).searchParams),
  );
}

export async function handlePaymentTypePrint(request: Request) {
  return printReport(request, () =>
    buildPaymentTypePrintPage(new URL(request.url).searchParams),
  );
}

export async function handleAccountsReceivableDailyPrint(request: Request) {
  return printReport(request, () =>
    buildAccountsReceivablePrintPage(new URL(request.url).searchParams, true),
  );
}

export async function handleAccountsReceivableMonthlyPrint(request: Request) {
  return printReport(request, () =>
    buildAccountsReceivablePrintPage(new URL(request.url).searchParams, false),
  );
}

export async function handlePettyCashVoucherPrint(request: Request) {
  return printReport(request, () =>
    buildPettyCashVoucherPrintPage(new URL(request.url).searchParams),
  );
}

export async function handleCommissionsServiceAdvisorPrint(request: Request) {
  return printReport(request, () =>
    buildStaffMatrixPrintPage(new URL(request.url).searchParams, "commissions-sa"),
  );
}

export async function handleCommissionsTechnicianPrint(request: Request) {
  return printReport(request, () =>
    buildStaffMatrixPrintPage(
      new URL(request.url).searchParams,
      "commissions-tech",
    ),
  );
}

export async function handleIncentivesServiceAdvisorPrint(request: Request) {
  return printReport(request, () =>
    buildStaffMatrixPrintPage(new URL(request.url).searchParams, "incentives-sa"),
  );
}

export async function handleIncentivesTechnicianPrint(request: Request) {
  return printReport(request, () =>
    buildStaffMatrixPrintPage(
      new URL(request.url).searchParams,
      "incentives-tech",
    ),
  );
}

export async function handleInspectionPrint(
  request: Request,
  context: RouteContext,
) {
  return printOperationDocument(request, context, "inspection");
}

export async function handleEstimatePrint(
  request: Request,
  context: RouteContext,
) {
  return printOperationDocument(request, context, "estimate");
}

export async function handleJobOrderPrint(
  request: Request,
  context: RouteContext,
) {
  return printOperationDocument(request, context, "joborder");
}

export async function handleInvoicePrint(
  request: Request,
  context: RouteContext,
) {
  return printOperationDocument(request, context, "invoice");
}

export async function handlePaymentReceiptPrint(
  request: Request,
  context: RouteContext,
) {
  return printOperationDocument(request, context, "payment-receipt");
}

export async function handlePaymentGatePassPrint(
  request: Request,
  context: RouteContext,
) {
  return printOperationDocument(request, context, "payment-gate-pass");
}

async function printReport(
  request: Request,
  builder: () => Promise<PrintBuildResult>,
) {
  const authorization = await authorizeApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const { page, filename } = await builder();
    return printHtmlResponse(page, filename);
  } catch (error) {
    return reportErrorResponse(error);
  }
}

async function printOperationDocument(
  request: Request,
  context: RouteContext,
  kind:
    | "inspection"
    | "estimate"
    | "joborder"
    | "invoice"
    | "payment-receipt"
    | "payment-gate-pass",
) {
  const authorization = await authorizeApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;
  const parsedId = parsePositiveInt(id);

  if (!parsedId) return notFound();

  try {
    const { page, filename } = await buildOperationPrintPage(kind, parsedId);
    return printHtmlResponse(page, filename);
  } catch (error) {
    return reportErrorResponse(error);
  }
}

function reportErrorResponse(error: unknown) {
  if (error instanceof OperationServiceError) {
    if (error.status === 400) return badRequest(String(error.body ?? error.message));
    if (error.status === 404) return notFound(String(error.body ?? error.message));
    return legacyJson(error.body, { status: error.status });
  }

  return serverError();
}
