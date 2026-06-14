import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";
import { getEstimate } from "@/server/operations/estimates";
import { getInspection } from "@/server/operations/inspections";
import { getInvoice, listAccountsReceivable } from "@/server/operations/invoices";
import { getJobOrder } from "@/server/operations/job-orders";
import { getPayment } from "@/server/operations/payments";
import type { PrintPage, PrintTable, ReportCompany } from "@/server/reports/html";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type DecimalLike = {
  toString: () => string;
};

type DailySalesDetailRow = {
  particulars: string;
  serviceAmount: number | null;
  discount: number | null;
  sellingPrice: number | null;
  emphasize: boolean;
};

type DailySalesRow = {
  date: Date | null;
  customerName: string;
  vehicleSummary: string;
  particulars: string;
  serviceAmount: number | null;
  discount: number | null;
  sellingPrice: number | null;
  total: number | null;
  invoiceRefNo: string;
  modeOfPayment: string;
  emphasize: boolean;
};

type StaffMatrixKind =
  | "commissions-sa"
  | "commissions-tech"
  | "incentives-sa"
  | "incentives-tech";

type OperationDocumentKind =
  | "inspection"
  | "estimate"
  | "joborder"
  | "invoice"
  | "payment-receipt"
  | "payment-gate-pass";

export async function getCompanies(limit = 2): Promise<ReportCompany[]> {
  const rows = await prisma.companyInfo.findMany({
    orderBy: [{ IsPrimaryCompany: "desc" }, { Id: "asc" }],
    take: limit,
    select: {
      Name: true,
      Address: true,
      Email: true,
      MobileNumber: true,
      TIN: true,
    },
  });

  return rows.map((row) => ({
    name: row.Name ?? "",
    address: row.Address ?? "",
    email: row.Email ?? "",
    mobileNumber: row.MobileNumber ?? "",
    tin: row.TIN ?? "",
  }));
}

export async function buildDailySalesJson(searchParams: URLSearchParams) {
  const report = await buildDailySalesReport(searchParams);
  const company = (await getCompanies(1))[0] ?? null;

  return {
    company,
    coverage: {
      start: report.range.startDate,
      end: report.range.endDate,
    },
    rows: report.rows,
    totals: report.totals,
    paymentBreakdown: report.paymentBreakdown,
  };
}

export async function buildDailySalesPrintPage(searchParams: URLSearchParams) {
  const report = await buildDailySalesReport(searchParams);

  return {
    filename: `daily-sales-${formatCompactDate(report.range.startDate)}-${formatCompactDate(report.range.endDate)}.html`,
    page: {
      title: "Daily Sales Report",
      subtitle: dateCoverage(report.range),
      companies: await getCompanies(),
      summaries: [
        {
          title: "Column Totals",
          items: [
            { label: "Service Amount", value: report.totals.serviceAmount },
            { label: "Discount", value: report.totals.discount },
            { label: "Selling Price", value: report.totals.sellingPrice },
            { label: "Grand Total", value: report.totals.grandTotal },
            { label: "Deposit", value: report.totals.deposit },
          ],
        },
        {
          title: "Payment Breakdown",
          items: report.paymentBreakdown.map((item) => ({
            label: item.label,
            value: item.amount,
          })),
        },
      ],
      tables: [
        {
          columns: [
            "Date",
            "Customer",
            "Vehicle",
            "Particulars",
            "Service Amount",
            "Discount",
            "Selling Price",
            "Total",
            "Invoice Ref. No.",
            "Mode of Payment",
          ],
          rows: report.rows.map((row) =>
            row.emphasize
              ? [
                  "__section",
                  [
                    row.date ? formatDisplayDate(row.date) : "",
                    row.customerName,
                    row.vehicleSummary,
                    row.particulars,
                  ]
                    .filter(Boolean)
                    .join(" | "),
                ]
              : [
                  row.date,
                  row.customerName,
                  row.vehicleSummary,
                  row.particulars,
                  row.serviceAmount,
                  row.discount,
                  row.sellingPrice,
                  row.total,
                  row.invoiceRefNo,
                  row.modeOfPayment,
                ],
          ),
        },
      ],
    } satisfies PrintPage,
  };
}

export async function buildMonthlySalesSummaryPrintPage(
  searchParams: URLSearchParams,
) {
  const range = parseReportDateRange(searchParams);
  const report = await buildMonthlySalesSummaryReport(range);

  return {
    filename: `monthly-sales-summary-${formatCompactDate(range.startDate)}-${formatCompactDate(range.endDate)}.html`,
    page: {
      title: "Monthly Sales Summary",
      subtitle: dateCoverage(range),
      companies: await getCompanies(),
      summaries: [
        {
          title: "Totals",
          items: [
            { label: "Sales", value: report.totals.sales },
            { label: "Cash", value: report.totals.cash },
            { label: "Local Credit Card", value: report.totals.localCreditCard },
            { label: "Maya", value: report.totals.maya },
            { label: "GCash", value: report.totals.gCash },
            { label: "Bank Transfer", value: report.totals.bankTransfer },
            { label: "Local Debit Card", value: report.totals.localDebitCard },
            { label: "E-Sales", value: report.totals.es },
            { label: "Discount", value: report.totals.discount },
          ],
        },
      ],
      tables: [
        {
          columns: [
            "Date",
            "Sales",
            "Cash",
            "Local Credit Card",
            "Maya",
            "GCash",
            "Bank Transfer",
            "Local Debit Card",
            "E-Sales",
            "Discount",
          ],
          rows: report.rows.map((row) => [
            row.date,
            row.sales,
            row.cash,
            row.localCreditCard,
            row.maya,
            row.gCash,
            row.bankTransfer,
            row.localDebitCard,
            row.es,
            row.discount,
          ]),
          footer: [
            [
              "Total",
              report.totals.sales,
              report.totals.cash,
              report.totals.localCreditCard,
              report.totals.maya,
              report.totals.gCash,
              report.totals.bankTransfer,
              report.totals.localDebitCard,
              report.totals.es,
              report.totals.discount,
            ],
          ],
        },
      ],
    } satisfies PrintPage,
  };
}

export async function buildCreditCardPaymentPrintPage(
  searchParams: URLSearchParams,
) {
  const range = parseReportDateRange(searchParams);
  const report = await buildCreditCardPaymentReport(range);

  return {
    filename: `CC-PAYMENT-${formatCompactDate(range.startDate)}-${formatCompactDate(range.endDate)}.html`,
    page: {
      title: "Credit Card Payment Report",
      subtitle: dateCoverage(range),
      companies: await getCompanies(),
      summaries: [
        {
          title: "Totals",
          items: [
            { label: "Local Credit", value: report.totals.localCreditTotal },
            { label: "Local Debit", value: report.totals.localDebitTotal },
            { label: "Local Total", value: report.totals.localTotalAmount },
            {
              label: "International Credit",
              value: report.totals.internationalCreditTotal,
            },
            {
              label: "International Debit",
              value: report.totals.internationalDebitTotal,
            },
            {
              label: "International Total",
              value: report.totals.internationalTotalAmount,
            },
            { label: "Total Deduction", value: report.totals.totalDeduction },
            { label: "Net Amount", value: report.totals.netAmount },
          ],
        },
      ],
      tables: [
        {
          columns: [
            "Date",
            "Reference No.",
            "Local Credit",
            "Local Debit",
            "Local Total",
            "Intl Credit",
            "Intl Debit",
            "Intl Total",
            "VAT Amount",
            "WTax",
            "Deduction",
            "Net Amount",
          ],
          rows: report.rows.map((row) =>
            row.isSectionHeader
              ? ["__section", `${row.dateLabel} ${row.referenceNo}`]
              : [
                  row.dateLabel,
                  row.referenceNo,
                  row.localCreditTotal,
                  row.localDebitTotal,
                  row.localTotalAmount,
                  row.internationalCreditTotal,
                  row.internationalDebitTotal,
                  row.internationalTotalAmount,
                  row.vatAmount,
                  row.withholdingTax,
                  row.totalDeduction,
                  row.netAmount,
                ],
          ),
        },
      ],
    } satisfies PrintPage,
  };
}

