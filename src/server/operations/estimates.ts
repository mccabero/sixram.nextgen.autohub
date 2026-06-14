import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";

const defaultEstimateReference = "EST0000001";

const estimateListSelect = {
  Id: true,
  IsChangan: true,
  IsPackage: true,
  ReferenceNo: true,
  TransactionDate: true,
  Customer: {
    select: {
      FirstName: true,
      LastName: true,
    },
  },
  Vehicle: {
    select: {
      PlateNo: true,
      VehicleModel: {
        select: {
          Name: true,
          VehicleMake: {
            select: {
              Name: true,
            },
          },
        },
      },
    },
  },
  JobStatus: {
    select: {
      Name: true,
    },
  },
} as const;

const estimateDetailSelect = {
  Id: true,
  IsChangan: true,
  IsPackage: true,
  IsCustomerApproved: true,
  InspectionId: true,
  ReferenceNo: true,
  TransactionDate: true,
  ExpirationDate: true,
  EstimatedDays: true,
  JobStatusId: true,
  CustomerId: true,
  VehicleId: true,
  AdvisorUserId: true,
  EstimatorUserId: true,
  ApproverUserId: true,
  ServiceGroupId: true,
  Odometer: true,
  NextOdometerReminder: true,
  CustomerPO: true,
  Summary: true,
  SubTotal: true,
  VAT12: true,
  LaborDiscount: true,
  ProductDiscount: true,
  AdditionalDiscount: true,
  TotalAmount: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
  JobStatus: {
    select: {
      Id: true,
      Name: true,
      Description: true,
    },
  },
  Vehicle: {
    select: {
      Id: true,
      PlateNo: true,
      VehicleModelId: true,
      VehicleModel: {
        select: {
          Id: true,
          Name: true,
          Description: true,
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
  },
  Customer: {
    select: {
      Id: true,
      FirstName: true,
      LastName: true,
    },
  },
  EstimatePackagesAsEstimate: {
    orderBy: { Id: "asc" },
    select: {
      PackageId: true,
      IsAdditional: true,
      Package: {
        select: {
          Name: true,
        },
      },
    },
  },
  EstimateServicesAsEstimate: {
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsPackage: true,
      IsRequired: true,
      IsAdditional: true,
      PackageId: true,
      EstimateId: true,
      ServiceId: true,
      Rate: true,
      Hours: true,
      Amount: true,
      Service: {
        select: {
          Id: true,
          Name: true,
          Code: true,
        },
      },
    },
  },
  EstimateProductsAsEstimate: {
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsPackage: true,
      IsRequired: true,
      IsAdditional: true,
      PackageId: true,
      EstimateId: true,
      ProductId: true,
      Price: true,
      Qty: true,
      Amount: true,
      IncentiveSA: true,
      IncentiveTech: true,
      Product: {
        select: {
          Id: true,
          Name: true,
          DisplayName: true,
          PartNo: true,
        },
      },
    },
  },
} as const;

export async function listEstimates() {
  const rows = await prisma.estimate.findMany({
    orderBy: { Id: "asc" },
    select: estimateListSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    clientType: row.IsChangan ? "CHANGAN" : "BOSCH",
    referenceNo: row.ReferenceNo,
    transactionDate: row.TransactionDate,
    customerName: customerName(row.Customer),
    vehicle: vehicleName(row.Vehicle),
    plateNo: row.Vehicle?.PlateNo ?? "",
    estimateType: row.IsPackage ? "PACKAGE" : "REGULAR",
    status: row.JobStatus?.Name ?? "",
  }));
}

export async function listEstimateSummary() {
  const rows = await prisma.estimate.findMany({
    orderBy: { Id: "asc" },
    select: {
      ...estimateListSelect,
      InspectionId: true,
      CustomerId: true,
      CreatedDateTime: true,
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    inspectionId: row.InspectionId,
    customerId: row.CustomerId,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo ?? "",
    transactionDate: row.TransactionDate,
    createdDate: row.CreatedDateTime,
    customer: customerName(row.Customer),
    vehicle: vehicleName(row.Vehicle),
    plateNo: row.Vehicle?.PlateNo ?? "",
    isPackage: row.IsPackage,
    status: row.JobStatus?.Name ?? "",
  }));
}

