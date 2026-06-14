import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";

const defaultQuickSaleReference = "QS0000001";

const quickSaleSelect = {
  Id: true,
  IsChangan: true,
  ReferenceNo: true,
  TransactionDate: true,
  JobStatusId: true,
  CustomerId: true,
  PaymentTypeParameterId: true,
  PaymentReferenceNo: true,
  SalesPersonUserId: true,
  Summary: true,
  SubTotal: true,
  VAT12: true,
  Discount: true,
  TotalAmount: true,
  Payment: true,
  Change: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
} as const;

type QuickSaleProductLine = {
  productId: number;
  price: number;
  qty: number;
  amount: number;
};

export async function listQuickSales() {
  const rows = await prisma.quickSale.findMany({
    orderBy: { Id: "asc" },
    select: quickSaleSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo ?? "",
    transactionDate: row.TransactionDate,
    jobStatusId: row.JobStatusId,
    customerId: row.CustomerId,
    paymentTypeParameterId: row.PaymentTypeParameterId,
    paymentReferenceNo: row.PaymentReferenceNo,
    salesPersonUserId: row.SalesPersonUserId,
    summary: row.Summary,
    subTotal: row.SubTotal,
    vat12: row.VAT12,
    discount: row.Discount,
    totalAmount: row.TotalAmount,
    payment: row.Payment,
    change: row.Change,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  }));
}

export async function getNextQuickSaleReferenceNo() {
  const latestRef = await prisma.quickSale.findFirst({
    where: {
      ReferenceNo: {
        not: "",
      },
    },
    orderBy: { Id: "desc" },
    select: { ReferenceNo: true },
  });

  return {
    referenceNo: nextReferenceValue(latestRef?.ReferenceNo ?? ""),
    ReferenceNo: nextReferenceValue(latestRef?.ReferenceNo ?? ""),
  };
}

