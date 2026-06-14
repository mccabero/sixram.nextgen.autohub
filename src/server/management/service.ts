import type { JsonRecord } from "@/server/api/body";
import type { Prisma } from "@/generated/prisma/client";
import { hasPermission } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

const canEditPricePermission = "auth.can_edit_price";
const defaultLowStockThreshold = 5;

type ManagementErrorBody =
  | string
  | {
      [key: string]: string | number | boolean | null;
    };

type UniqueDelegate = {
  findUnique(args: {
    where: { Id: number };
    select: { Id: true };
  }): Promise<unknown | null>;
};

type IdName = {
  Id: number;
  Name: string;
  Description?: string | null;
};

type ProductSelector = {
  Id: number;
  Name: string;
  DisplayName: string;
  Description: string | null;
  PartNo: string | null;
  ExpirationDateTime: Date | null;
  PurchaseCost: unknown;
  MarkupRate: unknown;
  SellingPrice: unknown;
  IncentiveSA: unknown;
  IncentiveTech: unknown;
  StorageLocation: string | null;
  LowStockThreshold: unknown;
  IsQuickSalesProduct: boolean;
  SupplierId: number;
  ManufacturerId: number;
  ProductGroupId: number;
  ProductCategoryId: number;
  UnitOfMeasureId: number;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
  Manufacturer?: IdName | null;
  Supplier?: IdName | null;
  UnitOfMeasure?: IdName | null;
  ProductGroup?: IdName | null;
  ProductCategory?: IdName | null;
};

type ProductMutationData =
  | Prisma.ProductUncheckedCreateInput
  | Prisma.ProductUncheckedUpdateInput;

type PackageMutationData =
  | Prisma.PackageUncheckedCreateInput
  | Prisma.PackageUncheckedUpdateInput;

export class ManagementServiceError extends Error {
  readonly status: number;
  readonly body: ManagementErrorBody;

  constructor(
    message: string,
    status = 400,
    body: ManagementErrorBody = { error: message },
  ) {
    super(message);
    this.name = "ManagementServiceError";
    this.status = status;
    this.body = body;
  }
}

const supplierSelect = {
  Id: true,
  Name: true,
  Address: true,
  ContactPerson: true,
  ContactNumber: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

const manufacturerSelect = {
  Id: true,
  Name: true,
  Description: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

const relationIdNameSelect = {
  Id: true,
  Name: true,
  Description: true,
};

const serviceSelect = {
  Id: true,
  Code: true,
  Name: true,
  ServiceGroupId: true,
  ServiceCategoryId: true,
  StandardHours: true,
  StandardRate: true,
  IsReplacement: true,
  IsAllowRateOverride: true,
  IsMechanicRequired: true,
  DisplayStandardHours: true,
  DisplayStandardRate: true,
  DisplayNotes: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
  ServiceGroup: { select: relationIdNameSelect },
  ServiceCategory: { select: relationIdNameSelect },
};

const productSelect = {
  Id: true,
  Name: true,
  DisplayName: true,
  Description: true,
  PartNo: true,
  ExpirationDateTime: true,
  PurchaseCost: true,
  MarkupRate: true,
  SellingPrice: true,
  IncentiveSA: true,
  IncentiveTech: true,
  StorageLocation: true,
  LowStockThreshold: true,
  IsQuickSalesProduct: true,
  SupplierId: true,
  ManufacturerId: true,
  ProductGroupId: true,
  ProductCategoryId: true,
  UnitOfMeasureId: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
  Manufacturer: { select: relationIdNameSelect },
  Supplier: { select: { Id: true, Name: true } },
  UnitOfMeasure: { select: { Id: true, Name: true } },
  ProductGroup: { select: relationIdNameSelect },
  ProductCategory: { select: relationIdNameSelect },
};

const packageSelect = {
  Id: true,
  Name: true,
  Code: true,
  NextServiceReminderDays: true,
  IncentiveSA: true,
  IncentiveTech: true,
  IsHideAmount: true,
  IsHideService: true,
  IsHidePartsAndMaterials: true,
  IsDisplayCode: true,
  Summary: true,
  SubTotal: true,
  VAT12: true,
  TotalAmount: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

export async function listSuppliers() {
  const rows = await prisma.supplier.findMany({
    orderBy: { Id: "asc" },
    select: supplierSelect,
  });
  return rows.map(mapSupplier);
}

export async function getSupplier(id: number) {
  const row = await prisma.supplier.findUnique({
    where: { Id: id },
    select: supplierSelect,
  });
  return row ? mapSupplier(row) : null;
}

export async function createSupplier(body: JsonRecord, actorUserId: number) {
  try {
    const row = await prisma.supplier.create({
      data: {
        Name: readString(body, "name", "Name") ?? "",
        Address: readString(body, "address", "Address"),
        ContactPerson: readString(body, "contactPerson", "ContactPerson") ?? "",
        ContactNumber: readString(body, "contactNumber", "ContactNumber") ?? "",
        ...createAudit(body, actorUserId),
      },
      select: supplierSelect,
    });
    return mapSupplier(row);
  } catch (error) {
    throw normalizePrismaError(error, "supplier");
  }
}

export async function updateSupplier(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const data: Record<string, unknown> = updateAudit(body, actorUserId);
  setIfPresent(data, "Name", body, readStringOrEmpty, "name", "Name");
  setIfPresent(data, "Address", body, readString, "address", "Address");
  setIfPresent(
    data,
    "ContactPerson",
    body,
    readStringOrEmpty,
    "contactPerson",
    "ContactPerson",
  );
  setIfPresent(
    data,
    "ContactNumber",
    body,
    readStringOrEmpty,
    "contactNumber",
    "ContactNumber",
  );

  try {
    await prisma.supplier.update({ where: { Id: id }, data });
  } catch (error) {
    throw normalizePrismaError(error, "supplier");
  }
}

export async function deleteSupplier(id: number) {
  try {
    await prisma.supplier.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error, "supplier");
  }
}

export async function getSupplierProducts(id: number) {
  const supplier = await prisma.supplier.findUnique({
    where: { Id: id },
    select: { Id: true },
  });
  if (!supplier) return null;

  const balances = await getInventoryBalances();
  const rows = await prisma.product.findMany({
    where: { SupplierId: id },
    orderBy: { Id: "asc" },
    select: productSelect,
  });
  return rows.map((row) => mapProduct(row, balances));
}

export async function listManufacturers() {
  const rows = await prisma.manufacturer.findMany({
    orderBy: { Id: "asc" },
    select: manufacturerSelect,
  });
  return rows.map(mapManufacturer);
}

export async function getManufacturer(id: number) {
  const row = await prisma.manufacturer.findUnique({
    where: { Id: id },
    select: manufacturerSelect,
  });
  return row ? mapManufacturer(row) : null;
}

export async function createManufacturer(body: JsonRecord, actorUserId: number) {
  try {
    const row = await prisma.manufacturer.create({
      data: {
        Name: readString(body, "name", "Name") ?? "",
        Description: readString(body, "description", "Description") ?? "",
        ...createAudit(body, actorUserId),
      },
      select: manufacturerSelect,
    });
    return mapManufacturer(row);
  } catch (error) {
    throw normalizePrismaError(error, "manufacturer");
  }
}

export async function updateManufacturer(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const data: Record<string, unknown> = updateAudit(body, actorUserId);
  setIfPresent(data, "Name", body, readStringOrEmpty, "name", "Name");
  setIfPresent(
    data,
    "Description",
    body,
    readStringOrEmpty,
    "description",
    "Description",
  );

  try {
    await prisma.manufacturer.update({ where: { Id: id }, data });
  } catch (error) {
    throw normalizePrismaError(error, "manufacturer");
  }
}

export async function deleteManufacturer(id: number) {
  try {
    await prisma.manufacturer.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error, "manufacturer");
  }
}

export async function getManufacturerProducts(id: number) {
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { Id: id },
    select: { Id: true },
  });
  if (!manufacturer) return null;

  const balances = await getInventoryBalances();
  const rows = await prisma.product.findMany({
    where: { ManufacturerId: id },
    orderBy: { Id: "asc" },
    select: productSelect,
  });
  return rows.map((row) => mapProduct(row, balances));
}

export async function listServices() {
  const rows = await prisma.service.findMany({
    orderBy: { Id: "asc" },
    select: serviceSelect,
  });
  return rows.map(mapService);
}

export async function getService(id: number) {
  const row = await prisma.service.findUnique({
    where: { Id: id },
    select: serviceSelect,
  });
  return row ? mapService(row) : null;
}