export async function getNextEstimateReferenceNo() {
  const latestRef = await prisma.estimate.findFirst({
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
  };
}

export async function getEstimate(id: number) {
  const row = await prisma.estimate.findUnique({
    where: { Id: id },
    select: estimateDetailSelect,
  });

  if (!row) return null;

  const technicians = await prisma.estimateTechnician.findMany({
    where: { EstimateId: id },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      TechnicianUserId: true,
      TechnicianUser: {
        select: {
          Id: true,
          Firstname: true,
          LastName: true,
          MobileNumber: true,
        },
      },
    },
  });

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    isPackage: row.IsPackage,
    isCustomerApproved: row.IsCustomerApproved,
    inspectionId: row.InspectionId,
    referenceNo: row.ReferenceNo,
    transactionDate: row.TransactionDate,
    expirationDate: row.ExpirationDate,
    estimatedDays: row.EstimatedDays,
    jobStatusId: row.JobStatusId,
    customerId: row.CustomerId,
    vehicleId: row.VehicleId,
    advisorUserId: row.AdvisorUserId,
    estimatorUserId: row.EstimatorUserId,
    approverUserId: row.ApproverUserId,
    serviceGroupId: row.ServiceGroupId,
    odometer: row.Odometer,
    nextOdometerReminder: row.NextOdometerReminder,
    customerPO: row.CustomerPO,
    summary: row.Summary,
    subTotal: row.SubTotal,
    vat12: row.VAT12,
    laborDiscount: row.LaborDiscount,
    productDiscount: row.ProductDiscount,
    additionalDiscount: row.AdditionalDiscount,
    totalAmount: row.TotalAmount,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
    jobStatus: row.JobStatus
      ? {
          id: row.JobStatus.Id,
          name: row.JobStatus.Name ?? "",
          description: row.JobStatus.Description ?? "",
        }
      : null,
    vehicle: row.Vehicle
      ? {
          id: row.Vehicle.Id,
          plateNo: row.Vehicle.PlateNo ?? "",
          vehicleModelId: row.Vehicle.VehicleModelId,
          vehicleModel: row.Vehicle.VehicleModel
            ? {
                id: row.Vehicle.VehicleModel.Id,
                name: row.Vehicle.VehicleModel.Name ?? "",
                description: row.Vehicle.VehicleModel.Description ?? "",
                vehicleMake: row.Vehicle.VehicleModel.VehicleMake
                  ? {
                      id: row.Vehicle.VehicleModel.VehicleMake.Id,
                      name: row.Vehicle.VehicleModel.VehicleMake.Name ?? "",
                      description:
                        row.Vehicle.VehicleModel.VehicleMake.Description ?? "",
                    }
                  : null,
              }
            : null,
        }
      : null,
    customer: row.Customer
      ? {
          id: row.Customer.Id,
          firstName: row.Customer.FirstName ?? "",
          lastName: row.Customer.LastName ?? "",
        }
      : null,
    technicians: technicians.map((technician) => ({
      id: technician.Id,
      technicianUserId: technician.TechnicianUserId,
      technicianUser: technician.TechnicianUser
        ? {
            id: technician.TechnicianUser.Id,
            firstName: technician.TechnicianUser.Firstname ?? "",
            lastName: technician.TechnicianUser.LastName ?? "",
            mobileNumber: technician.TechnicianUser.MobileNumber ?? "",
          }
        : null,
    })),
    packages: row.EstimatePackagesAsEstimate.map((packageItem) => ({
      id: packageItem.PackageId,
      name: packageItem.Package?.Name ?? "",
      isAdditional: packageItem.IsAdditional,
    })),
    services: row.EstimateServicesAsEstimate.map((service) => ({
      id: service.Id,
      isPackage: service.IsPackage,
      isRequired: service.IsRequired,
      isAdditional: service.IsAdditional,
      packageId: service.PackageId,
      estimateId: service.EstimateId,
      serviceId: service.ServiceId,
      rate: service.Rate,
      hours: service.Hours,
      amount: service.Amount,
      service: service.Service
        ? {
            id: service.Service.Id,
            name: service.Service.Name ?? "",
            code: service.Service.Code ?? "",
          }
        : null,
    })),
    products: row.EstimateProductsAsEstimate.map((product) => ({
      id: product.Id,
      isPackage: product.IsPackage,
      isRequired: product.IsRequired,
      isAdditional: product.IsAdditional,
      packageId: product.PackageId,
      estimateId: product.EstimateId,
      productId: product.ProductId,
      price: product.Price,
      qty: product.Qty,
      amount: product.Amount,
      incentiveSA: product.IncentiveSA,
      incentiveTech: product.IncentiveTech,
      product: product.Product
        ? {
            id: product.Product.Id,
            name: product.Product.Name ?? "",
            displayName: product.Product.DisplayName ?? "",
            partNo: product.Product.PartNo ?? "",
          }
        : null,
    })),
  };
}