export async function listQuickSaleSummary() {
  const rows = await prisma.quickSale.findMany({
    orderBy: [{ CreatedDateTime: "desc" }, { Id: "desc" }],
    select: {
      Id: true,
      IsChangan: true,
      ReferenceNo: true,
      TransactionDate: true,
      TotalAmount: true,
      Customer: {
        select: {
          FirstName: true,
          LastName: true,
        },
      },
      PaymentTypeParameter: {
        select: {
          Name: true,
        },
      },
      JobStatus: {
        select: {
          Name: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo ?? "",
    transactionDate: row.TransactionDate,
    customer: customerName(row.Customer),
    paymentMethod: row.PaymentTypeParameter?.Name ?? "",
    totalAmount: row.TotalAmount,
    status: row.JobStatus?.Name ?? "",
  }));
}

export async function getQuickSale(id: number) {
  const row = await prisma.quickSale.findUnique({
    where: { Id: id },
    select: {
      ...quickSaleSelect,
      QuickSalesProductsAsQuickSales: {
        orderBy: { Id: "asc" },
        select: {
          Id: true,
          ProductId: true,
          Price: true,
          Qty: true,
          Amount: true,
          Product: {
            select: {
              Name: true,
              DisplayName: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo,
    transactionDate: row.TransactionDate,
    jobStatusId: row.JobStatusId,
    customerId: row.CustomerId,
    paymentTypeParameterId: row.PaymentTypeParameterId,
    paymentReferenceNo: row.PaymentReferenceNo,
    salesPersonUserId: row.SalesPersonUserId,
    summary: row.Summary,
    subTotal: row.SubTotal,
    vat12: row.VAT12,
    discount: row.Discount,
    totalAmount: row.TotalAmount,
    payment: row.Payment,
    change: row.Change,
    products: row.QuickSalesProductsAsQuickSales.map((item) => ({
      id: item.Id,
      productId: item.ProductId,
      productName: item.Product?.Name ?? item.Product?.DisplayName ?? "",
      price: item.Price,
      qty: item.Qty,
      amount: item.Amount,
    })),
  };
}

export async function createQuickSale(
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const requestedJobStatusId = readInteger(body, "jobStatusId", "JobStatusId");
  const jobStatusId =
    requestedJobStatusId && requestedJobStatusId > 0
      ? requestedJobStatusId
      : await findJobStatusId("OPEN");

  if (!jobStatusId) {
    throw new OperationServiceError("Open job status is not configured.");
  }

  const now = new Date();
  const createdById =
    readInteger(body, "createdById", "CreatedById") ??
    (actorUserId > 0 ? actorUserId : 0);
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const referenceNo =
    readString(body, "referenceNo", "ReferenceNo")?.trim() ||
    (await getNextQuickSaleReferenceNo()).referenceNo;
  const productLines = readProductLines(body);

  await validateQuickSaleProducts(productLines);
  await validateInventoryUsageIfNeeded(jobStatusId, productLines);

  const productPricesById = canEditPrice
    ? new Map<number, number>()
    : await getProductSellingPrices(productLines.map((line) => line.productId));
  const lines = productLines.map((line) =>
    protectProductLinePrice(line, canEditPrice, productPricesById),
  );

  try {
    const created = await prisma.$transaction(async (tx) => {
      const quickSale = await tx.quickSale.create({
        data: {
          IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
          ReferenceNo: referenceNo,
          TransactionDate: readDate(body, "transactionDate", "TransactionDate") ?? now,
          JobStatusId: jobStatusId,
          CustomerId: readInteger(body, "customerId", "CustomerId") ?? 0,
          PaymentTypeParameterId:
            readInteger(body, "paymentTypeParameterId", "PaymentTypeParameterId") ??
            0,
          PaymentReferenceNo:
            readString(body, "paymentReferenceNo", "PaymentReferenceNo") ?? "",
          SalesPersonUserId:
            readInteger(body, "salesPersonUserId", "SalesPersonUserId") ?? 0,
          Summary: readString(body, "summary", "Summary") ?? "",
          SubTotal: readDecimal(body, "subTotal", "SubTotal"),
          VAT12: readDecimal(body, "vat12", "VAT12"),
          Discount: readDecimal(body, "discount", "Discount"),
          TotalAmount: readDecimal(body, "totalAmount", "TotalAmount"),
          Payment: readDecimal(body, "payment", "Payment"),
          Change: readDecimal(body, "change", "Change"),
          CreatedById: createdById,
          CreatedDateTime: now,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
        select: { Id: true },
      });

      await writeQuickSaleProducts(tx, quickSale.Id, lines, {
        createdById,
        updatedById,
        now,
      });

      return quickSale;
    });

    return { id: created.Id };
  } catch (error) {
    throw normalizePrismaError(error, "quick sale");
  }
}

export async function updateQuickSale(
  id: number,
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const existing = await prisma.quickSale.findUnique({
    where: { Id: id },
    select: {
      Id: true,
      JobStatusId: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      QuickSalesProductsAsQuickSales: {
        select: {
          ProductId: true,
          Price: true,
        },
      },
    },
  });

  if (!existing) return false;

  const data: Record<string, unknown> = {
    UpdatedDateTime: new Date(),
    UpdatedById:
      readInteger(body, "updatedById", "UpdatedById") ??
      existing.UpdatedById ??
      (actorUserId > 0 ? actorUserId : 0),
  };

  setIfProvided(data, "IsChangan", body, readBoolean, "isChangan", "IsChangan");
  setIfProvided(data, "ReferenceNo", body, readString, "referenceNo", "ReferenceNo");
  setIfProvided(
    data,
    "TransactionDate",
    body,
    readDate,
    "transactionDate",
    "TransactionDate",
  );
  setIfProvided(data, "CustomerId", body, readInteger, "customerId", "CustomerId");
  setIfProvided(
    data,
    "PaymentTypeParameterId",
    body,
    readInteger,
    "paymentTypeParameterId",
    "PaymentTypeParameterId",
  );
  setIfProvided(
    data,
    "PaymentReferenceNo",
    body,
    readString,
    "paymentReferenceNo",
    "PaymentReferenceNo",
  );
  setIfProvided(
    data,
    "SalesPersonUserId",
    body,
    readInteger,
    "salesPersonUserId",
    "SalesPersonUserId",
  );
  setIfProvided(data, "Summary", body, readString, "summary", "Summary");
  setIfProvided(data, "SubTotal", body, readDecimal, "subTotal", "SubTotal");
  setIfProvided(data, "VAT12", body, readDecimal, "vat12", "VAT12");
  setIfProvided(data, "Discount", body, readDecimal, "discount", "Discount");
  setIfProvided(data, "TotalAmount", body, readDecimal, "totalAmount", "TotalAmount");
  setIfProvided(data, "Payment", body, readDecimal, "payment", "Payment");
  setIfProvided(data, "Change", body, readDecimal, "change", "Change");

  let requestedJobStatusId: number | null = null;
  if (hasField(body, "jobStatusId", "JobStatusId")) {
    requestedJobStatusId = readInteger(body, "jobStatusId", "JobStatusId");
    if (requestedJobStatusId !== null) {
      await rejectReopenTransition(existing.JobStatusId, requestedJobStatusId);
      data.JobStatusId = requestedJobStatusId;
    }
  }

  const shouldReplaceProducts = hasField(body, "products", "Products");
  const productLines = shouldReplaceProducts ? readProductLines(body) : [];
  const effectiveJobStatusId = requestedJobStatusId ?? existing.JobStatusId;

  if (shouldReplaceProducts) {
    await validateQuickSaleProducts(productLines);
  }

  if (shouldReplaceProducts || requestedJobStatusId !== null) {
    const usage = shouldReplaceProducts
      ? aggregateProductUsage(productLines)
      : await getQuickSaleUsage(id);
    await validateInventoryUsageIfNeeded(effectiveJobStatusId, usage, id);
  }

  const existingPricesByProductId = new Map(
    existing.QuickSalesProductsAsQuickSales.map((line) => [
      line.ProductId,
      numberFromDecimal(line.Price),
    ]),
  );
  const productPricesById =
    canEditPrice || productLines.length === 0
      ? new Map<number, number>()
      : await getProductSellingPrices(productLines.map((line) => line.productId));
  const lines = productLines.map((line) => {
    if (canEditPrice) return line;

    const price =
      existingPricesByProductId.get(line.productId) ??
      productPricesById.get(line.productId) ??
      0;

    return {
      ...line,
      price,
      amount: price * line.qty,
    };
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quickSale.update({ where: { Id: id }, data });

      if (shouldReplaceProducts) {
        await tx.quickSalesProduct.deleteMany({ where: { QuickSalesId: id } });
        await writeQuickSaleProducts(tx, id, lines, {
          createdById: existing.CreatedById,
          updatedById: Number(data.UpdatedById ?? existing.UpdatedById ?? 0),
          now: new Date(),
        });
      }
    });

    return true;
  } catch (error) {
    throw normalizePrismaError(error, "quick sale");
  }
}

export async function deleteQuickSale(id: number, actorUserId: number) {
  const existing = await prisma.quickSale.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);
  await prisma.quickSale.update({
    where: { Id: id },
    data: {
      JobStatusId: deletedStatusId,
      UpdatedById: actorUserId > 0 ? actorUserId : 0,
      UpdatedDateTime: new Date(),
    },
  });

  return { id, jobStatusId: deletedStatusId, status: "DELETED" };
}

type QuickSaleProductWriteContext = {
  createdById: number;
  updatedById: number;
  now: Date;
};

type QuickSaleTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function writeQuickSaleProducts(
  tx: QuickSaleTransaction,
  quickSaleId: number,
  products: QuickSaleProductLine[],
  context: QuickSaleProductWriteContext,
) {
  if (products.length === 0) return;

  await tx.quickSalesProduct.createMany({
    data: products.map((product) => ({
      QuickSalesId: quickSaleId,
      ProductId: product.productId,
      Price: product.price,
      Qty: product.qty,
      Amount: product.amount,
      CreatedById: context.createdById,
      CreatedDateTime: context.now,
      UpdatedById: context.updatedById,
      UpdatedDateTime: context.now,
    })),
  });
}

function readProductLines(body: JsonRecord) {
  return readRecordArray(body, "products", "Products")
    .map((item) => ({
      productId: readInteger(item, "productId", "ProductId") ?? 0,
      price: readDecimal(item, "price", "Price"),
      qty: readInteger(item, "qty", "Qty") ?? 0,
      amount: readDecimal(item, "amount", "Amount"),
    }))
    .filter((item) => item.productId > 0);
}

async function validateQuickSaleProducts(products: QuickSaleProductLine[]) {
  const ids = distinctPositiveIds(products.map((line) => line.productId));
  if (ids.length === 0) return;

  const count = await prisma.product.count({ where: { Id: { in: ids } } });
  if (count !== ids.length) {
    throw new OperationServiceError("One or more product ids are invalid.");
  }
}

async function getProductSellingPrices(productIds: number[]) {
  const ids = distinctPositiveIds(productIds);
  if (ids.length === 0) return new Map<number, number>();

  const rows = await prisma.product.findMany({
    where: { Id: { in: ids } },
    select: { Id: true, SellingPrice: true },
  });

  return new Map(rows.map((row) => [row.Id, numberFromDecimal(row.SellingPrice)]));
}

function protectProductLinePrice(
  line: QuickSaleProductLine,
  canEditPrice: boolean,
  productPricesById: Map<number, number>,
) {
  if (canEditPrice) return line;

  const price = productPricesById.get(line.productId) ?? 0;
  return {
    ...line,
    price,
    amount: price * line.qty,
  };
}

async function validateInventoryUsageIfNeeded(
  jobStatusId: number,
  products: QuickSaleProductLine[] | Map<number, number>,
  excludeQuickSaleId?: number,
) {
  if (!(await isInventoryAffectingStatus(jobStatusId))) return;

  const requestedUsage =
    products instanceof Map ? products : aggregateProductUsage(products);
  const stockError = await validateProductUsage(requestedUsage, excludeQuickSaleId);

  if (stockError) {
    throw new OperationServiceError(stockError);
  }
}

function aggregateProductUsage(products: QuickSaleProductLine[]) {
  const usage = new Map<number, number>();

  for (const product of products) {
    if (product.productId > 0) {
      usage.set(product.productId, (usage.get(product.productId) ?? 0) + product.qty);
    }
  }

  return usage;
}

async function getQuickSaleUsage(quickSaleId: number) {
  const products = await prisma.quickSalesProduct.findMany({
    where: { QuickSalesId: quickSaleId },
    select: { ProductId: true, Qty: true },
  });
  const usage = new Map<number, number>();

  for (const product of products) {
    usage.set(product.ProductId, (usage.get(product.ProductId) ?? 0) + product.Qty);
  }

  return usage;
}

async function validateProductUsage(
  requestedUsage: Map<number, number>,
  excludeQuickSaleId?: number,
) {
  if (requestedUsage.size === 0) return null;

  for (const quantity of requestedUsage.values()) {
    if (quantity <= 0) return "Product quantities must be greater than zero.";
  }

  const productIds = [...requestedUsage.keys()];
  const products = await prisma.product.findMany({
    where: { Id: { in: productIds } },
    select: { Id: true, Name: true, DisplayName: true, PartNo: true },
  });

  if (products.length !== productIds.length) {
    return "One or more product ids are invalid.";
  }

  const balances = await getInventoryBalances(excludeQuickSaleId);
  const productNames = new Map(
    products.map((product) => {
      let name = product.DisplayName?.trim() || product.Name;
      if (product.PartNo?.trim()) {
        name = `${name} (${product.PartNo})`;
      }
      return [product.Id, name];
    }),
  );
  const issues = [...requestedUsage.entries()]
    .map(([productId, requested]) => ({
      requested,
      available: balances.get(productId) ?? 0,
      name: productNames.get(productId) ?? `Product #${productId}`,
    }))
    .filter((item) => item.requested > item.available);

  if (issues.length === 0) return null;

  return `Insufficient stock: ${issues
    .map(
      (item) =>
        `${item.name} available ${formatQuantity(item.available)}, requested ${formatQuantity(item.requested)}`,
    )
    .join("; ")}`;
}

async function getInventoryBalances(excludeQuickSaleId?: number) {
  const balances = new Map<number, number>();
  const [manual, jobOrderUsage, quickSaleUsage] = await Promise.all([
    prisma.productInventoryTransaction.findMany({
      select: { ProductId: true, TransactionType: true, Quantity: true },
    }),
    prisma.jobOrderProduct.findMany({
      select: {
        ProductId: true,
        Qty: true,
        JobOrder: {
          select: {
            JobStatus: { select: { Name: true, Description: true } },
          },
        },
      },
    }),
    prisma.quickSalesProduct.findMany({
      where: excludeQuickSaleId
        ? { QuickSalesId: { not: excludeQuickSaleId } }
        : {},
      select: {
        ProductId: true,
        Qty: true,
        QuickSales: {
          select: {
            JobStatus: { select: { Name: true, Description: true } },
          },
        },
      },
    }),
  ]);

  for (const row of manual) {
    addToMap(
      balances,
      row.ProductId,
      signedManualQuantity(row.TransactionType, numberFromDecimal(row.Quantity)),
    );
  }

  for (const row of jobOrderUsage) {
    if (!isCanceledStatus(row.JobOrder.JobStatus)) {
      addToMap(balances, row.ProductId, -row.Qty);
    }
  }

  for (const row of quickSaleUsage) {
    if (!isCanceledStatus(row.QuickSales.JobStatus)) {
      addToMap(balances, row.ProductId, -row.Qty);
    }
  }

  return balances;
}

async function isInventoryAffectingStatus(jobStatusId: number) {
  if (jobStatusId <= 0) return true;

  const status = await prisma.jobStatus.findUnique({
    where: { Id: jobStatusId },
    select: { Name: true, Description: true },
  });

  return !isCanceledStatus(status);
}

function customerName(
  customer: { FirstName: string | null; LastName: string | null } | null,
) {
  return `${customer?.FirstName ?? ""} ${customer?.LastName ?? ""}`.trim();
}

function nextReferenceValue(latestRef: string) {
  if (!latestRef) return defaultQuickSaleReference;

  const match = /^([A-Za-z]*)(\d+)$/.exec(latestRef);
  if (!match) return latestRef;

  const [, prefix, numberText] = match;
  const numberValue = Number(numberText);

  if (!Number.isSafeInteger(numberValue)) return latestRef;

  return `${prefix}${String(numberValue + 1).padStart(numberText.length, "0")}`;
}

function readRecordArray(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) {
      return value.filter(isJsonRecord);
    }
  }

  return [];
}

function readString(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    if (value === null) return null;
    if (typeof value === "string") return value;
  }

  return null;
}

function readInteger(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    const numberValue =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;

    if (Number.isInteger(numberValue)) return numberValue;
  }

  return null;
}

function readDecimal(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return 0;

  for (const key of keys) {
    const value = body[key];
    const numberValue =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;

    if (Number.isFinite(numberValue)) return numberValue;
  }

  return 0;
}

function readBoolean(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
  }

  return null;
}

function readDate(body: JsonRecord | null, ...keys: string[]) {
  if (!body) return null;

  for (const key of keys) {
    const value = body[key];
    if (value === null || value === "") return null;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.valueOf())) return date;
    }
  }

  return null;
}