export async function buildPaymentTypePrintPage(searchParams: URLSearchParams) {
  const paymentTypeId = parsePositiveInt(searchParams.get("paymentTypeId"));
  if (!paymentTypeId) {
    throw new OperationServiceError("Payment type is required.", 400);
  }

  const range = parseReportDateRange(searchParams);
  const report = await buildPaymentTypeReport(paymentTypeId, range);

  if (!report) {
    throw new OperationServiceError("Payment type was not found.", 404);
  }

  return {
    filename: `PAYMENT-${slug(report.paymentTypeName)}-${formatCompactDate(range.startDate)}-${formatCompactDate(range.endDate)}.html`,
    page: {
      title: `${report.paymentTypeName} Payment Report`,
      subtitle: dateCoverage(range),
      companies: await getCompanies(),
      summaries: [
        {
          title: "Totals",
          items: [
            { label: "Count", value: report.totals.count },
            {
              label: "Invoice Payments",
              value: report.totals.invoicePaymentAmount,
            },
            { label: "Deposits", value: report.totals.depositAmount },
            { label: "Total Amount", value: report.totals.totalAmount },
          ],
        },
      ],
      tables: [
        {
          columns: [
            "Payment Date",
            "Payment Ref.",
            "Invoice No.",
            "Job Order No.",
            "Customer",
            "Particulars",
            "Amount",
          ],
          rows: report.rows.map((row) => [
            row.paymentDate,
            row.paymentReferenceNo,
            row.invoiceNo,
            row.jobOrderNo,
            row.customerName,
            row.particulars,
            row.amountPaid,
          ]),
        },
      ],
    } satisfies PrintPage,
  };
}

export async function buildAccountsReceivablePrintPage(
  searchParams: URLSearchParams,
  singleDay: boolean,
) {
  const range = parseReportDateRange(searchParams, { singleDay });
  const report = await buildAccountsReceivableReport(range);
  const title = singleDay
    ? "Accounts Receivable Daily Report"
    : "Accounts Receivable Monthly Report";

  return {
    filename: `${singleDay ? "AR-DAILY" : "AR-MONTHLY"}-${formatCompactDate(range.startDate)}-${formatCompactDate(range.endDate)}.html`,
    page: {
      title,
      subtitle: dateCoverage(range),
      companies: await getCompanies(),
      summaries: [
        {
          title: "Totals",
          items: [
            { label: "Invoice Amount", value: report.totals.invoiceAmount },
            { label: "Discount", value: report.totals.discountAmount },
            { label: "Deposit", value: report.totals.depositAmount },
            { label: "Paid", value: report.totals.paidAmount },
            { label: "Balance Due", value: report.totals.balanceDue },
            { label: "Current", value: report.totals.currentCount },
            { label: "Overdue", value: report.totals.overdueCount },
          ],
        },
      ],
      tables: [
        {
          columns: [
            "Invoice Date",
            "Due Date",
            "Customer",
            "Invoice No.",
            "Job Order No.",
            "Invoice Amount",
            "Discount",
            "Deposit",
            "Paid",
            "Balance Due",
            "Days Overdue",
            "Status",
          ],
          rows: report.rows.map((row) => [
            row.invoiceDate,
            row.dueDate,
            row.customerName,
            row.invoiceNo,
            row.jobOrderNo,
            row.invoiceAmount,
            row.discountAmount,
            row.depositAmount,
            row.paidAmount,
            row.balanceDue,
            row.daysOverdue,
            row.status,
          ]),
        },
      ],
    } satisfies PrintPage,
  };
}

export async function buildPettyCashVoucherPrintPage(
  searchParams: URLSearchParams,
) {
  const range = parseReportDateRange(searchParams);
  const report = await buildPettyCashVoucherReport(range);

  return {
    filename: `PETTY-CASH-${formatCompactDate(range.startDate)}-${formatCompactDate(range.endDate)}.html`,
    page: {
      title: "Petty Cash Voucher Report",
      subtitle: dateCoverage(range),
      companies: await getCompanies(),
      summaries: [
        {
          title: "Totals",
          items: [
            { label: "Cash In", value: report.totals.cashIn },
            { label: "Cash Out", value: report.totals.cashOut },
            { label: "Ending Balance", value: report.totals.endingBalance },
          ],
        },
      ],
      tables: [
        {
          columns: [
            "PCV No.",
            "Transaction Date",
            "Pay To",
            "Received By",
            "Particulars",
            "Cash In",
            "Cash Out",
            "Balance",
            "Encoded By",
          ],
          rows: report.rows.map((row) => [
            row.pcvNo,
            row.transactionDate,
            row.payTo,
            row.paymentReceivedBy,
            row.particulars,
            row.cashIn,
            row.cashOut,
            row.balance,
            row.encodedBy,
          ]),
        },
      ],
    } satisfies PrintPage,
  };
}

export async function buildStaffMatrixPrintPage(
  searchParams: URLSearchParams,
  kind: StaffMatrixKind,
) {
  const range = parseReportDateRange(searchParams);
  const report = await buildStaffMatrixReport(range, kind);
  const title = staffMatrixTitle(kind);
  const columns = [
    "Date",
    "Vehicle",
    ...(kind === "incentives-tech" ? ["Work Done"] : []),
    ...report.staff.map((staff) => staff.label),
    "Total",
  ];

  return {
    filename: `${staffMatrixFilenamePrefix(kind)}-${formatCompactDate(range.startDate)}-${formatCompactDate(range.endDate)}.html`,
    page: {
      title,
      subtitle: dateCoverage(range),
      companies: await getCompanies(),
      summaries: [
        {
          title: "Totals",
          items: [
            ...report.staff.map((staff) => ({
              label: staff.label,
              value: report.totals.amounts[staff.id] ?? 0,
            })),
            { label: "Grand Total", value: report.totals.grandTotal },
          ],
        },
      ],
      tables: [
        {
          columns,
          rows: report.rows.map((row) => [
            row.date,
            row.vehicle,
            ...(kind === "incentives-tech" ? [row.workDone] : []),
            ...report.staff.map((staff) => row.amounts[staff.id] ?? 0),
            row.total,
          ]),
        },
      ],
    } satisfies PrintPage,
  };
}

export async function buildOperationPrintPage(
  kind: OperationDocumentKind,
  id: number,
) {
  switch (kind) {
    case "inspection":
      return buildInspectionPrintPage(id);
    case "estimate":
      return buildEstimatePrintPage(id);
    case "joborder":
      return buildJobOrderPrintPage(id);
    case "invoice":
      return buildInvoicePrintPage(id);
    case "payment-receipt":
      return buildPaymentReceiptPrintPage(id);
    case "payment-gate-pass":
      return buildPaymentGatePassPrintPage(id);
  }
}

async function buildDailySalesReport(searchParams: URLSearchParams) {
  const range = parseReportDateRange(searchParams, { singleDay: true });
  const endExclusive = addDays(range.endDate, 1);
  const invoiceRows = await prisma.invoice.findMany({
    where: {
      OR: [
        { InvoiceDate: { gte: range.startDate, lt: endExclusive } },
        {
          InvoiceDate: null,
          CreatedDateTime: { gte: range.startDate, lt: endExclusive },
        },
      ],
    },
    orderBy: [{ InvoiceDate: "asc" }, { CreatedDateTime: "asc" }, { Id: "asc" }],
    select: {
      Id: true,
      InvoiceNo: true,
      InvoiceDate: true,
      CreatedDateTime: true,
      JobOrderId: true,
      TotalAmount: true,
      LaborDiscount: true,
      ProductDiscount: true,
      AdditionalDiscount: true,
      Customer: {
        select: {
          FirstName: true,
          LastName: true,
          CompanyName: true,
        },
      },
      JobStatus: {
        select: {
          Name: true,
          Description: true,
        },
      },
    },
  });

  const invoices = invoiceRows.filter((invoice) => !isNonPostingStatus(invoice.JobStatus));
  const invoiceIds = invoices.map((invoice) => invoice.Id);
  const jobOrderIds = distinct(invoices.map((invoice) => invoice.JobOrderId));

  const [invoiceDetails, paymentDetails, depositTotalsByJobOrder] =
    await Promise.all([
      Promise.all(invoices.map((invoice) => getInvoice(invoice.Id))),
      invoiceIds.length === 0
        ? []
        : prisma.paymentDetail.findMany({
            where: { InvoiceId: { in: invoiceIds } },
            orderBy: { Id: "asc" },
            select: {
              InvoiceId: true,
              AmountPaid: true,
              PaymentTypeParameter: { select: { Name: true } },
              Payment: {
                select: {
                  JobStatus: { select: { Name: true, Description: true } },
                },
              },
            },
          }),
      getDepositTotalsByJobOrder(jobOrderIds),
    ]);

  const detailByInvoice = new Map(
    invoiceDetails.filter(Boolean).map((detail) => [detail!.id, detail!]),
  );
  const paymentRowsByInvoice = groupBy(paymentDetails, (detail) => detail.InvoiceId);
  const rows: DailySalesRow[] = [];
  const paymentBreakdown = new Map<string, number>();
  let totalServiceAmount = 0;
  let totalDiscountAmount = 0;
  let totalSellingPrice = 0;
  let grandTotal = 0;
  let depositTotal = 0;

  for (const invoice of invoices) {
    const detail = detailByInvoice.get(invoice.Id);
    const detailRows = detail ? buildDailySalesDetailRows(detail) : [];
    const reportDate = invoice.InvoiceDate ?? invoice.CreatedDateTime;
    const payments = (paymentRowsByInvoice.get(invoice.Id) ?? []).filter(
      (payment) => !isNonPostingStatus(payment.Payment.JobStatus),
    );
    const paymentMode = summarizeDistinct(
      payments.map((payment) => payment.PaymentTypeParameter?.Name ?? ""),
      "-",
    );

    totalServiceAmount += sum(detailRows, (row) => row.serviceAmount ?? 0);
    totalDiscountAmount += sum(detailRows, (row) => row.discount ?? 0);
    totalSellingPrice += sum(detailRows, (row) => row.sellingPrice ?? 0);
    grandTotal += toNumber(invoice.TotalAmount);
    depositTotal += depositTotalsByJobOrder.get(invoice.JobOrderId) ?? 0;

    for (const payment of payments) {
      addPaymentBreakdownAmount(
        paymentBreakdown,
        payment.PaymentTypeParameter?.Name ?? "",
        toNumber(payment.AmountPaid),
      );
    }

    const safeDetailRows =
      detailRows.length > 0
        ? detailRows
        : [
            {
              particulars: "-",
              serviceAmount: null,
              discount: null,
              sellingPrice: null,
              emphasize: true,
            },
          ];

    safeDetailRows.forEach((row, index) => {
      rows.push({
        date: index === 0 ? reportDate : null,
        customerName:
          index === 0
            ? detail?.customer
              ? customerName(detail.customer)
              : customerName(invoice.Customer)
            : "",
        vehicleSummary: index === 0 ? vehicleSummary(detail?.vehicle ?? null) : "",
        particulars: row.particulars,
        serviceAmount: row.serviceAmount,
        discount: row.discount,
        sellingPrice: row.sellingPrice,
        total: index === 0 ? toNumber(invoice.TotalAmount) : null,
        invoiceRefNo: index === 0 ? invoice.InvoiceNo ?? "" : "",
        modeOfPayment: index === 0 ? paymentMode : "",
        emphasize: row.emphasize,
      });
    });
  }

  return {
    range,
    rows,
    paymentBreakdown: Array.from(paymentBreakdown.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, amount]) => ({ label, amount: round(amount) })),
    totals: {
      serviceAmount: round(totalServiceAmount),
      discount: round(totalDiscountAmount),
      sellingPrice: round(totalSellingPrice),
      grandTotal: round(grandTotal),
      deposit: round(depositTotal),
    },
  };
}