export async function createEstimate(
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const now = new Date();
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ??
    (actorUserId > 0 ? actorUserId : 0);
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const inspectionId = readInteger(body, "inspectionId", "InspectionId") ?? 0;
  const requestedJobStatusId =
    readInteger(body, "jobStatusId", "JobStatusId") ?? 0;
  const jobStatusId = await resolveJobStatusIdOrDefault(
    requestedJobStatusId,
    "OPEN",
  );

  if (!jobStatusId) {
    throw invalidJobStatus(requestedJobStatusId);
  }

  if (inspectionId > 0) {
    const existingEstimate = await prisma.estimate.findFirst({
      where: { InspectionId: inspectionId },
      orderBy: { Id: "desc" },
      select: { Id: true, ReferenceNo: true },
    });

    if (existingEstimate) {
      throw new OperationServiceError(
        `Inspection is already linked to estimate ${existingEstimate.ReferenceNo ?? ""}.`,
        409,
        {
          message: `Inspection is already linked to estimate ${existingEstimate.ReferenceNo ?? ""}.`,
          id: existingEstimate.Id,
          estimateId: existingEstimate.Id,
          referenceNo: existingEstimate.ReferenceNo ?? "",
        },
      );
    }
  }

  const packages = readPackageLines(body);
  const products = readProductLines(body);
  const services = readServiceLines(body);
  const technicians = readTechnicianLines(body);
  const referenceNo =
    readString(body, "referenceNo", "ReferenceNo")?.trim() ||
    (await getNextEstimateReferenceNo()).referenceNo;
  const summary = readString(body, "summary", "Summary") ?? "";
  const laborDiscount = readDecimal(body, "laborDiscount", "LaborDiscount");
  const productDiscount = readDecimal(body, "productDiscount", "ProductDiscount");
  const additionalDiscount = readDecimal(
    body,
    "additionalDiscount",
    "AdditionalDiscount",
  );

  validateDiscountRemarks(
    summary,
    laborDiscount,
    productDiscount,
    additionalDiscount,
  );
  await validateNonQuickSalesProducts(products);
  await validateEstimateLines(packages, products, services, technicians);

  const productPricesById = canEditPrice
    ? new Map<number, number>()
    : await getProductSellingPrices(products.map((product) => product.productId));
  const serviceRatesById = canEditPrice
    ? new Map<number, number>()
    : await getServiceStandardRates(services.map((service) => service.serviceId));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.estimate.create({
        data: {
          IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
          IsPackage: deriveEstimateIsPackage(
            packages,
            products,
            services,
            readBoolean(body, "isPackage", "IsPackage") ?? false,
          ),
          IsCustomerApproved:
            readBoolean(body, "isCustomerApproved", "IsCustomerApproved") ??
            false,
          InspectionId: inspectionId,
          ReferenceNo: referenceNo,
          TransactionDate: readDate(body, "transactionDate", "TransactionDate"),
          ExpirationDate: readDate(body, "expirationDate", "ExpirationDate"),
          EstimatedDays:
            readInteger(body, "estimatedDays", "EstimatedDays") ?? 0,
          JobStatusId: jobStatusId,
          CustomerId: readInteger(body, "customerId", "CustomerId") ?? 0,
          VehicleId: readInteger(body, "vehicleId", "VehicleId") ?? 0,
          AdvisorUserId:
            readInteger(body, "advisorUserId", "AdvisorUserId") ?? 0,
          EstimatorUserId:
            readInteger(body, "estimatorUserId", "EstimatorUserId") ?? 0,
          ApproverUserId:
            readInteger(body, "approverUserId", "ApproverUserId") ?? 0,
          ServiceGroupId:
            readInteger(body, "serviceGroupId", "ServiceGroupId") ?? 0,
          Odometer: readInteger(body, "odometer", "Odometer"),
          NextOdometerReminder: readInteger(
            body,
            "nextOdometerReminder",
            "NextOdometerReminder",
          ),
          CustomerPO: readString(body, "customerPO", "CustomerPO") ?? "",
          Summary: summary,
          SubTotal: readDecimal(body, "subTotal", "SubTotal"),
          VAT12: readDecimal(body, "vat12", "VAT12"),
          LaborDiscount: laborDiscount,
          ProductDiscount: productDiscount,
          AdditionalDiscount: additionalDiscount,
          TotalAmount: readDecimal(body, "totalAmount", "TotalAmount"),
          CreatedById: createdById,
          CreatedDateTime: now,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
        select: {
          Id: true,
          ReferenceNo: true,
          InspectionId: true,
          JobStatusId: true,
          CustomerId: true,
          VehicleId: true,
          TotalAmount: true,
          CreatedDateTime: true,
        },
      });

      await writeEstimateLines(tx, row.Id, {
        packages,
        products,
        services,
        technicians,
        productPricesById,
        serviceRatesById,
        canEditPrice,
        createdById,
        updatedById,
        now,
      });

      return row;
    });

    return {
      id: created.Id,
      estimateId: created.Id,
      referenceNo: created.ReferenceNo,
      inspectionId: created.InspectionId,
      jobStatusId: created.JobStatusId,
      customerId: created.CustomerId,
      vehicleId: created.VehicleId,
      totalAmount: created.TotalAmount,
      createdDateTime: created.CreatedDateTime,
    };
  } catch (error) {
    throw normalizePrismaError(error, "estimate");
  }
}

