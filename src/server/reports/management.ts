import { getInventorySummary, listInventoryChecks } from "@/server/management/service";
import type { PrintPage } from "@/server/reports/html";
import { getCompanies } from "@/server/reports/service";

type PrintBuildResult = {
  filename: string;
  page: PrintPage;
};

export async function buildInventoryProductsPrintPage(
  searchParams: URLSearchParams,
): Promise<PrintBuildResult> {
  const requestedStatus = (searchParams.get("status") ?? "all").trim().toLowerCase();
  const statusLabel =
    requestedStatus === "low-stock"
      ? "Low Stock"
      : requestedStatus === "out-of-stock"
        ? "Out of Stock"
        : "All";
  const inventory = await getInventorySummary();
  const items = inventory.items.filter((item) => {
    if (requestedStatus === "low-stock") return item.stockStatus === "Low Stock";
    if (requestedStatus === "out-of-stock") return item.stockStatus === "Out of Stock";
    return true;
  });

  return {
    filename: `inventory-products-${requestedStatus || "all"}.html`,
    page: {
      title: "Inventory Products Report",
      subtitle: `${statusLabel} products`,
      companies: await getCompanies(),
      summaries: [
        {
          title: "Inventory Summary",
          items: [
            { label: "Total Products", value: inventory.summary.totalProducts },
            { label: "Total On Hand", value: inventory.summary.totalOnHand },
            { label: "Low Stock", value: inventory.summary.lowStockCount },
            { label: "Out of Stock", value: inventory.summary.outOfStockCount },
            { label: "Stock Value", value: inventory.summary.stockValue },
          ],
        },
      ],
      tables: [
        {
          title: "Products",
          columns: [
            "Part No.",
            "Product",
            "Group",
            "Category",
            "Unit",
            "On Hand",
            "Reorder",
            "Status",
            "Purchase Cost",
            "Stock Value",
          ],
          rows: items.map((item) => [
            item.partNo ?? "",
            item.displayName || item.name,
            item.productGroup?.name ?? "",
            item.productCategory?.name ?? "",
            item.unitOfMeasure?.name ?? "",
            item.stockOnHand,
            item.reorderLevel,
            item.stockStatus,
            item.purchaseCost,
            item.stockValue,
          ]),
        },
      ],
    },
  };
}

export async function buildInventoryChecksPrintPage(
  searchParams: URLSearchParams,
): Promise<PrintBuildResult> {
  const params = new URLSearchParams(searchParams);
  params.set("page", "0");
  params.set("pageSize", "100");

  const result = await listInventoryChecks(params);
  const type = searchParams.get("type") ?? "";

  return {
    filename: `inventory-checks-${type || "all"}.html`,
    page: {
      title: "Inventory Checks Report",
      subtitle: reportRangeSubtitle(searchParams),
      companies: await getCompanies(),
      meta: [
        { label: "Check Type", value: type || "All" },
        { label: "Start", value: searchParams.get("start") || "" },
        { label: "End", value: searchParams.get("end") || "" },
        { label: "Records", value: result.total },
      ],
      tables: [
        {
          title: "Checks",
          columns: [
            "Date",
            "Type",
            "Items",
            "Matched",
            "Surplus",
            "Shortage",
            "System Qty",
            "Physical Qty",
            "Net Variance",
            "Notes",
          ],
          rows: result.items.map((item) => [
            item.checkDate,
            item.checkType,
            item.itemCount,
            item.matchedCount,
            item.surplusCount,
            item.shortageCount,
            item.systemQuantityTotal,
            item.physicalQuantityTotal,
            item.netVariance,
            item.notes ?? "",
          ]),
        },
      ],
    },
  };
}

function reportRangeSubtitle(searchParams: URLSearchParams) {
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";
  if (start && end) return `${start} to ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Through ${end}`;
  return undefined;
}