async function buildMonthlySalesSummaryReport(range: DateRange) {
  const endExclusive = addDays(range.endDate, 1);
  const paymentDetails = (
    await prisma.paymentDetail.findMany({
      where: {
        Payment: {
          PaymentDate: { gte: range.startDate, lt: endExclusive },
        },
      },
      select: {
        InvoiceId: true,
        AmountPaid: true,
        PaymentTypeParameter: { select: { Name: true } },
        Payment: {
          select: {
            PaymentDate: true,
            JobStatus: { select: { Name: true, Description: true } },
          },
        },
        Invoice: {
          select: {
            LaborDiscount: true,
            ProductDiscount: true,
            AdditionalDiscount: true,
            JobStatus: { select: { Name: true, Description: true } },
          },
        },
      },
    })
  ).filter(
    (detail) =>
      !isNonPostingStatus(detail.Payment.JobStatus) &&
      !isNonPostingStatus(detail.Invoice.JobStatus),
  );

  const invoiceIds = distinct(paymentDetails.map((detail) => detail.InvoiceId));
  const firstPaymentDateByInvoice = await getFirstPaymentDateByInvoice(invoiceIds);
  const quickSales = (
    await prisma.quickSale.findMany({
      where: { TransactionDate: { gte: range.startDate, lt: endExclusive } },
      select: {
        TransactionDate: true,
        TotalAmount: true,
        Discount: true,
        PaymentTypeParameter: { select: { Name: true } },
        JobStatus: { select: { Name: true, Description: true } },
      },
    })
  ).filter((quickSale) => !isNonPostingStatus(quickSale.JobStatus));

  const rowsByDate = new Map<string, MonthlySalesAccumulator>();

  for (const detail of paymentDetails) {
    const row = getMonthlyRow(rowsByDate, startOfDay(detail.Payment.PaymentDate));
    const amountPaid = toNumber(detail.AmountPaid);
    row.sales += amountPaid;
    addMonthlySalesPaymentAmount(row, detail.PaymentTypeParameter?.Name ?? "", amountPaid);

    const firstPaymentDate = firstPaymentDateByInvoice.get(detail.InvoiceId);
    if (firstPaymentDate?.getTime() === startOfDay(detail.Payment.PaymentDate).getTime()) {
      const discount =
        toNumber(detail.Invoice.LaborDiscount) +
        toNumber(detail.Invoice.ProductDiscount) +
        toNumber(detail.Invoice.AdditionalDiscount);
      row.discount += discount;
      row.sales += discount;
    }
  }

  for (const quickSale of quickSales) {
    const row = getMonthlyRow(rowsByDate, startOfDay(quickSale.TransactionDate));
    const totalAmount = toNumber(quickSale.TotalAmount);
    const discount = toNumber(quickSale.Discount);
    row.sales += totalAmount + discount;
    row.discount += discount;
    addMonthlySalesPaymentAmount(
      row,
      quickSale.PaymentTypeParameter?.Name ?? "",
      totalAmount,
    );
  }

  const rows = Array.from(rowsByDate.values())
    .filter((row) => Object.entries(row).some(([key, value]) => key !== "date" && value !== 0))
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map(roundMonthlyRow);

  return {
    rows,
    totals: roundMonthlyTotals({
      date: new Date(0),
      sales: sum(rows, (row) => row.sales),
      cash: sum(rows, (row) => row.cash),
      localCreditCard: sum(rows, (row) => row.localCreditCard),
      maya: sum(rows, (row) => row.maya),
      gCash: sum(rows, (row) => row.gCash),
      bankTransfer: sum(rows, (row) => row.bankTransfer),
      localDebitCard: sum(rows, (row) => row.localDebitCard),
      es: sum(rows, (row) => row.es),
      discount: sum(rows, (row) => row.discount),
    }),
  };
}

async function buildCreditCardPaymentReport(range: DateRange) {
  const endExclusive = addDays(range.endDate, 1);
  const paymentDetails = (
    await prisma.paymentDetail.findMany({
      where: {
        Payment: {
          PaymentDate: { gte: range.startDate, lt: endExclusive },
        },
      },
      select: {
        InvoiceId: true,
        AmountPaid: true,
        PaymentTypeParameter: { select: { Name: true } },
        Payment: {
          select: {
            PaymentDate: true,
            JobStatus: { select: { Name: true, Description: true } },
          },
        },
        Invoice: {
          select: {
            Id: true,
            InvoiceNo: true,
            JobStatus: { select: { Name: true, Description: true } },
          },
        },
      },
    })
  ).filter(
    (detail) =>
      !isNonPostingStatus(detail.Payment.JobStatus) &&
      !isNonPostingStatus(detail.Invoice.JobStatus),
  );

  const invoiceAccumulator = new Map<string, CreditCardAccumulator>();
  for (const detail of paymentDetails) {
    const bucket = getCreditCardPaymentBucket(detail.PaymentTypeParameter?.Name ?? "");
    if (bucket === "none") continue;
    const date = startOfDay(detail.Payment.PaymentDate);
    const invoiceNo = detail.Invoice.InvoiceNo?.trim() || `INV-${String(detail.Invoice.Id).padStart(6, "0")}`;
    const key = `${date.toISOString()}|${detail.Invoice.Id}|${invoiceNo}`;
    const accumulator =
      invoiceAccumulator.get(key) ??
      newCreditCardAccumulator(date, invoiceNo);
    addCreditCardAmount(accumulator, bucket, toNumber(detail.AmountPaid));
    invoiceAccumulator.set(key, accumulator);
  }

  const quickSales = (
    await prisma.quickSale.findMany({
      where: { TransactionDate: { gte: range.startDate, lt: endExclusive } },
      select: {
        Id: true,
        TransactionDate: true,
        ReferenceNo: true,
        TotalAmount: true,
        PaymentTypeParameter: { select: { Name: true } },
        JobStatus: { select: { Name: true, Description: true } },
      },
    })
  ).filter((quickSale) => !isNonPostingStatus(quickSale.JobStatus));

  const quickAccumulator = new Map<string, CreditCardAccumulator>();
  for (const quickSale of quickSales) {
    const bucket = getCreditCardPaymentBucket(
      quickSale.PaymentTypeParameter?.Name ?? "",
    );
    if (bucket === "none") continue;
    const date = startOfDay(quickSale.TransactionDate);
    const ref = quickSale.ReferenceNo?.trim() || `QS-${String(quickSale.Id).padStart(6, "0")}`;
    const key = `${date.toISOString()}|${quickSale.Id}|${ref}`;
    const accumulator =
      quickAccumulator.get(key) ?? newCreditCardAccumulator(date, ref);
    addCreditCardAmount(accumulator, bucket, toNumber(quickSale.TotalAmount));
    quickAccumulator.set(key, accumulator);
  }

  const rows = Array.from(invoiceAccumulator.values())
    .sort(compareCreditCardAccumulator)
    .map(toCreditCardRow);
  const quickRows = Array.from(quickAccumulator.values())
    .sort(compareCreditCardAccumulator)
    .map(toCreditCardRow);

  if (quickRows.length > 0) {
    rows.push({
      dateLabel: "- QUICK",
      referenceNo: "SALES -",
      localCreditTotal: null,
      localDebitTotal: null,
      localTotalAmount: null,
      internationalCreditTotal: null,
      internationalDebitTotal: null,
      internationalTotalAmount: null,
      vatAmount: null,
      withholdingTax: null,
      totalDeduction: null,
      netAmount: null,
      isSectionHeader: true,
    });
    rows.push(...quickRows);
  }

  const numericRows = rows.filter((row) => !row.isSectionHeader);

  return {
    rows,
    totals: {
      localCreditTotal: round(sum(numericRows, (row) => row.localCreditTotal ?? 0)),
      localDebitTotal: round(sum(numericRows, (row) => row.localDebitTotal ?? 0)),
      localTotalAmount: round(sum(numericRows, (row) => row.localTotalAmount ?? 0)),
      internationalCreditTotal: round(
        sum(numericRows, (row) => row.internationalCreditTotal ?? 0),
      ),
      internationalDebitTotal: round(
        sum(numericRows, (row) => row.internationalDebitTotal ?? 0),
      ),
      internationalTotalAmount: round(
        sum(numericRows, (row) => row.internationalTotalAmount ?? 0),
      ),
      totalDeduction: round(sum(numericRows, (row) => row.totalDeduction ?? 0)),
      netAmount: round(sum(numericRows, (row) => row.netAmount ?? 0)),
    },
  };
}