export async function updateEstimate(
  id: number,
  body: JsonRecord,
  actorUserId: number,
  canEditPrice: boolean,
) {
  const existing = await prisma.estimate.findUnique({
    where: { Id: id },
    select: {
      Id: true,
      IsPackage: true,
      Summary: true,
      LaborDiscount: true,
      ProductDiscount: true,
      AdditionalDiscount: true,
      JobStatusId: true,
      UpdatedById: true,
    },
  });

  if (!existing) return false;

  const packages = hasField(body, "packages", "Packages")
    ? readPackageLines(body)
    : null;
  const products = hasField(body, "products", "Products")
    ? readProductLines(body)
    : null;
  const services = hasField(body, "services", "Services")
    ? readServiceLines(body)
    : null;
  const technicians = hasField(body, "technicians", "Technicians")
    ? readTechnicianLines(body)
    : null;

  const data: Record<string, unknown> = {
    UpdatedDateTime: new Date(),
    UpdatedById:
      readPositiveInteger(body, "updatedById", "UpdatedById") ??
      existing.UpdatedById ??
      (actorUserId > 0 ? actorUserId : 0),
  };

  if (packages || products || services) {
    data.IsPackage = deriveEstimateIsPackage(
      packages ?? [],
      products ?? [],
      services ?? [],
      false,
    );
  } else {
    setIfProvided(data, "IsPackage", body, readBoolean, "isPackage", "IsPackage");
  }

  setIfProvided(data, "IsChangan", body, readBoolean, "isChangan", "IsChangan");
  setIfProvided(
    data,
    "IsCustomerApproved",
    body,
    readBoolean,
    "isCustomerApproved",
    "IsCustomerApproved",
  );
  setIfProvided(data, "InspectionId", body, readInteger, "inspectionId", "InspectionId");
  setIfProvided(data, "ReferenceNo", body, readString, "referenceNo", "ReferenceNo");
  setIfProvided(
    data,
    "TransactionDate",
    body,
    readDate,
    "transactionDate",
    "TransactionDate",
  );
  setIfProvided(
    data,
    "ExpirationDate",
    body,
    readDate,
    "expirationDate",
    "ExpirationDate",
  );
  setIfProvided(data, "EstimatedDays", body, readInteger, "estimatedDays", "EstimatedDays");
  setIfProvided(data, "CustomerId", body, readInteger, "customerId", "CustomerId");
  setIfProvided(data, "VehicleId", body, readInteger, "vehicleId", "VehicleId");
  setIfProvided(
    data,
    "AdvisorUserId",
    body,
    readInteger,
    "advisorUserId",
    "AdvisorUserId",
  );
  setIfProvided(
    data,
    "EstimatorUserId",
    body,
    readInteger,
    "estimatorUserId",
    "EstimatorUserId",
  );
  setIfProvided(
    data,
    "ApproverUserId",
    body,
    readInteger,
    "approverUserId",
    "ApproverUserId",
  );
  setIfProvided(
    data,
    "ServiceGroupId",
    body,
    readInteger,
    "serviceGroupId",
    "ServiceGroupId",
  );
  setIfProvided(data, "Odometer", body, readInteger, "odometer", "Odometer");
  setIfProvided(
    data,
    "NextOdometerReminder",
    body,
    readInteger,
    "nextOdometerReminder",
    "NextOdometerReminder",
  );
  setIfProvided(data, "CustomerPO", body, readString, "customerPO", "CustomerPO");
  setIfProvided(data, "Summary", body, readString, "summary", "Summary");
  setIfProvided(data, "SubTotal", body, readDecimal, "subTotal", "SubTotal");
  setIfProvided(data, "VAT12", body, readDecimal, "vat12", "VAT12");
  setIfProvided(
    data,
    "LaborDiscount",
    body,
    readDecimal,
    "laborDiscount",
    "LaborDiscount",
  );
  setIfProvided(
    data,
    "ProductDiscount",
    body,
    readDecimal,
    "productDiscount",
    "ProductDiscount",
  );
  setIfProvided(
    data,
    "AdditionalDiscount",
    body,
    readDecimal,
    "additionalDiscount",
    "AdditionalDiscount",
  );
  setIfProvided(data, "TotalAmount", body, readDecimal, "totalAmount", "TotalAmount");

  const requestedJobStatusId = readInteger(body, "jobStatusId", "JobStatusId");
  if (requestedJobStatusId !== null) {
    const jobStatusId = await resolveJobStatusIdOrDefault(
      requestedJobStatusId,
      "OPEN",
    );

    if (!jobStatusId) {
      throw invalidJobStatus(requestedJobStatusId);
    }

    await rejectReopenTransition(existing.JobStatusId, jobStatusId);
    data.JobStatusId = jobStatusId;
  }

  validateDiscountRemarks(
    (data.Summary as string | undefined) ?? existing.Summary ?? "",
    (data.LaborDiscount as number | undefined) ??
      numberFromDecimal(existing.LaborDiscount),
    (data.ProductDiscount as number | undefined) ??
      numberFromDecimal(existing.ProductDiscount),
    (data.AdditionalDiscount as number | undefined) ??
      numberFromDecimal(existing.AdditionalDiscount),
  );

  if (products) {
    await validateNonQuickSalesProducts(products);
  }

  await validateEstimateLines(
    packages ?? [],
    products ?? [],
    services ?? [],
    technicians ?? [],
  );

  const existingProducts =
    !canEditPrice && products
      ? await prisma.estimateProduct.findMany({
          where: { EstimateId: id },
          select: { ProductId: true, Price: true },
        })
      : [];
  const existingServices =
    !canEditPrice && services
      ? await prisma.estimateService.findMany({
          where: { EstimateId: id },
          select: { ServiceId: true, Rate: true },
        })
      : [];
  const existingPricesByProductId = new Map(
    existingProducts.map((product) => [
      product.ProductId,
      numberFromDecimal(product.Price),
    ]),
  );
  const existingRatesByServiceId = new Map(
    existingServices.map((service) => [
      service.ServiceId,
      numberFromDecimal(service.Rate),
    ]),
  );
  const productPricesById =
    !canEditPrice && products
      ? await getProductSellingPrices(products.map((product) => product.productId))
      : new Map<number, number>();
  const serviceRatesById =
    !canEditPrice && services
      ? await getServiceStandardRates(services.map((service) => service.serviceId))
      : new Map<number, number>();
  const updaterId =
    readPositiveInteger(body, "updatedById", "UpdatedById") ??
    existing.UpdatedById ??
    (actorUserId > 0 ? actorUserId : 0);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.estimate.update({
        where: { Id: id },
        data,
      });

      if (packages) {
        await tx.estimatePackage.deleteMany({ where: { EstimateId: id } });
        await createEstimatePackages(tx, id, packages, updaterId, updaterId);
      }

      if (products) {
        await tx.estimateProduct.deleteMany({ where: { EstimateId: id } });
        await createEstimateProducts(tx, id, products, {
          canEditPrice,
          productPricesById,
          existingPricesByProductId,
          createdById: updaterId,
          updatedById: updaterId,
        });
      }

      if (services) {
        await tx.estimateService.deleteMany({ where: { EstimateId: id } });
        await createEstimateServices(tx, id, services, {
          canEditPrice,
          serviceRatesById,
          existingRatesByServiceId,
          createdById: updaterId,
          updatedById: updaterId,
        });
      }

      if (technicians) {
        await tx.estimateTechnician.deleteMany({ where: { EstimateId: id } });
        await createEstimateTechnicians(
          tx,
          id,
          technicians,
          updaterId,
          updaterId,
        );
      }
    });
  } catch (error) {
    throw normalizePrismaError(error, "estimate");
  }

  return true;
}