export async function createService(
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const serviceGroupId = requiredPositiveInteger(
    body,
    "ServiceGroupId is required",
    "serviceGroupId",
    "ServiceGroupId",
  );
  const serviceCategoryId = requiredPositiveInteger(
    body,
    "ServiceCategoryId is required",
    "serviceCategoryId",
    "ServiceCategoryId",
  );
  await assertExists(
    prisma.serviceGroup,
    serviceGroupId,
    "ServiceGroupId does not exist",
  );
  await assertExists(
    prisma.serviceCategory,
    serviceCategoryId,
    "ServiceCategoryId does not exist",
  );

  try {
    const row = await prisma.service.create({
      data: {
        Name: readString(body, "name", "Name") ?? "",
        Code: readString(body, "code", "Code") ?? "",
        ServiceGroupId: serviceGroupId,
        ServiceCategoryId: serviceCategoryId,
        StandardRate: canEditPrice
          ? readDecimal(body, "standardRate", "StandardRate") ?? 0
          : 0,
        StandardHours: readDecimal(body, "standardHours", "StandardHours") ?? 0,
        IsReplacement: readBoolean(body, "isReplacement", "IsReplacement") ?? false,
        IsAllowRateOverride:
          readBoolean(body, "isAllowRateOverride", "IsAllowRateOverride") ?? false,
        IsMechanicRequired:
          readBoolean(body, "isMechanicRequired", "IsMechanicRequired") ?? false,
        DisplayStandardHours:
          readBoolean(body, "displayStandardHours", "DisplayStandardHours") ?? false,
        DisplayStandardRate:
          readBoolean(body, "displayStandardRate", "DisplayStandardRate") ?? false,
        DisplayNotes: readBoolean(body, "displayNotes", "DisplayNotes") ?? false,
        ...createAudit(body, actorUserId),
      },
      select: serviceSelect,
    });
    return mapService(row);
  } catch (error) {
    throw normalizePrismaError(error, "service");
  }
}

export async function updateService(
  id: number,
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const data: Record<string, unknown> = updateAudit(body, actorUserId);

  if (hasField(body, "serviceGroupId", "ServiceGroupId")) {
    const serviceGroupId = requiredPositiveInteger(
      body,
      "ServiceGroupId is required",
      "serviceGroupId",
      "ServiceGroupId",
    );
    await assertExists(
      prisma.serviceGroup,
      serviceGroupId,
      "ServiceGroupId does not exist",
    );
    data.ServiceGroupId = serviceGroupId;
  }

  if (hasField(body, "serviceCategoryId", "ServiceCategoryId")) {
    const serviceCategoryId = requiredPositiveInteger(
      body,
      "ServiceCategoryId is required",
      "serviceCategoryId",
      "ServiceCategoryId",
    );
    await assertExists(
      prisma.serviceCategory,
      serviceCategoryId,
      "ServiceCategoryId does not exist",
    );
    data.ServiceCategoryId = serviceCategoryId;
  }

  setIfPresent(data, "Name", body, readStringOrEmpty, "name", "Name");
  setIfPresent(data, "Code", body, readStringOrEmpty, "code", "Code");
  if (canEditPrice) {
    setIfPresent(
      data,
      "StandardRate",
      body,
      readDecimalOrZero,
      "standardRate",
      "StandardRate",
    );
  }
  setIfPresent(
    data,
    "StandardHours",
    body,
    readDecimalOrZero,
    "standardHours",
    "StandardHours",
  );
  setIfPresent(
    data,
    "IsReplacement",
    body,
    readBoolean,
    "isReplacement",
    "IsReplacement",
  );
  setIfPresent(
    data,
    "IsAllowRateOverride",
    body,
    readBoolean,
    "isAllowRateOverride",
    "IsAllowRateOverride",
  );
  setIfPresent(
    data,
    "IsMechanicRequired",
    body,
    readBoolean,
    "isMechanicRequired",
    "IsMechanicRequired",
  );
  setIfPresent(
    data,
    "DisplayStandardHours",
    body,
    readBoolean,
    "displayStandardHours",
    "DisplayStandardHours",
  );
  setIfPresent(
    data,
    "DisplayStandardRate",
    body,
    readBoolean,
    "displayStandardRate",
    "DisplayStandardRate",
  );
  setIfPresent(data, "DisplayNotes", body, readBoolean, "displayNotes", "DisplayNotes");

  try {
    await prisma.service.update({ where: { Id: id }, data });
  } catch (error) {
    throw normalizePrismaError(error, "service");
  }
}

export async function deleteService(id: number) {
  try {
    await prisma.service.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error, "service");
  }
}

export async function listProducts(searchParams: URLSearchParams) {
  const includeApplicableVehicleSearch =
    searchParams.get("includeApplicableVehicleSearch")?.toLowerCase() === "true";
  const quickSalesFilter = readBooleanFromString(
    searchParams.get("isQuickSalesProduct"),
  );
  const balances = await getInventoryBalances();

  const rows = await prisma.product.findMany({
    where:
      quickSalesFilter === null
        ? undefined
        : { IsQuickSalesProduct: quickSalesFilter },
    orderBy: { Id: "asc" },
    select: productSelect,
  });

  const applicableLookup = includeApplicableVehicleSearch
    ? await getApplicableVehicleNameLookup()
    : new Map<number, string[]>();

  return rows.map((row) => {
    const applicableNames = applicableLookup.get(row.Id) ?? [];
    return {
      ...mapProduct(row, balances),
      applicableVehicleCount: applicableNames.length,
      applicableVehiclePreview: includeApplicableVehicleSearch
        ? applicableNames.slice(0, 3)
        : [],
      applicableVehicleSearch: includeApplicableVehicleSearch
        ? applicableNames.join(" ")
        : "",
    };
  });
}

export async function getProduct(id: number) {
  const row = await prisma.product.findUnique({
    where: { Id: id },
    select: productSelect,
  });

  if (!row) return null;
  const balances = await getInventoryBalances();
  return mapProduct(row, balances);
}

export async function createProduct(
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const data = await productMutationData(body, actorUserId, canEditPrice, true);

  try {
    const row = await prisma.product.create({
      data: data as Prisma.ProductUncheckedCreateInput,
      select: productSelect,
    });
    const balances = await getInventoryBalances();
    return mapProduct(row, balances);
  } catch (error) {
    throw normalizePrismaError(error, "product");
  }
}

export async function updateProduct(
  id: number,
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const data = await productMutationData(body, actorUserId, canEditPrice, false);

  try {
    await prisma.product.update({
      where: { Id: id },
      data: data as Prisma.ProductUncheckedUpdateInput,
    });
  } catch (error) {
    throw normalizePrismaError(error, "product");
  }
}

export async function deleteProduct(id: number) {
  try {
    await prisma.product.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error, "product");
  }
}

export async function getProductApplicableVehicles(id: number) {
  const product = await prisma.product.findUnique({
    where: { Id: id },
    select: { Id: true },
  });
  if (!product) return null;

  const rows = await prisma.productVehicleModel.findMany({
    where: { ProductId: id },
    orderBy: [
      { VehicleModel: { VehicleMake: { Name: "asc" } } },
      { VehicleModel: { Name: "asc" } },
    ],
    select: {
      Id: true,
      ProductId: true,
      VehicleModelId: true,
      VehicleModel: {
        select: {
          Id: true,
          Name: true,
          Description: true,
          VehicleMakeId: true,
          VehicleMake: {
            select: {
              Id: true,
              Name: true,
              Description: true,
            },
          },
        },
      },
    },
  });

  return {
    productId: id,
    vehicleModelIds: rows.map((row) => row.VehicleModelId),
    items: rows.map((row) => ({
      id: row.Id,
      productId: row.ProductId,
      vehicleModelId: row.VehicleModelId,
      vehicleModel: {
        id: row.VehicleModel.Id,
        name: row.VehicleModel.Name,
        description: row.VehicleModel.Description,
        vehicleMakeId: row.VehicleModel.VehicleMakeId,
        vehicleMake: row.VehicleModel.VehicleMake
          ? mapIdName(row.VehicleModel.VehicleMake)
          : null,
      },
    })),
  };
}

export async function updateProductApplicableVehicles(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const product = await prisma.product.findUnique({
    where: { Id: id },
    select: { Id: true },
  });
  if (!product) return null;

  const vehicleModelIds = readIntegerArray(body, "vehicleModelIds", "VehicleModelIds")
    .filter((vehicleModelId) => vehicleModelId > 0)
    .filter((vehicleModelId, index, values) => values.indexOf(vehicleModelId) === index);

  if (vehicleModelIds.length > 0) {
    const existingVehicleModels = await prisma.vehicleModel.findMany({
      where: { Id: { in: vehicleModelIds } },
      select: { Id: true },
    });
    const existingIds = new Set(existingVehicleModels.map((item) => item.Id));
    const missing = vehicleModelIds.filter(
      (vehicleModelId) => !existingIds.has(vehicleModelId),
    );
    if (missing.length > 0) {
      throw new ManagementServiceError(
        `Some VehicleModelIds do not exist: ${missing.join(",")}`,
      );
    }
  }

  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? actorUserId;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existingLinks = await tx.productVehicleModel.findMany({
      where: { ProductId: id },
      select: { Id: true, VehicleModelId: true },
    });
    const requestedIds = new Set(vehicleModelIds);
    const existingIds = new Set(existingLinks.map((link) => link.VehicleModelId));

    await tx.productVehicleModel.deleteMany({
      where: {
        ProductId: id,
        VehicleModelId: { notIn: vehicleModelIds },
      },
    });

    await tx.productVehicleModel.updateMany({
      where: {
        ProductId: id,
        VehicleModelId: { in: vehicleModelIds },
      },
      data: {
        UpdatedById: updatedById,
        UpdatedDateTime: now,
      },
    });

    const toAdd = vehicleModelIds
      .filter((vehicleModelId) => requestedIds.has(vehicleModelId))
      .filter((vehicleModelId) => !existingIds.has(vehicleModelId))
      .map((vehicleModelId) => ({
        ProductId: id,
        VehicleModelId: vehicleModelId,
        CreatedById: updatedById,
        CreatedDateTime: now,
        UpdatedById: updatedById,
        UpdatedDateTime: now,
      }));

    if (toAdd.length > 0) {
      await tx.productVehicleModel.createMany({ data: toAdd });
    }
  });

  const saved = await prisma.productVehicleModel.findMany({
    where: { ProductId: id },
    orderBy: { VehicleModelId: "asc" },
    select: { VehicleModelId: true },
  });

  return {
    productId: id,
    vehicleModelIds: saved.map((row) => row.VehicleModelId),
  };
}