async function buildPaymentTypeReport(paymentTypeId: number, range: DateRange) {
  const paymentType = await prisma.parameter.findFirst({
    where: {
      Id: paymentTypeId,
      ParameterGroup: {
        OR: [{ Name: "PAYMENT TYPE" }, { Code: "PAYMENT TYPE" }],
      },
    },
    select: { Id: true, Name: true },
  });

  if (!paymentType) return null;

  const endExclusive = addDays(range.endDate, 1);
  const rows = (
    await prisma.paymentDetail.findMany({
      where: { PaymentTypeParameterId: paymentTypeId },
      orderBy: [{ PaymentDate: "asc" }, { Id: "asc" }],
      select: {
        AmountPaid: true,
        IsDeposit: true,
        PaymentDate: true,
        PaymentReferenceNo: true,
        Payment: {
          select: {
            ReferenceNo: true,
            PaymentDate: true,
            Customer: {
              select: { FirstName: true, LastName: true },
            },
            JobStatus: { select: { Name: true, Description: true } },
          },
        },
        Invoice: {
          select: {
            Id: true,
            InvoiceNo: true,
            JobOrderId: true,
            JobStatus: { select: { Name: true, Description: true } },
            JobOrder: {
              select: {
                ReferenceNo: true,
              },
            },
          },
        },
      },
    })
  )
    .filter((detail) => {
      const paymentDate = startOfDay(detail.PaymentDate ?? detail.Payment.PaymentDate);
      return (
        paymentDate >= range.startDate &&
        paymentDate < endExclusive &&
        !isNonPostingStatus(detail.Payment.JobStatus) &&
        !isNonPostingStatus(detail.Invoice.JobStatus)
      );
    })
    .map((detail) => ({
      paymentDate: startOfDay(detail.PaymentDate ?? detail.Payment.PaymentDate),
      paymentReferenceNo:
        detail.PaymentReferenceNo?.trim() || detail.Payment.ReferenceNo?.trim() || "",
      invoiceNo:
        detail.Invoice.InvoiceNo?.trim() ||
        `INV-${String(detail.Invoice.Id).padStart(6, "0")}`,
      jobOrderNo:
        detail.Invoice.JobOrder?.ReferenceNo?.trim() ||
        `JO-${String(detail.Invoice.JobOrderId).padStart(6, "0")}`,
      customerName: customerName(detail.Payment.Customer),
      particulars: detail.IsDeposit ? "Deposit" : "Invoice Payment",
      amountPaid: round(toNumber(detail.AmountPaid)),
      isDeposit: detail.IsDeposit,
    }));

  return {
    paymentTypeId: paymentType.Id,
    paymentTypeName: paymentType.Name ?? "",
    rows,
    totals: {
      count: rows.length,
      invoicePaymentAmount: round(
        sum(rows.filter((row) => !row.isDeposit), (row) => row.amountPaid),
      ),
      depositAmount: round(
        sum(rows.filter((row) => row.isDeposit), (row) => row.amountPaid),
      ),
      totalAmount: round(sum(rows, (row) => row.amountPaid)),
    },
  };
}

async function buildAccountsReceivableReport(range: DateRange) {
  const params = new URLSearchParams({
    start: formatInputDate(range.startDate),
    end: formatInputDate(range.endDate),
  });
  const rows = await listAccountsReceivable(params);

  return {
    rows,
    totals: {
      invoiceAmount: round(sum(rows, (row) => Number(row.invoiceAmount))),
      discountAmount: round(sum(rows, (row) => Number(row.discountAmount))),
      depositAmount: round(sum(rows, (row) => Number(row.depositAmount))),
      paidAmount: round(sum(rows, (row) => Number(row.paidAmount))),
      balanceDue: round(sum(rows, (row) => Number(row.balanceDue))),
      currentCount: rows.filter((row) => Number(row.daysOverdue) === 0).length,
      overdueCount: rows.filter((row) => Number(row.daysOverdue) > 0).length,
    },
  };
}

async function buildPettyCashVoucherReport(range: DateRange) {
  const endExclusive = addDays(range.endDate, 1);
  const rows = (
    await prisma.pettyCash.findMany({
      where: {
        TransactionDateTime: { gte: range.startDate, lt: endExclusive },
      },
      orderBy: [{ TransactionDateTime: "asc" }, { Id: "asc" }],
      select: {
        PCNo: true,
        TransactionDateTime: true,
        PayTo: true,
        PaymentReceivedBy: true,
        Particulars: true,
        CashIn: true,
        CashOut: true,
        Balance: true,
        PaidByUser: {
          select: {
            Firstname: true,
            LastName: true,
          },
        },
        JobStatus: { select: { Name: true, Description: true } },
      },
    })
  )
    .filter((row) => !isNonPostingStatus(row.JobStatus))
    .map((row) => ({
      pcvNo: row.PCNo ?? "",
      transactionDate: row.TransactionDateTime,
      payTo: row.PayTo ?? "",
      paymentReceivedBy: row.PaymentReceivedBy ?? "",
      particulars: row.Particulars ?? "",
      cashIn: round(toNumber(row.CashIn)),
      cashOut: round(toNumber(row.CashOut)),
      balance: round(toNumber(row.Balance)),
      encodedBy: userName(row.PaidByUser),
    }));

  return {
    rows,
    totals: {
      cashIn: round(sum(rows, (row) => row.cashIn)),
      cashOut: round(sum(rows, (row) => row.cashOut)),
      endingBalance: rows.length ? rows[rows.length - 1].balance : 0,
    },
  };
}