function setIfProvided<T>(
  data: Record<string, unknown>,
  field: string,
  body: JsonRecord,
  reader: (body: JsonRecord, ...keys: string[]) => T,
  ...keys: string[]
) {
  if (hasField(body, ...keys)) {
    const value = reader(body, ...keys);
    if (value !== null) data[field] = value;
  }
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

async function rejectReopenTransition(
  currentJobStatusId: number,
  requestedJobStatusId: number,
) {
  if (requestedJobStatusId <= 0) return;
  if (!(await isOpenJobStatus(requestedJobStatusId))) return;

  if (currentJobStatusId > 0 && !(await isOpenJobStatus(currentJobStatusId))) {
    throw new OperationServiceError(
      "Re-opening operation records is no longer supported.",
    );
  }
}

async function isOpenJobStatus(jobStatusId: number) {
  const status = await prisma.jobStatus.findFirst({
    where: { Id: jobStatusId, Name: { equals: "OPEN", mode: "insensitive" } },
    select: { Id: true },
  });

  return !!status;
}

async function findJobStatusId(...statusNames: string[]) {
  const normalized = statusNames
    .map((statusName) => statusName.trim())
    .filter(Boolean);
  if (normalized.length === 0) return null;

  const status = await prisma.jobStatus.findFirst({
    where: {
      OR: normalized.map((statusName) => ({
        Name: { equals: statusName, mode: "insensitive" as const },
      })),
    },
    orderBy: { Id: "asc" },
    select: { Id: true },
  });

  return status?.Id ?? null;
}

async function getOrCreateDeletedJobStatusId(actorUserId: number) {
  const existing = await prisma.jobStatus.findFirst({
    where: { Name: { equals: "DELETED", mode: "insensitive" } },
    select: { Id: true },
  });
  if (existing) return existing.Id;

  const now = new Date();
  const actorId = actorUserId > 0 ? actorUserId : 0;
  const created = await prisma.jobStatus.create({
    data: {
      Name: "DELETED",
      Description: "Soft-deleted operation record",
      CreatedById: actorId,
      CreatedDateTime: now,
      UpdatedById: actorId,
      UpdatedDateTime: now,
    },
    select: { Id: true },
  });

  return created.Id;
}

function signedManualQuantity(transactionType: string | null, quantity: number) {
  const type = normalizeInventoryType(transactionType);
  if (type === "Stock Out") return -Math.abs(quantity);
  if (type === "Stock In") return Math.abs(quantity);
  return quantity;
}

function normalizeInventoryType(value: string | null) {
  const key = (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
  if (["stock in", "in", "receive", "receipt", "purchase"].includes(key)) {
    return "Stock In";
  }
  if (["stock out", "out", "issue", "issued", "release"].includes(key)) {
    return "Stock Out";
  }
  if (["adjustment", "adjust"].includes(key)) return "Adjustment";
  return "";
}

function isCanceledStatus(
  status: { Name: string | null; Description: string | null } | null,
) {
  const text = `${status?.Name ?? ""} ${status?.Description ?? ""}`.toUpperCase();
  return text.includes("CANCEL") || text.includes("VOID") || text.includes("DELETE");
}

function numberFromDecimal(value: { toString: () => string } | number | null) {
  if (value === null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function formatQuantity(value: number) {
  return Number.isInteger(value)
    ? value.toFixed(0)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function addToMap(map: Map<number, number>, key: number, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function distinctPositiveIds(values: number[]) {
  return values
    .filter((value) => value > 0)
    .filter((value, index, source) => source.indexOf(value) === index);
}

function normalizePrismaError(error: unknown, entityName: string) {
  if (error instanceof OperationServiceError) return error;

  if (isPrismaError(error)) {
    if (error.code === "P2025") return new OperationServiceError(`${entityName} not found`, 404);
    if (error.code === "P2003") {
      return new OperationServiceError(
        `Invalid linked record for this ${entityName}.`,
      );
    }
  }

  return error;
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  );
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