export async function listPackages() {
  const rows = await prisma.package.findMany({
    orderBy: { Id: "asc" },
    select: packageSelect,
  });
  return rows.map(mapPackage);
}

export async function getPackage(id: number) {
  const row = await prisma.package.findUnique({
    where: { Id: id },
    select: {
      ...packageSelect,
      PackageProductsAsPackage: {
        orderBy: { Id: "asc" },
        select: {
          Id: true,
          PackageId: true,
          ProductId: true,
          Price: true,
          Qty: true,
          Amount: true,
          Product: {
            select: {
              Id: true,
              Name: true,
              DisplayName: true,
              PartNo: true,
              SellingPrice: true,
            },
          },
        },
      },
      PackageServicesAsPackage: {
        orderBy: { Id: "asc" },
        select: {
          Id: true,
          PackageId: true,
          ServiceId: true,
          Rate: true,
          Hours: true,
          Amount: true,
          Service: {
            select: {
              Id: true,
              Code: true,
              Name: true,
              StandardRate: true,
              StandardHours: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  return {
    ...mapPackage(row),
    packageProducts: row.PackageProductsAsPackage.map(mapPackageProduct),
    packageServices: row.PackageServicesAsPackage.map(mapPackageService),
  };
}

export async function createPackage(
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.package.create({
        data: packageHeaderData(
          body,
          actorUserId,
          true,
        ) as Prisma.PackageUncheckedCreateInput,
        select: packageSelect,
      });

      const productRows = await packageProductCreateRows(
        body,
        row.Id,
        canEditPrice,
        actorUserId,
      );
      if (productRows.length > 0) {
        await tx.packageProduct.createMany({ data: productRows });
      }

      const serviceRows = await packageServiceCreateRows(
        body,
        row.Id,
        canEditPrice,
        actorUserId,
      );
      if (serviceRows.length > 0) {
        await tx.packageService.createMany({ data: serviceRows });
      }

      return row;
    });

    return mapPackage(created);
  } catch (error) {
    throw normalizePrismaError(error, "package");
  }
}

export async function updatePackage(
  id: number,
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.package.update({
        where: { Id: id },
        data: packageHeaderData(
          body,
          actorUserId,
          false,
        ) as Prisma.PackageUncheckedUpdateInput,
      });

      if (hasField(body, "packageProducts", "PackageProducts")) {
        await tx.packageProduct.deleteMany({ where: { PackageId: id } });
        const productRows = await packageProductCreateRows(
          body,
          id,
          canEditPrice,
          actorUserId,
        );
        if (productRows.length > 0) {
          await tx.packageProduct.createMany({ data: productRows });
        }
      }

      if (hasField(body, "packageServices", "PackageServices")) {
        await tx.packageService.deleteMany({ where: { PackageId: id } });
        const serviceRows = await packageServiceCreateRows(
          body,
          id,
          canEditPrice,
          actorUserId,
        );
        if (serviceRows.length > 0) {
          await tx.packageService.createMany({ data: serviceRows });
        }
      }
    });
  } catch (error) {
    throw normalizePrismaError(error, "package");
  }
}

export async function deletePackage(id: number) {
  try {
    await prisma.package.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error, "package");
  }
}

export async function getInventorySummary() {
  const balances = await getInventoryBalances();
  const rows = await prisma.product.findMany({
    orderBy: { Id: "asc" },
    select: productSelect,
  });
  const items = rows.map((row) => mapInventoryProduct(row, balances));

  return {
    items,
    summary: {
      totalProducts: items.length,
      totalOnHand: sum(items.map((item) => item.stockOnHand)),
      lowStockCount: items.filter((item) => item.stockStatus === "Low Stock").length,
      outOfStockCount: items.filter((item) => item.stockStatus === "Out of Stock").length,
      stockValue: sum(items.map((item) => item.stockValue)),
    },
  };
}

export async function getInventoryProductTransactions(productId: number) {
  const product = await prisma.product.findUnique({
    where: { Id: productId },
    select: { Id: true },
  });
  if (!product) return null;

  const manual = await prisma.productInventoryTransaction.findMany({
    where: { ProductId: productId },
    orderBy: [{ TransactionDateTime: "desc" }, { Id: "desc" }],
    select: {
      Id: true,
      ProductId: true,
      TransactionType: true,
      Quantity: true,
      TransactionDateTime: true,
      ReferenceNo: true,
      Notes: true,
    },
  });

  const jobOrders = await prisma.jobOrderProduct.findMany({
    where: { ProductId: productId },
    orderBy: [{ CreatedDateTime: "desc" }, { Id: "desc" }],
    select: {
      Id: true,
      ProductId: true,
      Qty: true,
      CreatedDateTime: true,
      JobOrder: {
        select: {
          ReferenceNo: true,
          TransactionDate: true,
        },
      },
    },
  });

  const quickSales = await prisma.quickSalesProduct.findMany({
    where: { ProductId: productId },
    orderBy: [{ CreatedDateTime: "desc" }, { Id: "desc" }],
    select: {
      Id: true,
      ProductId: true,
      Qty: true,
      QuickSales: {
        select: {
          ReferenceNo: true,
          TransactionDate: true,
        },
      },
    },
  });

  return [
    ...manual.map((row) => ({
      id: `manual-${row.Id}`,
      manualTransactionId: row.Id,
      productId: row.ProductId,
      sourceType: "Manual",
      transactionType: normalizeInventoryType(row.TransactionType),
      quantity: signedManualQuantity(row.TransactionType, row.Quantity),
      transactionDateTime: row.TransactionDateTime,
      referenceNo: row.ReferenceNo,
      notes: row.Notes,
      isManual: true,
    })),
    ...jobOrders.map((row) => ({
      id: `joborder-${row.Id}`,
      manualTransactionId: null,
      productId: row.ProductId,
      sourceType: "Job Order",
      transactionType: "Stock Out",
      quantity: -row.Qty,
      transactionDateTime: row.JobOrder.TransactionDate ?? row.CreatedDateTime,
      referenceNo: row.JobOrder.ReferenceNo ?? "",
      notes: "Used in job order",
      isManual: false,
    })),
    ...quickSales.map((row) => ({
      id: `quicksale-${row.Id}`,
      manualTransactionId: null,
      productId: row.ProductId,
      sourceType: "Quick Sale",
      transactionType: "Stock Out",
      quantity: -row.Qty,
      transactionDateTime: row.QuickSales.TransactionDate,
      referenceNo: row.QuickSales.ReferenceNo ?? "",
      notes: "Sold through quick sale",
      isManual: false,
    })),
  ].sort(compareInventoryRows);
}

export async function getInventoryAudit(searchParams: URLSearchParams) {
  const wantsPagedResponse =
    searchParams.has("page") ||
    searchParams.has("pageSize") ||
    !!searchParams.get("search")?.trim();
  const page = Math.max(readPositiveIntFromString(searchParams.get("page")) ?? 0, 0);
  const pageSize = Math.min(
    Math.max(readPositiveIntFromString(searchParams.get("pageSize")) ?? 25, 1),
    100,
  );
  const finalTake = wantsPagedResponse ? pageSize : 500;
  const offset = wantsPagedResponse ? page * pageSize : 0;
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

  const productsById = await productInventoryLookup();
  const manual = await prisma.productInventoryTransaction.findMany({
    orderBy: [{ TransactionDateTime: "desc" }, { Id: "desc" }],
    take: offset + finalTake + 1,
    select: {
      Id: true,
      ProductId: true,
      TransactionType: true,
      Quantity: true,
      TransactionDateTime: true,
      ReferenceNo: true,
      Notes: true,
    },
  });
  const jobOrders = await inventoryJobOrderRows(offset + finalTake + 1);
  const quickSales = await inventoryQuickSaleRows(offset + finalTake + 1);

  const rows = [
    ...manual.map((row) => {
      const product = productsById.get(row.ProductId);
      return {
        id: `manual-${row.Id}`,
        manualTransactionId: row.Id,
        productId: row.ProductId,
        productName: product?.name ?? "",
        unitOfMeasure: product?.unitOfMeasure ?? "",
        sourceType: "Manual",
        transactionType: normalizeInventoryType(row.TransactionType),
        quantity: signedManualQuantity(row.TransactionType, row.Quantity),
        transactionDateTime: row.TransactionDateTime,
        referenceNo: row.ReferenceNo ?? "",
        notes: row.Notes ?? "",
        isManual: true,
      };
    }),
    ...jobOrders,
    ...quickSales,
  ]
    .filter((row) => inventoryRowMatches(row, search))
    .sort(compareInventoryRows);

  const fetched = rows.slice(offset, offset + finalTake + 1);
  const items = fetched.slice(0, finalTake);
  const hasMore = fetched.length > finalTake;

  if (!wantsPagedResponse) {
    return items;
  }

  return {
    items,
    total: offset + items.length + (hasMore ? 1 : 0),
    hasMore,
    page,
    pageSize,
  };
}