async function buildStaffMatrixReport(range: DateRange, kind: StaffMatrixKind) {
  const technicians = kind.endsWith("tech");
  const incentives = kind.startsWith("incentives");
  const staff = await getStaffMatrixUsers(technicians);
  const staffIds = new Set(staff.map((row) => row.id));
  const rows: {
    date: Date;
    vehicle: string;
    workDone: string;
    amounts: Record<number, number>;
    total: number;
  }[] = [];

  if (incentives) {
    const endExclusive = addDays(range.endDate, 1);
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { InvoiceDate: { gte: range.startDate, lt: endExclusive } },
          {
            InvoiceDate: null,
            CreatedDateTime: { gte: range.startDate, lt: endExclusive },
          },
        ],
      },
      orderBy: [{ InvoiceDate: "asc" }, { CreatedDateTime: "asc" }, { Id: "asc" }],
      select: {
        Id: true,
        InvoiceDate: true,
        CreatedDateTime: true,
        JobStatus: { select: { Name: true, Description: true } },
      },
    });

    for (const invoice of invoices.filter((row) => !isNonPostingStatus(row.JobStatus))) {
      const detail = await getInvoice(invoice.Id);
      if (!detail) continue;
      const amount = technicians
        ? getTechnicianIncentiveTotal(detail)
        : getServiceAdvisorIncentiveTotal(detail);
      if (amount <= 0) continue;
      const amounts = technicians
        ? splitStaffAmount(
            amount,
            detail.technicians
              .map((technician) => technician.technicianUserId)
              .filter((id) => staffIds.has(id)),
          )
        : staffIds.has(detail.advisorUserId)
          ? { [detail.advisorUserId]: amount }
          : {};
      const total = round(sum(Object.values(amounts), (value) => value));
      if (total <= 0) continue;
      rows.push({
        date: invoice.InvoiceDate ?? invoice.CreatedDateTime,
        vehicle: vehicleSummary(detail.vehicle),
        workDone: technicians ? buildTechnicianIncentiveWorkDone(detail) : "",
        amounts,
        total,
      });
    }
  } else {
    const endExclusive = addDays(range.endDate, 1);
    const paidRows = (
      await prisma.paymentDetail.findMany({
        where: {
          Payment: {
            PaymentDate: { gte: range.startDate, lt: endExclusive },
          },
        },
        select: {
          InvoiceId: true,
          Payment: {
            select: {
              PaymentDate: true,
              JobStatus: { select: { Name: true, Description: true } },
            },
          },
        },
      })
    ).filter((row) => isCompletedStatus(row.Payment.JobStatus));

    const firstPaidDateByInvoice = new Map<number, Date>();
    for (const row of paidRows) {
      const current = firstPaidDateByInvoice.get(row.InvoiceId);
      if (!current || row.Payment.PaymentDate < current) {
        firstPaidDateByInvoice.set(row.InvoiceId, row.Payment.PaymentDate);
      }
    }

    for (const [invoiceId, paidDate] of firstPaidDateByInvoice.entries()) {
      const detail = await getInvoice(invoiceId);
      if (!detail || isNonPostingText(detail.jobStatus?.name ?? "")) continue;
      const amount = round(toNumber(detail.totalAmount));
      if (amount <= 0) continue;
      const amounts = technicians
        ? splitStaffAmount(
            amount,
            detail.technicians
              .map((technician) => technician.technicianUserId)
              .filter((id) => staffIds.has(id)),
          )
        : staffIds.has(detail.advisorUserId)
          ? { [detail.advisorUserId]: amount }
          : {};
      const total = round(sum(Object.values(amounts), (value) => value));
      if (total <= 0) continue;
      rows.push({
        date: paidDate,
        vehicle: vehicleSummary(detail.vehicle),
        workDone: "",
        amounts,
        total,
      });
    }
  }

  rows.sort((left, right) => left.date.getTime() - right.date.getTime());

  return {
    staff,
    rows,
    totals: {
      amounts: Object.fromEntries(
        staff.map((staffMember) => [
          staffMember.id,
          round(sum(rows, (row) => row.amounts[staffMember.id] ?? 0)),
        ]),
      ),
      grandTotal: round(sum(rows, (row) => row.total)),
    },
  };
}

async function buildInspectionPrintPage(id: number) {
  const inspection = await getInspection(id);
  if (!inspection) {
    throw new OperationServiceError("Inspection record was not found.", 404);
  }

  return {
    filename: `inspection-form-${slug(inspection.referenceNo || String(id))}.html`,
    page: {
      title: "Inspection Form",
      subtitle: inspection.referenceNo ?? "",
      companies: await getCompanies(),
      meta: [
        { label: "Date", value: inspection.transactionDate },
        { label: "Customer", value: customerName(inspection.customer) },
        { label: "Vehicle", value: vehicleSummary(inspection.vehicle) },
        { label: "Plate No.", value: inspection.vehicle?.plateNo ?? "" },
        { label: "Inspector", value: `User #${inspection.inspectorUserId}` },
        { label: "Odometer", value: inspection.odometer ?? "" },
      ],
      tables: [
        {
          title: "Inspection Details",
          columns: ["Field", "Value"],
          rows: [
            ["Vehicle Findings", inspection.vehicleFindings ?? ""],
            ["Diagnostic Result", inspection.diagnosticResult ?? ""],
            ["Remarks", inspection.remarks ?? ""],
            ["Checklist", inspection.inspectionDetails ?? ""],
          ],
        },
        {
          title: "Technicians",
          columns: ["Name", "Mobile"],
          rows: inspection.technicians.map((technician) => [
            userName(technician.technicianUser),
            technician.technicianUser?.mobileNumber ?? "",
          ]),
        },
      ],
    } satisfies PrintPage,
  };
}

async function buildEstimatePrintPage(id: number) {
  const estimate = await getEstimate(id);
  if (!estimate) {
    throw new OperationServiceError("Estimate record was not found.", 404);
  }

  return {
    filename: `repair-estimate-form-${slug(estimate.referenceNo || String(id))}.html`,
    page: {
      title: "Repair Estimate Form",
      subtitle: estimate.referenceNo ?? "",
      companies: await getCompanies(),
      meta: operationMeta(estimate),
      summaries: amountSummaries(estimate),
      tables: [
        lineItemsTable("Estimate Lines", estimate),
        techniciansTable(estimate.technicians),
      ],
    } satisfies PrintPage,
  };
}

async function buildJobOrderPrintPage(id: number) {
  const jobOrder = await getJobOrder(id);
  if (!jobOrder) {
    throw new OperationServiceError("Job order record was not found.", 404);
  }

  return {
    filename: `job-order-form-${slug(jobOrder.referenceNo || String(id))}.html`,
    page: {
      title: "Job Order Form",
      subtitle: jobOrder.referenceNo ?? "",
      companies: await getCompanies(),
      meta: operationMeta(jobOrder),
      summaries: amountSummaries(jobOrder),
      tables: [
        lineItemsTable("Job Order Lines", jobOrder),
        techniciansTable(jobOrder.technicians),
      ],
    } satisfies PrintPage,
  };
}

async function buildInvoicePrintPage(id: number) {
  const invoice = await getInvoice(id);
  if (!invoice) {
    throw new OperationServiceError("Invoice record was not found.", 404);
  }

  const [depositAmount, paidAmount] = await Promise.all([
    invoice.jobOrderId > 0 ? getDepositTotalForJobOrder(invoice.jobOrderId) : 0,
    getPaidTotalForInvoice(invoice.id),
  ]);
  const balanceDue = Math.max(0, toNumber(invoice.totalAmount) - depositAmount - paidAmount);

  return {
    filename: `invoice-report-${slug(invoice.invoiceNo || String(id))}.html`,
    page: {
      title: "Invoice Report",
      subtitle: invoice.invoiceNo ?? "",
      companies: await getCompanies(),
      meta: [
        { label: "Invoice Date", value: invoice.invoiceDate },
        { label: "Due Date", value: invoice.dueDate },
        { label: "Customer", value: customerName(invoice.customer) },
        { label: "Vehicle", value: vehicleSummary(invoice.vehicle) },
        { label: "Plate No.", value: invoice.vehicle?.plateNo ?? "" },
        { label: "Job Order", value: invoice.jobOrder?.referenceNo ?? "" },
      ],
      summaries: [
        ...amountSummaries(invoice),
        {
          title: "Payment",
          items: [
            { label: "Deposit", value: depositAmount },
            { label: "Paid", value: paidAmount },
            { label: "Balance Due", value: balanceDue },
          ],
        },
      ],
      tables: [lineItemsTable("Invoice Lines", invoice)],
    } satisfies PrintPage,
  };
}

async function buildPaymentReceiptPrintPage(id: number) {
  const payment = await getPayment(id);
  if (!payment) {
    throw new OperationServiceError("Payment record was not found.", 404);
  }

  return {
    filename: `payment-receipt-${slug(payment.referenceNo || String(id))}.html`,
    page: {
      title: "Payment Receipt",
      subtitle: payment.referenceNo ?? "",
      companies: await getCompanies(),
      meta: [
        { label: "Payment Date", value: payment.paymentDate },
        { label: "Customer", value: payment.customerName },
        { label: "Status", value: payment.jobStatusName },
        { label: "Remarks", value: payment.remarks ?? "" },
      ],
      summaries: [
        {
          title: "Amounts",
          items: [
            { label: "Invoice Total", value: payment.invoiceTotalAmount },
            { label: "VAT12", value: payment.vat12 },
            { label: "Deposit", value: payment.depositAmount },
            { label: "Amount Payable", value: payment.amountPayable },
            { label: "Total Paid", value: payment.totalPaidAmount },
            { label: "Balance", value: payment.balance },
          ],
        },
      ],
      tables: [
        {
          title: "Payment Details",
          columns: [
            "Invoice No.",
            "Job Order No.",
            "Payment Type",
            "Reference No.",
            "Payment Date",
            "Amount",
            "Deposit",
          ],
          rows: payment.paymentDetails.map((detail) => [
            detail.invoiceNo,
            detail.jobOrderNo,
            detail.paymentTypeName,
            detail.paymentReferenceNo,
            detail.paymentDate,
            detail.amountPaid,
            detail.isDeposit,
          ]),
        },
      ],
    } satisfies PrintPage,
  };
}