export async function deleteEstimate(id: number, actorUserId: number) {
  const existing = await prisma.estimate.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);
  await prisma.estimate.update({
    where: { Id: id },
    data: {
      JobStatusId: deletedStatusId,
      UpdatedById: actorUserId > 0 ? actorUserId : 0,
      UpdatedDateTime: new Date(),
    },
  });

  return {
    id,
    jobStatusId: deletedStatusId,
    status: "DELETED",
  };
}

function nextReferenceValue(latestRef: string) {
  if (!latestRef) return defaultEstimateReference;

  const match = /^([A-Za-z]*)(\d+)$/.exec(latestRef);
  if (!match) return latestRef;

  const [, prefix, numericValue] = match;
  const parsed = Number(numericValue);
  if (!Number.isSafeInteger(parsed)) return latestRef;

  return `${prefix}${String(parsed + 1).padStart(numericValue.length, "0")}`;
}

function customerName(customer: { FirstName: string; LastName: string } | null) {
  if (!customer) return "";
  return [customer.FirstName, customer.LastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function vehicleName(
  vehicle: {
    VehicleModel: {
      Name: string;
      VehicleMake: { Name: string } | null;
    };
  } | null,
) {
  if (!vehicle?.VehicleModel) return "";
  return [vehicle.VehicleModel.VehicleMake?.Name, vehicle.VehicleModel.Name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

type EstimatePackageLine = {
  packageId: number;
  isAdditional: boolean;
  incentiveSA: number;
  incentiveTech: number;
};

type EstimateProductLine = {
  isPackage: boolean;
  isRequired: boolean;
  isAdditional: boolean;
  packageId: number | null;
  productId: number;
  price: number;
  qty: number;
  amount: number;
  incentiveSA: number;
  incentiveTech: number;
};

type EstimateServiceLine = {
  isPackage: boolean;
  isRequired: boolean;
  isAdditional: boolean;
  packageId: number | null;
  serviceId: number;
  rate: number;
  hours: number;
  amount: number;
};

type EstimateTechnicianLine = {
  technicianUserId: number;
};

type EstimateTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

type ProductWriteContext = {
  canEditPrice: boolean;
  productPricesById: Map<number, number>;
  existingPricesByProductId?: Map<number, number>;
  createdById: number;
  updatedById: number;
};

type ServiceWriteContext = {
  canEditPrice: boolean;
  serviceRatesById: Map<number, number>;
  existingRatesByServiceId?: Map<number, number>;
  createdById: number;
  updatedById: number;
};

type EstimateLineWriteContext = {
  packages: EstimatePackageLine[];
  products: EstimateProductLine[];
  services: EstimateServiceLine[];
  technicians: EstimateTechnicianLine[];
  productPricesById: Map<number, number>;
  serviceRatesById: Map<number, number>;
  canEditPrice: boolean;
  createdById: number;
  updatedById: number;
  now: Date;
};

async function writeEstimateLines(
  tx: EstimateTransaction,
  estimateId: number,
  context: EstimateLineWriteContext,
) {
  await createEstimatePackages(
    tx,
    estimateId,
    context.packages,
    context.createdById,
    context.updatedById,
    context.now,
  );
  await createEstimateProducts(tx, estimateId, context.products, {
    canEditPrice: context.canEditPrice,
    productPricesById: context.productPricesById,
    createdById: context.createdById,
    updatedById: context.updatedById,
  });
  await createEstimateServices(tx, estimateId, context.services, {
    canEditPrice: context.canEditPrice,
    serviceRatesById: context.serviceRatesById,
    createdById: context.createdById,
    updatedById: context.updatedById,
  });
  await createEstimateTechnicians(
    tx,
    estimateId,
    context.technicians,
    context.createdById,
    context.updatedById,
    context.now,
  );
}

async function createEstimatePackages(
  tx: EstimateTransaction,
  estimateId: number,
  packages: EstimatePackageLine[],
  createdById: number,
  updatedById: number,
  now = new Date(),
) {
  if (packages.length === 0) return;

  await tx.estimatePackage.createMany({
    data: packages.map((packageItem) => ({
      EstimateId: estimateId,
      PackageId: packageItem.packageId,
      IsAdditional: packageItem.isAdditional,
      IncentiveSA: packageItem.incentiveSA,
      IncentiveTech: packageItem.incentiveTech,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById || createdById,
      UpdatedDateTime: now,
    })),
  });
}

async function createEstimateProducts(
  tx: EstimateTransaction,
  estimateId: number,
  products: EstimateProductLine[],
  context: ProductWriteContext,
) {
  if (products.length === 0) return;

  const now = new Date();
  await tx.estimateProduct.createMany({
    data: products.map((product) => {
      const price = context.canEditPrice
        ? product.price
        : (context.existingPricesByProductId?.get(product.productId) ??
          context.productPricesById.get(product.productId) ??
          0);

      return {
        EstimateId: estimateId,
        IsPackage: product.isPackage,
        IsRequired: product.isRequired,
        IsAdditional: product.isAdditional,
        PackageId: product.packageId,
        ProductId: product.productId,
        Price: price,
        Qty: product.qty,
        Amount: context.canEditPrice ? product.amount : price * product.qty,
        IncentiveSA: product.incentiveSA,
        IncentiveTech: product.incentiveTech,
        CreatedById: context.createdById,
        CreatedDateTime: now,
        UpdatedById: context.updatedById || context.createdById,
        UpdatedDateTime: now,
      };
    }),
  });
}

async function createEstimateServices(
  tx: EstimateTransaction,
  estimateId: number,
  services: EstimateServiceLine[],
  context: ServiceWriteContext,
) {
  if (services.length === 0) return;

  const now = new Date();
  await tx.estimateService.createMany({
    data: services.map((service) => {
      const rate = context.canEditPrice
        ? service.rate
        : (context.existingRatesByServiceId?.get(service.serviceId) ??
          context.serviceRatesById.get(service.serviceId) ??
          0);

      return {
        EstimateId: estimateId,
        IsPackage: service.isPackage,
        IsRequired: service.isRequired,
        IsAdditional: service.isAdditional,
        PackageId: service.packageId,
        ServiceId: service.serviceId,
        Rate: rate,
        Hours: service.hours,
        Amount: context.canEditPrice ? service.amount : rate * service.hours,
        CreatedById: context.createdById,
        CreatedDateTime: now,
        UpdatedById: context.updatedById || context.createdById,
        UpdatedDateTime: now,
      };
    }),
  });
}

async function createEstimateTechnicians(
  tx: EstimateTransaction,
  estimateId: number,
  technicians: EstimateTechnicianLine[],
  createdById: number,
  updatedById: number,
  now = new Date(),
) {
  if (technicians.length === 0) return;

  await tx.estimateTechnician.createMany({
    data: technicians.map((technician) => ({
      EstimateId: estimateId,
      TechnicianUserId: technician.technicianUserId,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById || createdById,
      UpdatedDateTime: now,
    })),
  });
}

async function validateEstimateLines(
  packages: EstimatePackageLine[],
  products: EstimateProductLine[],
  services: EstimateServiceLine[],
  technicians: EstimateTechnicianLine[],
) {
  await Promise.all([
    validatePackageIds(
      [
        ...packages.map((packageItem) => packageItem.packageId),
        ...products
          .map((product) => product.packageId)
          .filter((packageId): packageId is number => !!packageId),
        ...services
          .map((service) => service.packageId)
          .filter((packageId): packageId is number => !!packageId),
      ],
      "One or more package ids are invalid.",
    ),
    validateProductIds(products.map((product) => product.productId)),
    validateServiceIds(services.map((service) => service.serviceId)),
    validateTechnicianIds(
      technicians.map((technician) => technician.technicianUserId),
    ),
  ]);
}

async function validatePackageIds(ids: number[], message: string) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.package.count({
    where: { Id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new OperationServiceError(message);
  }
}

async function validateProductIds(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.product.count({
    where: { Id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new OperationServiceError("One or more product ids are invalid.");
  }
}

async function validateServiceIds(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.service.count({
    where: { Id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new OperationServiceError("One or more service ids are invalid.");
  }
}

async function validateTechnicianIds(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.user.count({
    where: { Id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new OperationServiceError("One or more technician user ids are invalid.");
  }
}

async function validateNonQuickSalesProducts(products: EstimateProductLine[]) {
  const ids = distinctPositiveIds(products.map((product) => product.productId));
  if (ids.length === 0) return;

  const mismatchedProducts = await prisma.product.findMany({
    where: {
      Id: { in: ids },
      IsQuickSalesProduct: true,
    },
    take: 3,
    select: {
      Id: true,
      Name: true,
      DisplayName: true,
    },
  });

  if (mismatchedProducts.length === 0) return;

  const names = mismatchedProducts
    .map(
      (product) =>
        product.Name?.trim() || product.DisplayName?.trim() || `Product ${product.Id}`,
    )
    .join(", ");

  throw new OperationServiceError(
    `Only non-quick sales products can be used in estimates. Not available here: ${names}.`,
  );
}

async function getProductSellingPrices(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return new Map<number, number>();

  const rows = await prisma.product.findMany({
    where: { Id: { in: uniqueIds } },
    select: { Id: true, SellingPrice: true },
  });

  return new Map(
    rows.map((row) => [row.Id, numberFromDecimal(row.SellingPrice)]),
  );
}

async function getServiceStandardRates(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return new Map<number, number>();

  const rows = await prisma.service.findMany({
    where: { Id: { in: uniqueIds } },
    select: { Id: true, StandardRate: true },
  });

  return new Map(
    rows.map((row) => [row.Id, numberFromDecimal(row.StandardRate)]),
  );
}

function deriveEstimateIsPackage(
  packages: EstimatePackageLine[],
  products: EstimateProductLine[],
  services: EstimateServiceLine[],
  fallback: boolean,
) {
  return (
    packages.some((packageItem) => packageItem.packageId > 0) ||
    products.some((product) => product.isPackage || !!product.packageId) ||
    services.some((service) => service.isPackage || !!service.packageId) ||
    fallback
  );
}

function validateDiscountRemarks(
  remarks: string,
  laborDiscount: number,
  productDiscount: number,
  additionalDiscount: number,
) {
  if (
    (laborDiscount > 0 || productDiscount > 0 || additionalDiscount > 0) &&
    !remarks.trim()
  ) {
    throw new OperationServiceError(
      "Remarks are required when any discount is greater than 0.",
    );
  }
}

async function resolveJobStatusIdOrDefault(
  requestedJobStatusId: number,
  ...fallbackStatusNames: string[]
) {
  if (requestedJobStatusId > 0) {
    const exists = await prisma.jobStatus.findUnique({
      where: { Id: requestedJobStatusId },
      select: { Id: true },
    });

    return exists ? requestedJobStatusId : null;
  }

  const normalized = fallbackStatusNames.map((status) => status.toUpperCase());
  if (normalized.length > 0) {
    const fallback = await prisma.jobStatus.findFirst({
      where: {
        OR: normalized.map((status) => ({
          Name: {
            equals: status,
            mode: "insensitive" as const,
          },
        })),
      },
      select: { Id: true },
    });

    if (fallback) return fallback.Id;
  }

  const firstStatus = await prisma.jobStatus.findFirst({
    orderBy: { Id: "asc" },
    select: { Id: true },
  });

  return firstStatus?.Id ?? null;
}

function invalidJobStatus(requestedJobStatusId: number) {
  if (requestedJobStatusId > 0) {
    return new OperationServiceError(
      `JobStatusId ${requestedJobStatusId} does not exist.`,
    );
  }

  return new OperationServiceError(
    "At least one job status is required before saving estimates.",
  );
}

async function rejectReopenTransition(
  currentJobStatusId: number | null,
  requestedJobStatusId: number,
) {
  if (requestedJobStatusId <= 0) return;
  if (!(await isOpenJobStatus(requestedJobStatusId))) return;

  if (
    currentJobStatusId &&
    currentJobStatusId > 0 &&
    !(await isOpenJobStatus(currentJobStatusId))
  ) {
    throw new OperationServiceError(
      "Re-opening operation records is no longer supported.",
    );
  }
}

async function isOpenJobStatus(jobStatusId: number) {
  const status = await prisma.jobStatus.findFirst({
    where: {
      Id: jobStatusId,
      Name: {
        equals: "OPEN",
        mode: "insensitive",
      },
    },
    select: { Id: true },
  });

  return !!status;
}

async function getOrCreateDeletedJobStatusId(actorUserId: number) {
  const existing = await prisma.jobStatus.findFirst({
    where: {
      Name: {
        equals: "DELETED",
        mode: "insensitive",
      },
    },
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

function readPackageLines(body: JsonRecord) {
  return readRecordArray(body, "packages", "Packages")
    .map((item) => ({
      packageId:
        readInteger(item, "packageId", "PackageId") ??
        readInteger(item, "id", "Id") ??
        0,
      isAdditional:
        readBoolean(item, "isAdditional", "IsAdditional") ?? false,
      incentiveSA: readDecimal(item, "incentiveSA", "IncentiveSA"),
      incentiveTech: readDecimal(item, "incentiveTech", "IncentiveTech"),
    }))
    .filter((item) => item.packageId > 0);
}

function readProductLines(body: JsonRecord) {
  return readRecordArray(body, "products", "Products")
    .map((item) => ({
      isPackage: readBoolean(item, "isPackage", "IsPackage") ?? false,
      isRequired: readBoolean(item, "isRequired", "IsRequired") ?? false,
      isAdditional:
        readBoolean(item, "isAdditional", "IsAdditional") ?? false,
      packageId: readInteger(item, "packageId", "PackageId"),
      productId: readInteger(item, "productId", "ProductId") ?? 0,
      price: readDecimal(item, "price", "Price"),
      qty: readInteger(item, "qty", "Qty") ?? 0,
      amount: readDecimal(item, "amount", "Amount"),
      incentiveSA: readDecimal(item, "incentiveSA", "IncentiveSA"),
      incentiveTech: readDecimal(item, "incentiveTech", "IncentiveTech"),
    }))
    .filter((item) => item.productId > 0);
}

function readServiceLines(body: JsonRecord) {
  return readRecordArray(body, "services", "Services")
    .map((item) => ({
      isPackage: readBoolean(item, "isPackage", "IsPackage") ?? false,
      isRequired: readBoolean(item, "isRequired", "IsRequired") ?? false,
      isAdditional:
        readBoolean(item, "isAdditional", "IsAdditional") ?? false,
      packageId: readInteger(item, "packageId", "PackageId"),
      serviceId: readInteger(item, "serviceId", "ServiceId") ?? 0,
      rate: readDecimal(item, "rate", "Rate"),
      hours: readDecimal(item, "hours", "Hours"),
      amount: readDecimal(item, "amount", "Amount"),
    }))
    .filter((item) => item.serviceId > 0);
}

function readTechnicianLines(body: JsonRecord) {
  const ids = readRecordArray(body, "technicians", "Technicians")
    .map(
      (item) =>
        readInteger(item, "technicianUserId", "TechnicianUserId") ??
        readInteger(item, "userId", "UserId") ??
        0,
    )
    .filter((id) => id > 0);

  return ids.map((technicianUserId) => ({
    technicianUserId,
  }));
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

function readString(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (value === null) return null;
    if (typeof value === "string") return value;
  }

  return null;
}

function readInteger(body: JsonRecord, ...keys: string[]) {
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

function readPositiveInteger(body: JsonRecord, ...keys: string[]) {
  const value = readInteger(body, ...keys);
  return value && value > 0 ? value : null;
}

function readDecimal(body: JsonRecord, ...keys: string[]) {
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

function readBoolean(body: JsonRecord, ...keys: string[]) {
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

function setIfProvided<T>(
  data: Record<string, unknown>,
  field: string,
  body: JsonRecord,
  reader: (body: JsonRecord, ...keys: string[]) => T,
  ...keys: string[]
) {
  if (hasField(body, ...keys)) {
    const value = reader(body, ...keys);
    if (value !== null) {
      data[field] = value;
    }
  }
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

function distinctPositiveIds(values: number[]) {
  return values
    .filter((value) => value > 0)
    .filter((value, index, source) => source.indexOf(value) === index);
}

function numberFromDecimal(value: { toString: () => string } | number) {
  return typeof value === "number" ? value : Number(value.toString());
}

function normalizePrismaError(error: unknown, entityName: string) {
  if (error instanceof OperationServiceError) return error;

  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new OperationServiceError(`${entityName} not found`, 404);
    }

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