export async function createInventoryTransaction(
  body: JsonRecord,
  actorUserId: number,
) {
  const productId = requiredPositiveInteger(
    body,
    "ProductId is required",
    "productId",
    "ProductId",
  );
  await assertExists(prisma.product, productId, "ProductId does not exist");

  const transactionType = normalizeInventoryType(
    readString(body, "transactionType", "TransactionType"),
  );
  if (!transactionType) {
    throw new ManagementServiceError(
      "TransactionType must be Stock In, Stock Out, or Adjustment",
    );
  }

  const requestedQuantity = readDecimal(body, "quantity", "Quantity") ?? 0;
  if (requestedQuantity === 0) {
    throw new ManagementServiceError("Quantity must not be zero");
  }

  const stockError = await validateManualTransaction(
    productId,
    transactionType,
    requestedQuantity,
  );
  if (stockError) throw new ManagementServiceError(stockError);

  const quantity =
    transactionType === "Adjustment"
      ? requestedQuantity
      : Math.abs(requestedQuantity);
  const now = new Date();
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;

  const row = await prisma.productInventoryTransaction.create({
    data: {
      ProductId: productId,
      TransactionType: transactionType,
      Quantity: quantity,
      TransactionDateTime:
        readDate(body, "transactionDateTime", "TransactionDateTime") ?? now,
      ReferenceNo: readString(body, "referenceNo", "ReferenceNo") ?? "",
      Notes: readString(body, "notes", "Notes") ?? "",
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    },
    select: { Id: true },
  });

  return { id: row.Id };
}

export async function deleteInventoryTransaction(id: number) {
  try {
    await prisma.productInventoryTransaction.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error, "inventory transaction");
  }
}

export async function reconcileInventory(body: JsonRecord, actorUserId: number) {
  const productId = requiredPositiveInteger(
    body,
    "ProductId is required",
    "productId",
    "ProductId",
  );
  const product = await prisma.product.findUnique({
    where: { Id: productId },
    select: { Id: true, Name: true, DisplayName: true, PartNo: true },
  });
  if (!product) throw new ManagementServiceError("ProductId does not exist");

  const physicalQuantity = readDecimal(
    body,
    "physicalQuantity",
    "PhysicalQuantity",
  );
  if (physicalQuantity === null) {
    throw new ManagementServiceError("PhysicalQuantity is required");
  }
  if (physicalQuantity < 0) {
    throw new ManagementServiceError("PhysicalQuantity must be zero or greater");
  }

  const balances = await getInventoryBalances();
  const systemQuantity = balances.get(productId) ?? 0;
  const variance = physicalQuantity - systemQuantity;
  const productName = productDisplayName(product);

  if (variance === 0) {
    return {
      productId,
      productName,
      systemQuantity,
      physicalQuantity,
      variance,
      transactionId: null,
      message: "No adjustment needed. System stock already matches the physical count.",
    };
  }

  const now = new Date();
  const referenceNo =
    readString(body, "referenceNo", "ReferenceNo") ??
    `RECON-${formatReferenceTimestamp(now)}`;
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;

  const transaction = await prisma.productInventoryTransaction.create({
    data: {
      ProductId: productId,
      TransactionType: "Adjustment",
      Quantity: variance,
      TransactionDateTime:
        readDate(body, "transactionDateTime", "TransactionDateTime") ?? now,
      ReferenceNo: referenceNo,
      Notes:
        readString(body, "notes", "Notes") ??
        `Inventory reconciliation for ${productName}. System ${formatQuantity(
          systemQuantity,
        )}, physical ${formatQuantity(physicalQuantity)}.`,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    },
    select: { Id: true },
  });

  return {
    productId,
    productName,
    systemQuantity,
    physicalQuantity,
    variance,
    transactionId: transaction.Id,
    referenceNo,
    message: "Inventory reconciliation adjustment recorded.",
  };
}