async function buildPaymentGatePassPrintPage(id: number) {
  const payment = await getPayment(id);
  if (!payment) {
    throw new OperationServiceError("Payment record was not found.", 404);
  }

  if (toNumber(payment.balance) > 0.0001 || !isCompletedStatusName(payment.jobStatusName)) {
    throw new OperationServiceError(
      "Gate pass can only be printed for completed payments with zero remaining balance.",
      400,
    );
  }

  const remainingBalance = await getCustomerRemainingBalance(payment.customerId);
  if (remainingBalance > 0.0001) {
    throw new OperationServiceError(
      "Gate pass can only be printed when the customer has no remaining balance.",
      400,
    );
  }

  const details = payment.paymentDetails.filter((detail) => detail.invoiceId > 0);
  if (details.length === 0) {
    throw new OperationServiceError(
      "Gate pass requires at least one settled invoice.",
      400,
    );
  }

  return {
    filename: `gate-pass-${slug(payment.referenceNo || String(id))}.html`,
    page: {
      title: "Gate Pass",
      subtitle: payment.referenceNo ?? "",
      companies: await getCompanies(),
      meta: [
        { label: "Payment Date", value: payment.paymentDate },
        { label: "Customer", value: payment.customerName },
        { label: "Total Paid", value: payment.totalPaidAmount },
        { label: "Remaining Balance", value: remainingBalance },
        { label: "Remarks", value: payment.remarks ?? "" },
      ],
      tables: [
        {
          title: "Settled Invoices",
          columns: ["Invoice No.", "Job Order No.", "Amount"],
          rows: details.map((detail) => [
            detail.invoiceNo,
            detail.jobOrderNo,
            detail.amountPaid,
          ]),
        },
      ],
    } satisfies PrintPage,
  };
}

type MonthlySalesAccumulator = {
  date: Date;
  sales: number;
  cash: number;
  localCreditCard: number;
  maya: number;
  gCash: number;
  bankTransfer: number;
  localDebitCard: number;
  es: number;
  discount: number;
};

type CreditCardBucket =
  | "none"
  | "localCredit"
  | "localDebit"
  | "internationalCredit"
  | "internationalDebit";

type CreditCardAccumulator = {
  date: Date;
  referenceNo: string;
  localCreditTotal: number;
  localDebitTotal: number;
  internationalCreditTotal: number;
  internationalDebitTotal: number;
};

function buildDailySalesDetailRows(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoice>>>,
): DailySalesDetailRow[] {
  const rows: DailySalesDetailRow[] = [];
  const packages = invoice.packages ?? [];
  const products = invoice.products ?? [];
  const services = invoice.services ?? [];
  const packageIds = new Set(packages.map((item) => item.id));

  for (const packageItem of packages) {
    rows.push({
      particulars: packageItem.name || `PACKAGE ${packageItem.id}`,
      serviceAmount: null,
      discount: null,
      sellingPrice: null,
      emphasize: true,
    });

    for (const product of products.filter(
      (item) => item.isPackage && item.packageId === packageItem.id,
    )) {
      rows.push({
        particulars: productName(product),
        serviceAmount: null,
        discount: null,
        sellingPrice: toNumber(product.amount),
        emphasize: false,
      });
    }

    for (const service of services.filter(
      (item) => item.isPackage && item.packageId === packageItem.id,
    )) {
      rows.push({
        particulars: service.service?.name ?? "",
        serviceAmount: toNumber(service.amount),
        discount: null,
        sellingPrice: null,
        emphasize: false,
      });
    }
  }

  for (const product of products.filter(
    (item) => !item.isPackage && !packageIds.has(item.packageId ?? 0),
  )) {
    rows.push({
      particulars: productName(product),
      serviceAmount: null,
      discount: null,
      sellingPrice: toNumber(product.amount),
      emphasize: false,
    });
  }

  for (const service of services.filter(
    (item) => !item.isPackage && !packageIds.has(item.packageId ?? 0),
  )) {
    rows.push({
      particulars: service.service?.name ?? "",
      serviceAmount: toNumber(service.amount),
      discount: null,
      sellingPrice: null,
      emphasize: false,
    });
  }

  if (rows.length === 0) {
    rows.push({
      particulars: "-",
      serviceAmount: null,
      discount: null,
      sellingPrice: null,
      emphasize: true,
    });
  }

  const discount =
    toNumber(invoice.laborDiscount) +
    toNumber(invoice.productDiscount) +
    toNumber(invoice.additionalDiscount);
  if (discount !== 0) {
    const index = Math.max(
      0,
      rows.findIndex((row) => !row.emphasize),
    );
    rows[index] = { ...rows[index], discount };
  }

  return rows;
}

function lineItemsTable(
  title: string,
  operation: {
    packages?: { id: number; name?: string | null; isAdditional?: boolean }[];
    products?: {
      isPackage: boolean;
      isRequired?: boolean;
      isAdditional?: boolean;
      packageId?: number | null;
      qty?: number;
      amount?: unknown;
      product?: { name?: string | null; displayName?: string | null; partNo?: string | null } | null;
    }[];
    services?: {
      isPackage: boolean;
      isRequired?: boolean;
      isAdditional?: boolean;
      packageId?: number | null;
      amount?: unknown;
      service?: { name?: string | null } | null;
    }[];
  },
): PrintTable {
  const rows: unknown[][] = [];
  const packages = operation.packages ?? [];
  const products = operation.products ?? [];
  const services = operation.services ?? [];
  const packageIds = new Set(packages.map((item) => item.id));

  for (const packageItem of packages) {
    rows.push(["__section", `[PACKAGE] ${packageItem.name || `PACKAGE ${packageItem.id}`}`]);
    for (const product of products.filter(
      (item) => item.isPackage && item.packageId === packageItem.id,
    )) {
      rows.push([
        product.qty ?? "",
        "[P]",
        productName(product),
        product.isRequired ? "Required" : "Suggested",
        product.isAdditional ? "Additional" : "",
        product.amount ?? "",
      ]);
    }
    for (const service of services.filter(
      (item) => item.isPackage && item.packageId === packageItem.id,
    )) {
      rows.push([
        "",
        "[S]",
        service.service?.name ?? "",
        service.isRequired ? "Required" : "Suggested",
        service.isAdditional ? "Additional" : "",
        service.amount ?? "",
      ]);
    }
  }

  for (const product of products.filter(
    (item) => !item.isPackage && !packageIds.has(item.packageId ?? 0),
  )) {
    rows.push([
      product.qty ?? "",
      "[P]",
      productName(product),
      product.isRequired ? "Required" : "Suggested",
      product.isAdditional ? "Additional" : "",
      product.amount ?? "",
    ]);
  }

  for (const service of services.filter(
    (item) => !item.isPackage && !packageIds.has(item.packageId ?? 0),
  )) {
    rows.push([
      "",
      "[S]",
      service.service?.name ?? "",
      service.isRequired ? "Required" : "Suggested",
      service.isAdditional ? "Additional" : "",
      service.amount ?? "",
    ]);
  }

  return {
    title,
    columns: ["Qty", "Type", "Description", "Class", "Tag", "Amount"],
    rows,
  };
}

function techniciansTable(
  technicians: {
    technicianUser?: {
      firstName?: string | null;
      lastName?: string | null;
      mobileNumber?: string | null;
    } | null;
  }[],
): PrintTable {
  return {
    title: "Technicians",
    columns: ["Name", "Mobile"],
    rows: technicians.map((technician) => [
      userName(technician.technicianUser ?? null),
      technician.technicianUser?.mobileNumber ?? "",
    ]),
  };
}

function operationMeta(operation: {
  referenceNo?: string | null;
  transactionDate?: Date | null;
  customer?: { firstName?: string | null; lastName?: string | null; companyName?: string | null } | null;
  vehicle?: {
    plateNo?: string | null;
    vehicleModel?: {
      name?: string | null;
      vehicleMake?: { name?: string | null } | null;
    } | null;
  } | null;
  odometer?: number | null;
  nextOdometerReminder?: number | null;
  summary?: string | null;
  advisorUser?: { firstName?: string | null; lastName?: string | null } | null;
  approverUser?: { firstName?: string | null; lastName?: string | null } | null;
}) {
  return [
    { label: "Reference No.", value: operation.referenceNo ?? "" },
    { label: "Date", value: operation.transactionDate ?? "" },
    { label: "Customer", value: customerName(operation.customer ?? null) },
    { label: "Vehicle", value: vehicleSummary(operation.vehicle ?? null) },
    { label: "Plate No.", value: operation.vehicle?.plateNo ?? "" },
    { label: "Odometer", value: operation.odometer ?? "" },
    { label: "Next Reminder", value: operation.nextOdometerReminder ?? "" },
    { label: "Advisor", value: userName(operation.advisorUser ?? null) },
    { label: "Approver", value: userName(operation.approverUser ?? null) },
    { label: "Summary", value: operation.summary ?? "" },
  ];
}

function amountSummaries(operation: {
  subTotal?: DecimalLike | number | null;
  vat12?: DecimalLike | number | null;
  laborDiscount?: DecimalLike | number | null;
  productDiscount?: DecimalLike | number | null;
  additionalDiscount?: DecimalLike | number | null;
  totalAmount?: DecimalLike | number | null;
}) {
  return [
    {
      title: "Amounts",
      items: [
        { label: "Sub Total", value: operation.subTotal ?? 0 },
        { label: "VAT12", value: operation.vat12 ?? 0 },
        { label: "Labor Discount", value: operation.laborDiscount ?? 0 },
        { label: "Product Discount", value: operation.productDiscount ?? 0 },
        { label: "Additional Discount", value: operation.additionalDiscount ?? 0 },
        { label: "Total Amount", value: operation.totalAmount ?? 0 },
      ],
    },
  ];
}

function parseReportDateRange(
  searchParams: URLSearchParams,
  options: { singleDay?: boolean } = {},
): DateRange {
  const startDate = parseDateParam(searchParams.get("start"));
  const endDate = parseDateParam(searchParams.get("end"));

  if (!startDate || !endDate) {
    throw new OperationServiceError(
      "Start date and end date are required.",
      400,
      "Start date and end date are required.",
    );
  }

  if (endDate < startDate) {
    throw new OperationServiceError(
      "End date must be on or after the start date.",
      400,
      "End date must be on or after the start date.",
    );
  }

  if (options.singleDay && endDate.getTime() !== startDate.getTime()) {
    throw new OperationServiceError(
      "Daily report only supports a single report date.",
      400,
      "Daily report only supports a single report date.",
    );
  }

  return { startDate, endDate };
}

function parseDateParam(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  if (Number.isNaN(parsed.valueOf())) {
    throw new OperationServiceError("Invalid date range.", 400, "Invalid date range.");
  }

  return startOfDay(parsed);
}

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getDepositTotalsByJobOrder(jobOrderIds: number[]) {
  const totals = new Map<number, number>();
  if (jobOrderIds.length === 0) return totals;

  const deposits = await prisma.deposit.findMany({
    where: { JobOrderId: { in: jobOrderIds } },
    select: {
      JobOrderId: true,
      DepositAmount: true,
      JobStatus: { select: { Name: true, Description: true } },
    },
  });

  for (const deposit of deposits) {
    if (isNonPostingStatus(deposit.JobStatus)) continue;
    totals.set(
      deposit.JobOrderId,
      (totals.get(deposit.JobOrderId) ?? 0) + toNumber(deposit.DepositAmount),
    );
  }

  return totals;
}

async function getDepositTotalForJobOrder(jobOrderId: number) {
  const totals = await getDepositTotalsByJobOrder([jobOrderId]);
  return totals.get(jobOrderId) ?? 0;
}

async function getPaidTotalForInvoice(invoiceId: number) {
  const rows = await prisma.paymentDetail.findMany({
    where: { InvoiceId: invoiceId },
    select: {
      AmountPaid: true,
      Payment: {
        select: {
          JobStatus: { select: { Name: true, Description: true } },
        },
      },
    },
  });

  return round(
    rows
      .filter((row) => !isNonPostingStatus(row.Payment.JobStatus))
      .reduce((total, row) => total + toNumber(row.AmountPaid), 0),
  );
}

async function getCustomerRemainingBalance(customerId: number) {
  const params = new URLSearchParams({
    start: "1900-01-01",
    end: `${new Date().getFullYear() + 10}-12-31`,
  });
  const rows = await listAccountsReceivable(params);
  return round(
    rows
      .filter((row) => row.customerId === customerId)
      .reduce((total, row) => total + Number(row.balanceDue), 0),
  );
}

async function getFirstPaymentDateByInvoice(invoiceIds: number[]) {
  const firstPaymentDateByInvoice = new Map<number, Date>();
  if (invoiceIds.length === 0) return firstPaymentDateByInvoice;

  const rows = await prisma.paymentDetail.findMany({
    where: { InvoiceId: { in: invoiceIds } },
    select: {
      InvoiceId: true,
      Payment: {
        select: {
          PaymentDate: true,
          JobStatus: { select: { Name: true, Description: true } },
        },
      },
    },
  });

  for (const row of rows) {
    if (isNonPostingStatus(row.Payment.JobStatus)) continue;
    const current = firstPaymentDateByInvoice.get(row.InvoiceId);
    const paymentDate = startOfDay(row.Payment.PaymentDate);
    if (!current || paymentDate < current) {
      firstPaymentDateByInvoice.set(row.InvoiceId, paymentDate);
    }
  }

  return firstPaymentDateByInvoice;
}

async function getStaffMatrixUsers(technicians: boolean) {
  const users = await prisma.user.findMany({
    where: { IsActive: true },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      Firstname: true,
      LastName: true,
      Role: { select: { Name: true } },
      UserRolesAsUser: {
        select: {
          Role: { select: { Name: true } },
        },
      },
    },
  });

  const token = technicians ? "TECHNICIAN" : "ADVISOR";
  return users
    .filter(
      (user) =>
        roleNameContains(user.Role?.Name, token) ||
        user.UserRolesAsUser.some((role) => roleNameContains(role.Role?.Name, token)),
    )
    .map((user) => ({
      id: user.Id,
      label: user.Firstname?.trim() || userName(user),
    }));
}

function getMonthlyRow(rowsByDate: Map<string, MonthlySalesAccumulator>, date: Date) {
  const key = formatInputDate(date);
  const existing = rowsByDate.get(key);
  if (existing) return existing;

  const row: MonthlySalesAccumulator = {
    date,
    sales: 0,
    cash: 0,
    localCreditCard: 0,
    maya: 0,
    gCash: 0,
    bankTransfer: 0,
    localDebitCard: 0,
    es: 0,
    discount: 0,
  };
  rowsByDate.set(key, row);
  return row;
}

function addMonthlySalesPaymentAmount(
  row: MonthlySalesAccumulator,
  paymentTypeName: string,
  amount: number,
) {
  switch (normalizePaymentType(paymentTypeName)) {
    case "CASH":
      row.cash += amount;
      break;
    case "LOC CREDIT CARD":
    case "LOCAL CREDIT CARD":
      row.localCreditCard += amount;
      break;
    case "MAYA":
      row.maya += amount;
      break;
    case "GCASH":
      row.gCash += amount;
      break;
    case "BANK TRANSFER":
      row.bankTransfer += amount;
      break;
    case "LOC DEBIT CARD":
    case "LOCAL DEBIT CARD":
      row.localDebitCard += amount;
      break;
    default:
      row.es += amount;
      break;
  }
}

function getCreditCardPaymentBucket(paymentTypeName: string): CreditCardBucket {
  switch (normalizePaymentType(paymentTypeName)) {
    case "LOC CREDIT CARD":
    case "LOCAL CREDIT CARD":
    case "LOC CREDIT":
    case "LOCAL CREDIT":
      return "localCredit";
    case "LOC DEBIT CARD":
    case "LOCAL DEBIT CARD":
    case "LOC DEBIT":
    case "LOCAL DEBIT":
      return "localDebit";
    case "INT CREDIT CARD":
    case "INTERNATIONAL CREDIT CARD":
    case "INT CREDIT":
    case "INTERNATIONAL CREDIT":
      return "internationalCredit";
    case "INT DEBIT CARD":
    case "INTERNATIONAL DEBIT CARD":
    case "INT DEBIT":
    case "INTERNATIONAL DEBIT":
      return "internationalDebit";
    default:
      return "none";
  }
}

function newCreditCardAccumulator(
  date: Date,
  referenceNo: string,
): CreditCardAccumulator {
  return {
    date,
    referenceNo,
    localCreditTotal: 0,
    localDebitTotal: 0,
    internationalCreditTotal: 0,
    internationalDebitTotal: 0,
  };
}

function addCreditCardAmount(
  accumulator: CreditCardAccumulator,
  bucket: CreditCardBucket,
  amount: number,
) {
  if (bucket === "localCredit") accumulator.localCreditTotal += amount;
  if (bucket === "localDebit") accumulator.localDebitTotal += amount;
  if (bucket === "internationalCredit") accumulator.internationalCreditTotal += amount;
  if (bucket === "internationalDebit") accumulator.internationalDebitTotal += amount;
}