export async function listInventoryChecks(searchParams: URLSearchParams) {
  const normalizedType = searchParams.get("type")?.trim()
    ? normalizeInventoryCheckType(searchParams.get("type"))
    : "";
  if (searchParams.get("type")?.trim() && !normalizedType) {
    throw new ManagementServiceError("Check type must be end-of-day or month-end.");
  }

  const startDate = readDateFromString(searchParams.get("start"))?.dateOnly;
  const endDate = readDateFromString(searchParams.get("end"))?.dateOnly;
  if (startDate && endDate && endDate < startDate) {
    throw new ManagementServiceError("End date must be on or after start date.");
  }

  const page = Math.max(readPositiveIntFromString(searchParams.get("page")) ?? 0, 0);
  const pageSize = Math.min(
    Math.max(readPositiveIntFromString(searchParams.get("pageSize")) ?? 10, 1),
    100,
  );

  const where = {
    ...(normalizedType ? { CheckType: normalizedType } : {}),
    ...(startDate || endDate
      ? {
          CheckDate: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const total = await prisma.productInventoryCheck.count({ where });
  const rows = await prisma.productInventoryCheck.findMany({
    where,
    orderBy: [{ CheckDate: "desc" }, { Id: "desc" }],
    skip: page * pageSize,
    take: pageSize,
    select: {
      Id: true,
      CheckType: true,
      CheckDate: true,
      Notes: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      UpdatedDateTime: true,
      ProductInventoryCheckItemsAsProductInventoryCheck: {
        select: {
          SystemQuantity: true,
          PhysicalQuantity: true,
          Variance: true,
        },
      },
    },
  });

  return {
    items: rows.map((row) => {
      const items = row.ProductInventoryCheckItemsAsProductInventoryCheck;
      return {
        id: row.Id,
        checkType: row.CheckType,
        checkDate: row.CheckDate,
        notes: row.Notes,
        itemCount: items.length,
        matchedCount: items.filter((item) => numberFromDecimal(item.Variance) === 0).length,
        surplusCount: items.filter((item) => numberFromDecimal(item.Variance) > 0).length,
        shortageCount: items.filter((item) => numberFromDecimal(item.Variance) < 0).length,
        systemQuantityTotal: sum(items.map((item) => numberFromDecimal(item.SystemQuantity))),
        physicalQuantityTotal: sum(items.map((item) => numberFromDecimal(item.PhysicalQuantity))),
        netVariance: sum(items.map((item) => numberFromDecimal(item.Variance))),
        createdById: row.CreatedById,
        createdDateTime: row.CreatedDateTime,
        updatedById: row.UpdatedById,
        updatedDateTime: row.UpdatedDateTime,
      };
    }),
    total,
    page,
    pageSize,
  };
}

export async function getInventoryCheck(id: number) {
  const row = await prisma.productInventoryCheck.findUnique({
    where: { Id: id },
    select: {
      Id: true,
      CheckType: true,
      CheckDate: true,
      Notes: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      UpdatedDateTime: true,
      ProductInventoryCheckItemsAsProductInventoryCheck: {
        orderBy: { Id: "asc" },
        select: {
          Id: true,
          ProductInventoryCheckId: true,
          ProductId: true,
          SystemQuantity: true,
          PhysicalQuantity: true,
          Variance: true,
          Notes: true,
          Product: {
            select: {
              Name: true,
              DisplayName: true,
              PartNo: true,
              StorageLocation: true,
              UnitOfMeasure: { select: { Name: true } },
              ProductGroup: { select: { Name: true } },
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.Id,
    checkType: row.CheckType,
    checkDate: row.CheckDate,
    notes: row.Notes,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
    items: row.ProductInventoryCheckItemsAsProductInventoryCheck.map((item) => {
      const variance = numberFromDecimal(item.Variance);
      return {
        id: item.Id,
        productInventoryCheckId: item.ProductInventoryCheckId,
        productId: item.ProductId,
        productName: productDisplayName(item.Product),
        partNo: item.Product.PartNo,
        storageLocation: item.Product.StorageLocation,
        unitOfMeasureName: item.Product.UnitOfMeasure.Name,
        productGroupName: item.Product.ProductGroup.Name,
        systemQuantity: numberFromDecimal(item.SystemQuantity),
        physicalQuantity: numberFromDecimal(item.PhysicalQuantity),
        variance,
        varianceStatus: getInventoryCheckStatus(variance),
        notes: item.Notes,
      };
    }),
  };
}

export async function createInventoryCheck(
  body: JsonRecord,
  actorUserId: number,
) {
  const checkType = normalizeInventoryCheckType(
    readString(body, "checkType", "CheckType"),
  );
  if (!checkType) {
    throw new ManagementServiceError("CheckType must be end-of-day or month-end.");
  }

  const requestedDate =
    readDate(body, "checkDate", "CheckDate") ?? dateOnly(new Date());
  const checkDate = normalizeInventoryCheckDate(checkType, requestedDate);
  const duplicate = await prisma.productInventoryCheck.findFirst({
    where: { CheckType: checkType, CheckDate: checkDate },
    select: { Id: true },
  });
  if (duplicate) {
    throw new ManagementServiceError(
      `${checkType} inventory check already exists for ${formatShortDate(checkDate)}.`,
      409,
      `${checkType} inventory check already exists for ${formatShortDate(checkDate)}.`,
    );
  }

  const itemRequests = readRecordArray(body, "items", "Items").filter(
    (item) => (readPositiveInteger(item, "productId", "ProductId") ?? 0) > 0,
  );
  if (itemRequests.length === 0) {
    throw new ManagementServiceError("At least one inventory check item is required.");
  }
  if (
    itemRequests.some(
      (item) => readDecimal(item, "physicalQuantity", "PhysicalQuantity") === null,
    )
  ) {
    throw new ManagementServiceError(
      "PhysicalQuantity is required for every inventory check item.",
    );
  }
  if (
    itemRequests.some(
      (item) =>
        (readDecimal(item, "physicalQuantity", "PhysicalQuantity") ?? 0) < 0,
    )
  ) {
    throw new ManagementServiceError("PhysicalQuantity must be zero or greater.");
  }

  const productIds = itemRequests.map((item) =>
    readPositiveInteger(item, "productId", "ProductId"),
  ) as number[];
  const duplicateProductId = firstDuplicate(productIds);
  if (duplicateProductId) {
    throw new ManagementServiceError(
      `ProductId ${duplicateProductId} appears more than once.`,
    );
  }

  const products = await prisma.product.findMany({
    where: { Id: { in: productIds } },
    orderBy: [{ DisplayName: "asc" }, { Name: "asc" }, { PartNo: "asc" }],
    select: { Id: true, Name: true, DisplayName: true, PartNo: true },
  });
  if (products.length !== productIds.length) {
    const found = new Set(products.map((product) => product.Id));
    const missing = productIds.filter((id) => !found.has(id));
    throw new ManagementServiceError(
      `Some ProductIds do not exist: ${missing.join(",")}`,
    );
  }

  const balances = await getInventoryBalances();
  const requestsByProductId = new Map(
    itemRequests.map((item) => [
      readPositiveInteger(item, "productId", "ProductId") ?? 0,
      item,
    ]),
  );
  const now = new Date();
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;

  const check = await prisma.productInventoryCheck.create({
    data: {
      CheckType: checkType,
      CheckDate: checkDate,
      Notes: readString(body, "notes", "Notes") ?? "",
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
      ProductInventoryCheckItemsAsProductInventoryCheck: {
        create: products.map((product) => {
          const request = requestsByProductId.get(product.Id) ?? {};
          const systemQuantity = balances.get(product.Id) ?? 0;
          const physicalQuantity =
            readDecimal(request, "physicalQuantity", "PhysicalQuantity") ?? 0;
          return {
            ProductId: product.Id,
            SystemQuantity: systemQuantity,
            PhysicalQuantity: physicalQuantity,
            Variance: physicalQuantity - systemQuantity,
            Notes: readString(request, "notes", "Notes") ?? "",
            CreatedById: createdById,
            CreatedDateTime: now,
            UpdatedById: updatedById,
            UpdatedDateTime: now,
          };
        }),
      },
    },
    select: {
      Id: true,
      CheckType: true,
      CheckDate: true,
      ProductInventoryCheckItemsAsProductInventoryCheck: {
        select: { Variance: true },
      },
    },
  });

  const variances = check.ProductInventoryCheckItemsAsProductInventoryCheck.map(
    (item) => numberFromDecimal(item.Variance),
  );
  return {
    id: check.Id,
    checkType: check.CheckType,
    checkDate: check.CheckDate,
    itemCount: variances.length,
    matchedCount: variances.filter((variance) => variance === 0).length,
    surplusCount: variances.filter((variance) => variance > 0).length,
    shortageCount: variances.filter((variance) => variance < 0).length,
    netVariance: sum(variances),
    message: `${check.CheckType} inventory check saved.`,
  };
}

export async function getCanEditPrice(userId: number) {
  return hasPermission(userId, canEditPricePermission);
}

function mapSupplier(row: {
  Id: number;
  Name: string;
  Address: string | null;
  ContactPerson: string;
  ContactNumber: string;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
}) {
  return {
    id: row.Id,
    name: row.Name,
    address: row.Address,
    contactPerson: row.ContactPerson,
    contactNumber: row.ContactNumber,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapManufacturer(row: {
  Id: number;
  Name: string;
  Description: string | null;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
}) {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapIdName(row: IdName) {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description ?? null,
  };
}

function mapService(row: {
  Id: number;
  Code: string;
  Name: string;
  ServiceGroupId: number;
  ServiceCategoryId: number;
  StandardHours: unknown;
  StandardRate: unknown;
  IsReplacement: boolean;
  IsAllowRateOverride: boolean;
  IsMechanicRequired: boolean;
  DisplayStandardHours: boolean;
  DisplayStandardRate: boolean;
  DisplayNotes: boolean;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
  ServiceGroup: IdName | null;
  ServiceCategory: IdName | null;
}) {
  return {
    id: row.Id,
    code: row.Code,
    name: row.Name,
    serviceGroupId: row.ServiceGroupId,
    serviceCategoryId: row.ServiceCategoryId,
    standardHours: numberFromDecimal(row.StandardHours),
    standardRate: numberFromDecimal(row.StandardRate),
    isReplacement: row.IsReplacement,
    isAllowRateOverride: row.IsAllowRateOverride,
    isMechanicRequired: row.IsMechanicRequired,
    displayStandardHours: row.DisplayStandardHours,
    displayStandardRate: row.DisplayStandardRate,
    displayNotes: row.DisplayNotes,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
    serviceGroup: row.ServiceGroup ? mapIdName(row.ServiceGroup) : null,
    serviceCategory: row.ServiceCategory ? mapIdName(row.ServiceCategory) : null,
  };
}

function mapProduct(
  row: ProductSelector,
  balances = new Map<number, number>(),
) {
  const stockOnHand = balances.get(row.Id) ?? 0;
  const lowStockThreshold = effectiveLowStock(row.LowStockThreshold);

  return {
    id: row.Id,
    name: row.Name,
    displayName: row.DisplayName,
    description: row.Description,
    partNo: row.PartNo,
    expirationDateTime: row.ExpirationDateTime,
    purchaseCost: numberFromDecimal(row.PurchaseCost),
    markupRate: numberFromDecimal(row.MarkupRate),
    sellingPrice: numberFromDecimal(row.SellingPrice),
    incentiveSA: numberFromDecimal(row.IncentiveSA),
    incentiveTech: numberFromDecimal(row.IncentiveTech),
    storageLocation: row.StorageLocation,
    lowStockThreshold,
    reorderLevel: lowStockThreshold,
    isQuickSalesProduct: row.IsQuickSalesProduct,
    supplierId: row.SupplierId,
    manufacturerId: row.ManufacturerId,
    productGroupId: row.ProductGroupId,
    productCategoryId: row.ProductCategoryId,
    unitOfMeasureId: row.UnitOfMeasureId,
    stockOnHand,
    stockStatus: getStockStatus(stockOnHand, lowStockThreshold),
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
    manufacturer: row.Manufacturer ? mapIdName(row.Manufacturer) : null,
    supplier: row.Supplier ? mapIdName(row.Supplier) : null,
    unitOfMeasure: row.UnitOfMeasure ? mapIdName(row.UnitOfMeasure) : null,
    productGroup: row.ProductGroup ? mapIdName(row.ProductGroup) : null,
    productCategory: row.ProductCategory ? mapIdName(row.ProductCategory) : null,
  };
}

function mapInventoryProduct(
  row: ProductSelector,
  balances: Map<number, number>,
) {
  const product = mapProduct(row, balances);
  return {
    ...product,
    stockValue: product.stockOnHand * product.purchaseCost,
  };
}

function mapPackage(row: {
  Id: number;
  Name: string;
  Code: string;
  NextServiceReminderDays: number;
  IncentiveSA: unknown;
  IncentiveTech: unknown;
  IsHideAmount: boolean;
  IsHideService: boolean;
  IsHidePartsAndMaterials: boolean;
  IsDisplayCode: boolean;
  Summary: string | null;
  SubTotal: unknown;
  VAT12: unknown;
  TotalAmount: unknown;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
}) {
  return {
    id: row.Id,
    name: row.Name,
    code: row.Code,
    nextServiceReminderDays: row.NextServiceReminderDays,
    incentiveSA: numberFromDecimal(row.IncentiveSA),
    incentiveTech: numberFromDecimal(row.IncentiveTech),
    isHideAmount: row.IsHideAmount,
    isHideService: row.IsHideService,
    isHidePartsAndMaterials: row.IsHidePartsAndMaterials,
    isDisplayCode: row.IsDisplayCode,
    summary: row.Summary,
    subTotal: numberFromDecimal(row.SubTotal),
    vat12: numberFromDecimal(row.VAT12),
    totalAmount: numberFromDecimal(row.TotalAmount),
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapPackageProduct(row: {
  Id: number;
  PackageId: number;
  ProductId: number;
  Price: unknown;
  Qty: number;
  Amount: unknown;
  Product: {
    Id: number;
    Name: string;
    DisplayName: string;
    PartNo: string | null;
    SellingPrice: unknown;
  };
}) {
  return {
    id: row.Id,
    packageId: row.PackageId,
    productId: row.ProductId,
    price: numberFromDecimal(row.Price),
    qty: row.Qty,
    amount: numberFromDecimal(row.Amount),
    product: {
      id: row.Product.Id,
      name: row.Product.Name,
      displayName: row.Product.DisplayName,
      partNo: row.Product.PartNo,
      sellingPrice: numberFromDecimal(row.Product.SellingPrice),
    },
  };
}

function mapPackageService(row: {
  Id: number;
  PackageId: number;
  ServiceId: number;
  Rate: unknown;
  Hours: unknown;
  Amount: unknown;
  Service: {
    Id: number;
    Code: string;
    Name: string;
    StandardRate: unknown;
    StandardHours: unknown;
  };
}) {
  return {
    id: row.Id,
    packageId: row.PackageId,
    serviceId: row.ServiceId,
    rate: numberFromDecimal(row.Rate),
    hours: numberFromDecimal(row.Hours),
    amount: numberFromDecimal(row.Amount),
    service: {
      id: row.Service.Id,
      code: row.Service.Code,
      name: row.Service.Name,
      standardRate: numberFromDecimal(row.Service.StandardRate),
      standardHours: numberFromDecimal(row.Service.StandardHours),
    },
  };
}

async function productMutationData(
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
  isCreate: boolean,
) {
  const data: ProductMutationData = isCreate
    ? createAudit(body, actorUserId)
    : updateAudit(body, actorUserId);

  if (isCreate || hasField(body, "productGroupId", "ProductGroupId")) {
    const productGroupId = requiredPositiveInteger(
      body,
      "ProductGroupId is required",
      "productGroupId",
      "ProductGroupId",
    );
    await assertExists(
      prisma.productGroup,
      productGroupId,
      "ProductGroupId does not exist",
    );
    data.ProductGroupId = productGroupId;
  }

  if (isCreate || hasField(body, "productCategoryId", "ProductCategoryId")) {
    const productCategoryId = requiredPositiveInteger(
      body,
      "ProductCategoryId is required",
      "productCategoryId",
      "ProductCategoryId",
    );
    await assertExists(
      prisma.productCategory,
      productCategoryId,
      "ProductCategoryId does not exist",
    );
    data.ProductCategoryId = productCategoryId;
  }

  if (isCreate || hasField(body, "unitOfMeasureId", "UnitOfMeasureId")) {
    const unitOfMeasureId = requiredPositiveInteger(
      body,
      "UnitOfMeasureId is required",
      "unitOfMeasureId",
      "UnitOfMeasureId",
    );
    await assertExists(
      prisma.unitOfMeasure,
      unitOfMeasureId,
      "UnitOfMeasureId does not exist",
    );
    data.UnitOfMeasureId = unitOfMeasureId;
  }

  if (isCreate || hasField(body, "manufacturerId", "ManufacturerId")) {
    const manufacturerId = requiredPositiveInteger(
      body,
      "ManufacturerId is required",
      "manufacturerId",
      "ManufacturerId",
    );
    await assertExists(
      prisma.manufacturer,
      manufacturerId,
      "ManufacturerId does not exist",
    );
    data.ManufacturerId = manufacturerId;
  }

  if (isCreate || hasField(body, "supplierId", "SupplierId")) {
    const supplierId = requiredPositiveInteger(
      body,
      "SupplierId is required",
      "supplierId",
      "SupplierId",
    );
    await assertExists(prisma.supplier, supplierId, "SupplierId does not exist");
    data.SupplierId = supplierId;
  }

  setIfPresent(data, "Name", body, readStringOrEmpty, "name", "Name");
  setIfPresent(
    data,
    "DisplayName",
    body,
    readStringOrEmpty,
    "displayName",
    "DisplayName",
  );
  setIfPresent(data, "Description", body, readString, "description", "Description");
  setIfPresent(data, "PartNo", body, readString, "partNo", "PartNo");
  setIfPresent(
    data,
    "ExpirationDateTime",
    body,
    readDate,
    "expirationDateTime",
    "ExpirationDateTime",
  );
  if (canEditPrice) {
    setIfPresent(
      data,
      "PurchaseCost",
      body,
      readDecimalOrZero,
      "purchaseCost",
      "PurchaseCost",
    );
    setIfPresent(data, "MarkupRate", body, readDecimalOrZero, "markupRate", "MarkupRate");
    setIfPresent(
      data,
      "SellingPrice",
      body,
      readDecimalOrZero,
      "sellingPrice",
      "SellingPrice",
    );
  } else if (isCreate) {
    data.PurchaseCost = 0;
    data.MarkupRate = 0;
    data.SellingPrice = 0;
  }
  setIfPresent(data, "IncentiveSA", body, readDecimalOrZero, "incentiveSA", "IncentiveSA");
  setIfPresent(
    data,
    "IncentiveTech",
    body,
    readDecimalOrZero,
    "incentiveTech",
    "IncentiveTech",
  );
  setIfPresent(
    data,
    "StorageLocation",
    body,
    readString,
    "storageLocation",
    "StorageLocation",
  );
  setIfPresent(
    data,
    "IsQuickSalesProduct",
    body,
    readBoolean,
    "isQuickSalesProduct",
    "IsQuickSalesProduct",
  );

  const lowStockThreshold = readDecimal(
    body,
    "lowStockThreshold",
    "LowStockThreshold",
    "reorderLevel",
    "ReorderLevel",
  );
  if (lowStockThreshold !== null) {
    if (lowStockThreshold < 0) {
      throw new ManagementServiceError("LowStockThreshold must be zero or greater");
    }
    data.LowStockThreshold = lowStockThreshold;
  } else if (isCreate) {
    data.LowStockThreshold = defaultLowStockThreshold;
  }

  if (isCreate) {
    if (!hasField(body, "name", "Name")) data.Name = "";
    if (!hasField(body, "displayName", "DisplayName")) data.DisplayName = "";
    if (!hasField(body, "description", "Description")) data.Description = "";
    if (!hasField(body, "partNo", "PartNo")) data.PartNo = "";
    if (!hasField(body, "incentiveSA", "IncentiveSA")) data.IncentiveSA = 0;
    if (!hasField(body, "incentiveTech", "IncentiveTech")) data.IncentiveTech = 0;
    if (!hasField(body, "storageLocation", "StorageLocation")) {
      data.StorageLocation = "";
    }
    if (!hasField(body, "isQuickSalesProduct", "IsQuickSalesProduct")) {
      data.IsQuickSalesProduct = false;
    }
  }

  return data;
}

function packageHeaderData(
  body: JsonRecord,
  actorUserId: number,
  isCreate: boolean,
) {
  const data: PackageMutationData = isCreate
    ? createAudit(body, actorUserId)
    : updateAudit(body, actorUserId);

  setIfPresent(data, "Name", body, readStringOrEmpty, "name", "Name");
  setIfPresent(data, "Code", body, readStringOrEmpty, "code", "Code");
  setIfPresent(
    data,
    "NextServiceReminderDays",
    body,
    readIntegerOrZero,
    "nextServiceReminderDays",
    "NextServiceReminderDays",
  );
  setIfPresent(data, "IncentiveSA", body, readDecimalOrZero, "incentiveSA", "IncentiveSA");
  setIfPresent(
    data,
    "IncentiveTech",
    body,
    readDecimalOrZero,
    "incentiveTech",
    "IncentiveTech",
  );
  setIfPresent(data, "IsHideAmount", body, readBoolean, "isHideAmount", "IsHideAmount");
  setIfPresent(data, "IsHideService", body, readBoolean, "isHideService", "IsHideService");
  setIfPresent(
    data,
    "IsHidePartsAndMaterials",
    body,
    readBoolean,
    "isHidePartsAndMaterials",
    "IsHidePartsAndMaterials",
  );
  setIfPresent(data, "IsDisplayCode", body, readBoolean, "isDisplayCode", "IsDisplayCode");
  setIfPresent(data, "Summary", body, readString, "summary", "Summary");
  setIfPresent(data, "SubTotal", body, readDecimalOrZero, "subTotal", "SubTotal");
  setIfPresent(data, "VAT12", body, readDecimalOrZero, "vat12", "VAT12");
  setIfPresent(data, "TotalAmount", body, readDecimalOrZero, "totalAmount", "TotalAmount");

  if (isCreate) {
    if (!hasField(body, "name", "Name")) data.Name = "";
    if (!hasField(body, "code", "Code")) data.Code = "";
    if (!hasField(body, "nextServiceReminderDays", "NextServiceReminderDays")) {
      data.NextServiceReminderDays = 0;
    }
    if (!hasField(body, "incentiveSA", "IncentiveSA")) data.IncentiveSA = 0;
    if (!hasField(body, "incentiveTech", "IncentiveTech")) data.IncentiveTech = 0;
    if (!hasField(body, "isHideAmount", "IsHideAmount")) data.IsHideAmount = false;
    if (!hasField(body, "isHideService", "IsHideService")) data.IsHideService = false;
    if (!hasField(body, "isHidePartsAndMaterials", "IsHidePartsAndMaterials")) {
      data.IsHidePartsAndMaterials = false;
    }
    if (!hasField(body, "isDisplayCode", "IsDisplayCode")) data.IsDisplayCode = false;
    if (!hasField(body, "summary", "Summary")) data.Summary = "";
    if (!hasField(body, "subTotal", "SubTotal")) data.SubTotal = 0;
    if (!hasField(body, "vat12", "VAT12")) data.VAT12 = 0;
    if (!hasField(body, "totalAmount", "TotalAmount")) data.TotalAmount = 0;
  }

  return data;
}

async function packageProductCreateRows(
  body: JsonRecord,
  packageId: number,
  canEditPrice: boolean,
  actorUserId: number,
) {
  const items = readRecordArray(body, "packageProducts", "PackageProducts");
  if (items.length === 0) return [];

  const productIds = distinctPositiveIds(items, "productId", "ProductId");
  const products = await prisma.product.findMany({
    where: { Id: { in: productIds } },
    select: { Id: true, SellingPrice: true, IsQuickSalesProduct: true, Name: true, DisplayName: true },
  });
  const foundIds = new Set(products.map((product) => product.Id));
  const missing = productIds.filter((productId) => !foundIds.has(productId));
  if (missing.length > 0) {
    throw new ManagementServiceError(`Some ProductIds do not exist: ${missing.join(",")}`);
  }
  const quickSalesProducts = products.filter((product) => product.IsQuickSalesProduct);
  if (quickSalesProducts.length > 0) {
    throw new ManagementServiceError(
      `Only non-quick sales products can be used in packages. Not available here: ${quickSalesProducts
        .slice(0, 3)
        .map((product) => product.Name || product.DisplayName || `Product ${product.Id}`)
        .join(", ")}.`,
    );
  }

  const priceByProductId = new Map(
    products.map((product) => [product.Id, numberFromDecimal(product.SellingPrice)]),
  );
  const now = new Date();

  return items.map((item) => {
    const productId = readPositiveInteger(item, "productId", "ProductId") ?? 0;
    const qty = readInteger(item, "qty", "Qty") ?? 0;
    const price = canEditPrice
      ? readDecimal(item, "price", "Price") ?? 0
      : priceByProductId.get(productId) ?? 0;
    const createdById =
      readPositiveInteger(item, "createdById", "CreatedById") ?? actorUserId;
    const updatedById =
      readPositiveInteger(item, "updatedById", "UpdatedById") ?? createdById;
    return {
      PackageId: packageId,
      ProductId: productId,
      Price: price,
      Qty: qty,
      Amount: canEditPrice ? readDecimal(item, "amount", "Amount") ?? 0 : price * qty,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    };
  });
}

async function packageServiceCreateRows(
  body: JsonRecord,
  packageId: number,
  canEditPrice: boolean,
  actorUserId: number,
) {
  const items = readRecordArray(body, "packageServices", "PackageServices");
  if (items.length === 0) return [];

  const serviceIds = distinctPositiveIds(items, "serviceId", "ServiceId");
  const services = await prisma.service.findMany({
    where: { Id: { in: serviceIds } },
    select: { Id: true, StandardRate: true },
  });
  const foundIds = new Set(services.map((service) => service.Id));
  const missing = serviceIds.filter((serviceId) => !foundIds.has(serviceId));
  if (missing.length > 0) {
    throw new ManagementServiceError(`Some ServiceIds do not exist: ${missing.join(",")}`);
  }

  const rateByServiceId = new Map(
    services.map((service) => [service.Id, numberFromDecimal(service.StandardRate)]),
  );
  const now = new Date();

  return items.map((item) => {
    const serviceId = readPositiveInteger(item, "serviceId", "ServiceId") ?? 0;
    const hours = readDecimal(item, "hours", "Hours") ?? 0;
    const rate = canEditPrice
      ? readDecimal(item, "rate", "Rate") ?? 0
      : rateByServiceId.get(serviceId) ?? 0;
    const createdById =
      readPositiveInteger(item, "createdById", "CreatedById") ?? actorUserId;
    const updatedById =
      readPositiveInteger(item, "updatedById", "UpdatedById") ?? createdById;
    return {
      PackageId: packageId,
      ServiceId: serviceId,
      Rate: rate,
      Hours: hours,
      Amount: canEditPrice ? readDecimal(item, "amount", "Amount") ?? 0 : rate * hours,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    };
  });
}

async function getInventoryBalances() {
  const balances = new Map<number, number>();
  const manual = await prisma.productInventoryTransaction.findMany({
    select: { ProductId: true, TransactionType: true, Quantity: true },
  });
  for (const row of manual) {
    addToMap(
      balances,
      row.ProductId,
      signedManualQuantity(row.TransactionType, row.Quantity),
    );
  }

  const jobOrderUsage = await prisma.jobOrderProduct.findMany({
    select: {
      ProductId: true,
      Qty: true,
      JobOrder: {
        select: { JobStatus: { select: { Name: true, Description: true } } },
      },
    },
  });
  for (const row of jobOrderUsage) {
    if (!isCanceledStatus(row.JobOrder.JobStatus)) {
      addToMap(balances, row.ProductId, -row.Qty);
    }
  }

  const quickSaleUsage = await prisma.quickSalesProduct.findMany({
    select: {
      ProductId: true,
      Qty: true,
      QuickSales: {
        select: { JobStatus: { select: { Name: true, Description: true } } },
      },
    },
  });
  for (const row of quickSaleUsage) {
    if (!isCanceledStatus(row.QuickSales.JobStatus)) {
      addToMap(balances, row.ProductId, -row.Qty);
    }
  }

  return balances;
}

async function validateManualTransaction(
  productId: number,
  transactionType: string,
  requestedQuantity: number,
) {
  const signedQuantity = signedManualQuantity(transactionType, requestedQuantity);
  if (signedQuantity >= 0) return null;

  const balances = await getInventoryBalances();
  const available = balances.get(productId) ?? 0;
  if (available + signedQuantity >= 0) return null;

  const product = await prisma.product.findUnique({
    where: { Id: productId },
    select: { Name: true, DisplayName: true, PartNo: true },
  });
  const name = product ? productDisplayName(product) : `Product #${productId}`;
  return `Insufficient stock for ${name}. Available ${formatQuantity(
    available,
  )}, requested ${formatQuantity(Math.abs(signedQuantity))}.`;
}

async function getApplicableVehicleNameLookup() {
  const rows = await prisma.productVehicleModel.findMany({
    select: {
      ProductId: true,
      VehicleModel: {
        select: {
          Name: true,
          VehicleMake: { select: { Name: true } },
        },
      },
    },
  });
  const lookup = new Map<number, string[]>();
  for (const row of rows) {
    const label = [
      row.VehicleModel.VehicleMake?.Name ?? "",
      row.VehicleModel.Name ?? "",
    ].filter(Boolean).join(" ").trim();
    if (!label) continue;
    const current = lookup.get(row.ProductId) ?? [];
    if (!current.some((item) => item.toLowerCase() === label.toLowerCase())) {
      current.push(label);
      current.sort((left, right) => left.localeCompare(right));
      lookup.set(row.ProductId, current);
    }
  }
  return lookup;
}

async function productInventoryLookup() {
  const products = await prisma.product.findMany({
    select: {
      Id: true,
      Name: true,
      DisplayName: true,
      UnitOfMeasure: { select: { Name: true } },
    },
  });
  return new Map(
    products.map((product) => [
      product.Id,
      {
        name: product.DisplayName || product.Name,
        unitOfMeasure: product.UnitOfMeasure.Name,
      },
    ]),
  );
}

async function inventoryJobOrderRows(take: number) {
  const rows = await prisma.jobOrderProduct.findMany({
    orderBy: [{ CreatedDateTime: "desc" }, { Id: "desc" }],
    take,
    select: {
      Id: true,
      ProductId: true,
      Qty: true,
      CreatedDateTime: true,
      Product: {
        select: {
          Name: true,
          DisplayName: true,
          UnitOfMeasure: { select: { Name: true } },
        },
      },
      JobOrder: {
        select: {
          ReferenceNo: true,
          TransactionDate: true,
          JobStatus: { select: { Name: true, Description: true } },
        },
      },
    },
  });
  return rows
    .filter((row) => !isCanceledStatus(row.JobOrder.JobStatus))
    .map((row) => ({
      id: `joborder-${row.Id}`,
      manualTransactionId: null,
      productId: row.ProductId,
      productName: row.Product.DisplayName || row.Product.Name,
      unitOfMeasure: row.Product.UnitOfMeasure.Name,
      sourceType: "Job Order",
      transactionType: "Stock Out",
      quantity: -row.Qty,
      transactionDateTime: row.JobOrder.TransactionDate ?? row.CreatedDateTime,
      referenceNo: row.JobOrder.ReferenceNo ?? "",
      notes: "Used in job order",
      isManual: false,
    }));
}

async function inventoryQuickSaleRows(take: number) {
  const rows = await prisma.quickSalesProduct.findMany({
    orderBy: [{ CreatedDateTime: "desc" }, { Id: "desc" }],
    take,
    select: {
      Id: true,
      ProductId: true,
      Qty: true,
      Product: {
        select: {
          Name: true,
          DisplayName: true,
          UnitOfMeasure: { select: { Name: true } },
        },
      },
      QuickSales: {
        select: {
          ReferenceNo: true,
          TransactionDate: true,
          JobStatus: { select: { Name: true, Description: true } },
        },
      },
    },
  });
  return rows
    .filter((row) => !isCanceledStatus(row.QuickSales.JobStatus))
    .map((row) => ({
      id: `quicksale-${row.Id}`,
      manualTransactionId: null,
      productId: row.ProductId,
      productName: row.Product.DisplayName || row.Product.Name,
      unitOfMeasure: row.Product.UnitOfMeasure.Name,
      sourceType: "Quick Sale",
      transactionType: "Stock Out",
      quantity: -row.Qty,
      transactionDateTime: row.QuickSales.TransactionDate,
      referenceNo: row.QuickSales.ReferenceNo ?? "",
      notes: "Sold through quick sale",
      isManual: false,
    }));
}

function createAudit(body: JsonRecord, actorUserId: number) {
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const now = new Date();
  return {
    CreatedById: createdById,
    CreatedDateTime: now,
    UpdatedById: updatedById,
    UpdatedDateTime: now,
  };
}

function updateAudit(body: JsonRecord, actorUserId: number) {
  return {
    UpdatedById: readPositiveInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };
}

async function assertExists(
  delegate: UniqueDelegate,
  id: number,
  message: string,
) {
  const exists = await delegate.findUnique({
    where: { Id: id },
    select: { Id: true },
  });
  if (!exists) throw new ManagementServiceError(message);
}

function requiredPositiveInteger(
  body: JsonRecord,
  message: string,
  ...keys: string[]
) {
  const value = readPositiveInteger(body, ...keys);
  if (!value) throw new ManagementServiceError(message);
  return value;
}

function setIfPresent(
  data: Record<string, unknown>,
  targetKey: string,
  body: JsonRecord,
  reader: (body: JsonRecord, ...keys: string[]) => unknown,
  ...keys: string[]
) {
  if (hasField(body, ...keys)) {
    data[targetKey] = reader(body, ...keys);
  }
}

function readString(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return null;
}

function readStringOrEmpty(body: JsonRecord, ...keys: string[]) {
  return readString(body, ...keys) ?? "";
}

function readInteger(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    const numberValue =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;
    if (Number.isInteger(numberValue) && numberValue >= 0) return numberValue;
  }
  return null;
}

function readIntegerOrZero(body: JsonRecord, ...keys: string[]) {
  return readInteger(body, ...keys) ?? 0;
}

function readPositiveInteger(body: JsonRecord, ...keys: string[]) {
  const value = readInteger(body, ...keys);
  return value && value > 0 ? value : null;
}

function readDecimal(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) return numberValue;
    }
  }
  return null;
}

function readDecimalOrZero(body: JsonRecord, ...keys: string[]) {
  return readDecimal(body, ...keys) ?? 0;
}

function readBoolean(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === "string") {
      return readBooleanFromString(value);
    }
  }
  return null;
}

function readBooleanFromString(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
}

function readDate(body: JsonRecord, ...keys: string[]) {
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

function readDateFromString(value: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return { value: date, dateOnly: dateOnly(date) };
}

function readRecordArray(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is JsonRecord =>
          !!item && typeof item === "object" && !Array.isArray(item),
      );
    }
  }
  return [];
}

function readIntegerArray(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "number" || typeof item === "string"
            ? Number(item)
            : Number.NaN,
        )
        .filter((item) => Number.isInteger(item));
    }
  }
  return [];
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

function numberFromDecimal(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  if (
    value &&
    typeof value === "object" &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    const numberValue = Number(value.toString());
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  return 0;
}

function distinctPositiveIds(items: JsonRecord[], ...keys: string[]) {
  return [
    ...new Set(
      items
        .map((item) => readPositiveInteger(item, ...keys))
        .filter((item): item is number => !!item),
    ),
  ];
}

function effectiveLowStock(value: unknown) {
  const threshold = numberFromDecimal(value);
  return threshold > 0 ? threshold : defaultLowStockThreshold;
}

function getStockStatus(stockOnHand: number, lowStockThreshold: number) {
  if (stockOnHand <= 0) return "Out of Stock";
  return stockOnHand <= lowStockThreshold ? "Low Stock" : "In Stock";
}

function normalizeInventoryType(value: string | null) {
  const key = (value ?? "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
  const normalized = key.split(/\s+/).filter(Boolean).join(" ");
  if (["stock in", "in", "receive", "receipt", "purchase"].includes(normalized)) {
    return "Stock In";
  }
  if (["stock out", "out", "issue", "issued", "release"].includes(normalized)) {
    return "Stock Out";
  }
  if (["adjustment", "adjust"].includes(normalized)) return "Adjustment";
  return "";
}

function normalizeInventoryCheckType(value: string | null) {
  const key = (value ?? "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
  const normalized = key.split(/\s+/).filter(Boolean).join(" ");
  if (["end of day", "daily", "day", "eod"].includes(normalized)) return "End of Day";
  if (
    ["month end", "monthend", "month", "monthly", "month ending"].includes(
      normalized,
    )
  ) {
    return "Month End";
  }
  return "";
}

function normalizeInventoryCheckDate(checkType: string, value: Date) {
  const date = dateOnly(value);
  if (normalizeInventoryCheckType(checkType) !== "Month End") return date;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function signedManualQuantity(transactionType: string | null, quantity: unknown) {
  const normalized = normalizeInventoryType(transactionType);
  const amount = numberFromDecimal(quantity);
  if (normalized === "Stock Out") return -Math.abs(amount);
  if (normalized === "Stock In") return Math.abs(amount);
  return amount;
}

function isCanceledStatus(status: { Name: string; Description: string | null } | null) {
  const text = `${status?.Name ?? ""} ${status?.Description ?? ""}`.toUpperCase();
  return text.includes("CANCEL") || text.includes("VOID") || text.includes("DELETE");
}

function addToMap(map: Map<number, number>, key: number, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function productDisplayName(product: {
  Name: string;
  DisplayName: string;
  PartNo?: string | null;
}) {
  const name = product.DisplayName || product.Name;
  return product.PartNo ? `${name} (${product.PartNo})` : name;
}

function compareInventoryRows(
  left: { transactionDateTime: Date | string; id: string },
  right: { transactionDateTime: Date | string; id: string },
) {
  const leftTime = new Date(left.transactionDateTime).getTime();
  const rightTime = new Date(right.transactionDateTime).getTime();
  if (rightTime !== leftTime) return rightTime - leftTime;
  return right.id.localeCompare(left.id);
}

function inventoryRowMatches(
  row: {
    productName: string;
    unitOfMeasure: string;
    sourceType: string;
    transactionType: string;
    referenceNo: string;
    notes: string;
  },
  search: string,
) {
  if (!search) return true;
  return [
    row.productName,
    row.unitOfMeasure,
    row.sourceType,
    row.transactionType,
    row.referenceNo,
    row.notes,
  ].some((value) => value.toLowerCase().includes(search));
}

function getInventoryCheckStatus(variance: number) {
  if (variance > 0) return "Surplus";
  if (variance < 0) return "Shortage";
  return "Matched";
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function firstDuplicate(values: number[]) {
  const seen = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function readPositiveIntFromString(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function formatShortDate(value: Date) {
  return `${String(value.getUTCMonth() + 1).padStart(2, "0")}/${String(
    value.getUTCDate(),
  ).padStart(2, "0")}/${value.getUTCFullYear()}`;
}

function formatReferenceTimestamp(value: Date) {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
    String(value.getUTCHours()).padStart(2, "0"),
    String(value.getUTCMinutes()).padStart(2, "0"),
    String(value.getUTCSeconds()).padStart(2, "0"),
  ].join("");
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizePrismaError(error: unknown, entityName: string): ManagementServiceError {
  if (error instanceof ManagementServiceError) return error;

  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new ManagementServiceError("Record not found.", 404, {});
    }
    if (error.code === "P2002") {
      return new ManagementServiceError("Duplicate record.", 409, "Duplicate record.");
    }
    if (error.code === "P2003") {
      return new ManagementServiceError(
        `Cannot delete this ${entityName} because it is already used by other records.`,
        409,
        `Cannot delete this ${entityName} because it is already used by other records.`,
      );
    }
  }

  return new ManagementServiceError("An unexpected error occurred.", 500);
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