function toCreditCardRow(accumulator: CreditCardAccumulator) {
  const localCreditTotal = round(accumulator.localCreditTotal);
  const localDebitTotal = round(accumulator.localDebitTotal);
  const localTotalAmount = round(localCreditTotal + localDebitTotal);
  const internationalCreditTotal = round(accumulator.internationalCreditTotal);
  const internationalDebitTotal = round(accumulator.internationalDebitTotal);
  const internationalTotalAmount = round(
    internationalCreditTotal + internationalDebitTotal,
  );
  const localVatSales = round(localTotalAmount * 0.025);
  const internationalVatSales = round(internationalTotalAmount * 0.035);
  const vatAmount = round((localVatSales + internationalVatSales) * 0.12);
  const withholdingTax = round(
    (localTotalAmount + internationalTotalAmount) * 0.004325,
  );
  const totalDeduction = round(
    localVatSales + internationalVatSales + vatAmount + withholdingTax,
  );
  const netAmount = round(
    localTotalAmount + internationalTotalAmount - totalDeduction,
  );

  return {
    dateLabel: formatDisplayDate(accumulator.date),
    referenceNo: accumulator.referenceNo,
    localCreditTotal: nullableAmount(localCreditTotal),
    localDebitTotal: nullableAmount(localDebitTotal),
    localTotalAmount: nullableAmount(localTotalAmount),
    internationalCreditTotal: nullableAmount(internationalCreditTotal),
    internationalDebitTotal: nullableAmount(internationalDebitTotal),
    internationalTotalAmount: nullableAmount(internationalTotalAmount),
    vatAmount: nullableAmount(vatAmount),
    withholdingTax: nullableAmount(withholdingTax),
    totalDeduction: nullableAmount(totalDeduction),
    netAmount: nullableAmount(netAmount),
    isSectionHeader: false,
  };
}

function compareCreditCardAccumulator(
  left: CreditCardAccumulator,
  right: CreditCardAccumulator,
) {
  const dateCompare = left.date.getTime() - right.date.getTime();
  if (dateCompare !== 0) return dateCompare;
  return left.referenceNo.localeCompare(right.referenceNo);
}

function getServiceAdvisorIncentiveTotal(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoice>>>,
) {
  return round(
    sum(invoice.packages, (pkg) => toNumber(pkg.incentiveSA)) +
      sum(invoice.products, (product) => toNumber(product.incentiveSA)),
  );
}

function getTechnicianIncentiveTotal(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoice>>>,
) {
  return round(
    sum(invoice.packages, (pkg) => toNumber(pkg.incentiveTech)) +
      sum(invoice.products, (product) => toNumber(product.incentiveTech)),
  );
}

function buildTechnicianIncentiveWorkDone(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoice>>>,
) {
  const workDone = [
    ...invoice.packages
      .filter((pkg) => toNumber(pkg.incentiveTech) > 0)
      .map((pkg) => pkg.name || `Package ${pkg.id}`),
    ...invoice.products
      .filter((product) => toNumber(product.incentiveTech) > 0)
      .map(productName),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return workDone.length === 0 ? "-" : Array.from(new Set(workDone)).join(", ");
}

function splitStaffAmount(total: number, userIds: number[]) {
  const activeIds = distinct(userIds);
  if (total <= 0 || activeIds.length === 0) return {};
  const amounts: Record<number, number> = {};
  const share = round(total / activeIds.length);

  activeIds.forEach((userId, index) => {
    amounts[userId] =
      index === activeIds.length - 1
        ? round(total - sum(Object.values(amounts), (value) => value))
        : share;
  });

  return amounts;
}

function roundMonthlyRow(row: MonthlySalesAccumulator) {
  return {
    date: row.date,
    sales: round(row.sales),
    cash: round(row.cash),
    localCreditCard: round(row.localCreditCard),
    maya: round(row.maya),
    gCash: round(row.gCash),
    bankTransfer: round(row.bankTransfer),
    localDebitCard: round(row.localDebitCard),
    es: round(row.es),
    discount: round(row.discount),
  };
}

function roundMonthlyTotals(row: MonthlySalesAccumulator) {
  return roundMonthlyRow(row);
}

function addPaymentBreakdownAmount(
  paymentBreakdown: Map<string, number>,
  label: string,
  amount: number,
) {
  const normalized = label.trim();
  if (!normalized || amount === 0) return;
  paymentBreakdown.set(normalized, (paymentBreakdown.get(normalized) ?? 0) + amount);
}

function normalizePaymentType(value: string) {
  return value
    .toUpperCase()
    .replace(/[.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function nullableAmount(value: number) {
  return value === 0 ? null : value;
}

function isNonPostingStatus(
  status: { Name?: string | null; Description?: string | null } | null,
) {
  return isNonPostingText(`${status?.Name ?? ""} ${status?.Description ?? ""}`);
}

function isNonPostingText(value: string) {
  const normalized = value.toUpperCase();
  return (
    normalized.includes("DELETE") ||
    normalized.includes("VOID") ||
    normalized.includes("CANCEL")
  );
}

function isCompletedStatus(
  status: { Name?: string | null; Description?: string | null } | null,
) {
  return isCompletedStatusName(`${status?.Name ?? ""} ${status?.Description ?? ""}`);
}

function isCompletedStatusName(value: string) {
  const normalized = value.toUpperCase();
  return normalized.includes("COMPLETED") || normalized.includes("PAID");
}

function roleNameContains(roleName: string | null | undefined, token: string) {
  return !!roleName && roleName.toUpperCase().includes(token);
}

function customerName(
  customer:
    | {
        firstName?: string | null;
        FirstName?: string | null;
        lastName?: string | null;
        LastName?: string | null;
        companyName?: string | null;
        CompanyName?: string | null;
      }
    | null,
) {
  const firstName = customer?.firstName ?? customer?.FirstName ?? "";
  const lastName = customer?.lastName ?? customer?.LastName ?? "";
  const companyName = customer?.companyName ?? customer?.CompanyName ?? "";
  return `${firstName} ${lastName}`.trim() || companyName.trim();
}

function userName(
  user:
    | {
        firstName?: string | null;
        Firstname?: string | null;
        lastName?: string | null;
        LastName?: string | null;
      }
    | null,
) {
  return `${user?.firstName ?? user?.Firstname ?? ""} ${user?.lastName ?? user?.LastName ?? ""}`.trim();
}

function vehicleSummary(
  vehicle:
    | {
        vehicleModel?: {
          name?: string | null;
          vehicleMake?: { name?: string | null } | null;
        } | null;
        VehicleModel?: {
          Name?: string | null;
          VehicleMake?: { Name?: string | null } | null;
        } | null;
      }
    | null,
) {
  const make =
    vehicle?.vehicleModel?.vehicleMake?.name ??
    vehicle?.VehicleModel?.VehicleMake?.Name ??
    "";
  const model = vehicle?.vehicleModel?.name ?? vehicle?.VehicleModel?.Name ?? "";
  return [make, model].filter(Boolean).join(" ").trim();
}

function productName(product: {
  product?: { name?: string | null; displayName?: string | null; partNo?: string | null } | null;
}) {
  const row = product.product;
  const displayName = row?.displayName?.trim();
  const name = row?.name?.trim();
  const partNo = row?.partNo?.trim();
  return [displayName || name || "", partNo ? `(${partNo})` : ""]
    .filter(Boolean)
    .join(" ");
}

function staffMatrixTitle(kind: StaffMatrixKind) {
  switch (kind) {
    case "commissions-sa":
      return "Commissions SA Report";
    case "commissions-tech":
      return "Commissions Tech Report";
    case "incentives-sa":
      return "Incentives SA Report";
    case "incentives-tech":
      return "Incentives Tech Report";
  }
}

function staffMatrixFilenamePrefix(kind: StaffMatrixKind) {
  switch (kind) {
    case "commissions-sa":
      return "COMMISSIONS-SA";
    case "commissions-tech":
      return "COMMISSIONS-TECH";
    case "incentives-sa":
      return "INCENTIVES-SA";
    case "incentives-tech":
      return "INCENTIVES-TECH";
  }
}

function dateCoverage(range: DateRange) {
  return `Date Coverage: ${formatDisplayDate(range.startDate)} - ${formatDisplayDate(range.endDate)}`;
}

function formatDisplayDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCompactDate(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function slug(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase() || "REPORT";
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: DecimalLike | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function sum<T>(values: T[], selector: (value: T) => number) {
  return values.reduce((total, value) => total + selector(value), 0);
}

function distinct<T>(values: T[]) {
  return Array.from(new Set(values));
}

function summarizeDistinct(values: string[], fallback: string) {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  const unique = Array.from(new Set(normalized.map((value) => value.toUpperCase())));
  if (unique.length === 0) return fallback;
  return unique.length === 1 ? normalized[0] : normalized.join(", ");
}

function groupBy<T, K>(values: T[], keySelector: (value: T) => K) {
  const map = new Map<K, T[]>();
  for (const value of values) {
    const key = keySelector(value);
    const existing = map.get(key) ?? [];
    existing.push(value);
    map.set(key, existing);
  }
  return map;
}
