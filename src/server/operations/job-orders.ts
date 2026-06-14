import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { OperationServiceError } from "@/server/operations/inspections";

const defaultJobOrderReference = "JO0000001";

const jobOrderListSelect = {
  Id: true,
  EstimateId: true,
  InvoiceId: true,
  CustomerId: true,
  VehicleId: true,
  IsChangan: true,
  IsPackage: true,
  ReferenceNo: true,
  TransactionDate: true,
  CreatedDateTime: true,
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

const userSummarySelect = {
  Id: true,
  Firstname: true,
  LastName: true,
  Role: {
    select: {
      Name: true,
    },
  },
} as const;

const jobOrderDetailSelect = {
  Id: true,
  IsChangan: true,
  IsPackage: true,
  IsPaid: true,
  EstimateId: true,
  ReferenceNo: true,
  TransactionDate: true,
  ExpirationDate: true,
  JobStatusId: true,
  CustomerId: true,
  VehicleId: true,
  AdvisorUserId: true,
  EstimatorUserId: true,
  ApproverUserId: true,
  ServiceGroupId: true,
  Odometer: true,
  NextOdometerReminder: true,
  InvoiceId: true,
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
  ServiceGroup: {
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
      CompanyName: true,
    },
  },
  AdvisorUser: {
    select: userSummarySelect,
  },
  EstimatorUser: {
    select: userSummarySelect,
  },
  ApproverUser: {
    select: userSummarySelect,
  },
} as const;

export async function listJobOrders() {
  const rows = await prisma.jobOrder.findMany({
    orderBy: { Id: "asc" },
    select: jobOrderListSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    estimateId: row.EstimateId,
    invoiceId: row.InvoiceId,
    customerId: row.CustomerId,
    vehicleId: row.VehicleId,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo ?? "",
    transactionDate: row.TransactionDate,
    createdDate: row.CreatedDateTime,
    customerName: customerName(row.Customer),
    vehicle: vehicleName(row.Vehicle),
    plateNo: row.Vehicle?.PlateNo ?? "",
    jobStatus: row.JobStatus?.Name ?? "",
    isPackage: row.IsPackage,
  }));
}

export async function listJobOrderSummary() {
  const rows = await prisma.jobOrder.findMany({
    orderBy: { Id: "asc" },
    select: jobOrderListSelect,
  });
  const jobOrderIds = rows.map((row) => row.Id);

  const [packageLinks, serviceLinks, productPackageLinks] = await Promise.all([
    prisma.jobOrderPackage.findMany({
      where: { JobOrderId: { in: jobOrderIds } },
      select: { JobOrderId: true, PackageId: true },
    }),
    prisma.jobOrderService.findMany({
      where: { JobOrderId: { in: jobOrderIds } },
      select: {
        JobOrderId: true,
        ServiceId: true,
        PackageId: true,
        Service: {
          select: {
            Name: true,
          },
        },
      },
    }),
    prisma.jobOrderProduct.findMany({
      where: { JobOrderId: { in: jobOrderIds } },
      select: { JobOrderId: true, PackageId: true },
    }),
  ]);

  const packageIdsByJobOrder = new Map<number, number[]>();
  for (const link of packageLinks) {
    pushUnique(packageIdsByJobOrder, link.JobOrderId, link.PackageId);
  }
  for (const link of serviceLinks) {
    if (link.PackageId) {
      pushUnique(packageIdsByJobOrder, link.JobOrderId, link.PackageId);
    }
  }
  for (const link of productPackageLinks) {
    if (link.PackageId) {
      pushUnique(packageIdsByJobOrder, link.JobOrderId, link.PackageId);
    }
  }

  const serviceIdsByJobOrder = new Map<number, number[]>();
  const serviceNamesByJobOrder = new Map<number, string[]>();
  for (const link of serviceLinks) {
    pushUnique(serviceIdsByJobOrder, link.JobOrderId, link.ServiceId);
    const serviceName = link.Service?.Name?.trim();
    if (serviceName) {
      pushUnique(serviceNamesByJobOrder, link.JobOrderId, serviceName);
    }
  }

  const allPackageIds = distinct(
    [...packageIdsByJobOrder.values()].flat().filter((id) => id > 0),
  );
  const [packageSummaries, packageServiceLinks] = await Promise.all([
    allPackageIds.length === 0
      ? []
      : prisma.package.findMany({
          where: { Id: { in: allPackageIds } },
          select: {
            Id: true,
            Name: true,
            Code: true,
            Summary: true,
          },
        }),
    allPackageIds.length === 0
      ? []
      : prisma.packageService.findMany({
          where: { PackageId: { in: allPackageIds } },
          select: {
            PackageId: true,
            Service: {
              select: {
                Name: true,
              },
            },
          },
        }),
  ]);
  const packageNamesById = new Map(
    packageSummaries.map((item) => [item.Id, item.Name ?? ""]),
  );
  const packageSearchTextsById = new Map(
    packageSummaries.map((item) => [
      item.Id,
      [item.Name, item.Code, item.Summary]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" "),
    ]),
  );
  const serviceNamesByPackageId = new Map<number, string[]>();
  for (const link of packageServiceLinks) {
    const serviceName = link.Service?.Name?.trim();
    if (serviceName) {
      pushUnique(serviceNamesByPackageId, link.PackageId, serviceName);
    }
  }

  return rows.map((row) => {
    const packageIds = packageIdsByJobOrder.get(row.Id) ?? [];

    return {
      id: row.Id,
      estimateId: row.EstimateId,
      invoiceId: row.InvoiceId,
      customerId: row.CustomerId,
      vehicleId: row.VehicleId,
      isChangan: row.IsChangan,
      referenceNo: row.ReferenceNo ?? "",
      transactionDate: row.TransactionDate,
      createdDate: row.CreatedDateTime,
      customer: customerName(row.Customer),
      vehicle: vehicleName(row.Vehicle),
      plateNo: row.Vehicle?.PlateNo ?? "",
      isPackage: row.IsPackage,
      status: row.JobStatus?.Name ?? "",
      packageIds,
      packageNames: packageIds
        .map((packageId) => packageNamesById.get(packageId) ?? "")
        .filter(Boolean),
      packageSearchTexts: packageIds
        .map((packageId) => packageSearchTextsById.get(packageId) ?? "")
        .filter(Boolean),
      packageServiceNames: distinct(
        packageIds.flatMap(
          (packageId) => serviceNamesByPackageId.get(packageId) ?? [],
        ),
      ),
      serviceIds: serviceIdsByJobOrder.get(row.Id) ?? [],
      serviceNames: serviceNamesByJobOrder.get(row.Id) ?? [],
    };
  });
}

export async function getNextJobOrderReferenceNo() {
  const latestRef = await prisma.jobOrder.findFirst({
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

export async function listJobOrdersByService(serviceId: number) {
  const links = await prisma.jobOrderService.findMany({
    where: { ServiceId: serviceId },
    distinct: ["JobOrderId"],
    select: { JobOrderId: true },
  });
  const jobOrderIds = links.map((link) => link.JobOrderId);

  if (jobOrderIds.length === 0) return [];

  return listJobOrderLookup(jobOrderIds);
}

export async function listJobOrdersByProduct(productId: number) {
  const links = await prisma.jobOrderProduct.findMany({
    where: { ProductId: productId },
    distinct: ["JobOrderId"],
    select: { JobOrderId: true },
  });
  const jobOrderIds = links.map((link) => link.JobOrderId);

  if (jobOrderIds.length === 0) return [];

  return listJobOrderLookup(jobOrderIds);
}

export async function getJobOrder(id: number) {
  const row = await prisma.jobOrder.findUnique({
    where: { Id: id },
    select: jobOrderDetailSelect,
  });

  if (!row) return null;

  const [jobOrderServices, jobOrderProducts, jobOrderPackages, jobOrderTechs] =
    await Promise.all([
      getJobOrderServices(id),
      getJobOrderProducts(id),
      getJobOrderPackages(id),
      getJobOrderTechnicians(id),
    ]);

  const [services, products, packages, technicians] =
    row.EstimateId > 0
      ? await Promise.all([
          jobOrderServices.length > 0
            ? jobOrderServices
            : getEstimateServices(row.EstimateId, id),
          jobOrderProducts.length > 0
            ? jobOrderProducts
            : getEstimateProducts(row.EstimateId, id),
          jobOrderPackages.length > 0
            ? jobOrderPackages
            : getEstimatePackages(row.EstimateId),
          jobOrderTechs.length > 0
            ? jobOrderTechs
            : getEstimateTechnicians(row.EstimateId),
        ])
      : [jobOrderServices, jobOrderProducts, jobOrderPackages, jobOrderTechs];

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    isPackage: row.IsPackage,
    isPaid: row.IsPaid,
    estimateId: row.EstimateId,
    referenceNo: row.ReferenceNo,
    transactionDate: row.TransactionDate,
    expirationDate: row.ExpirationDate,
    jobStatusId: row.JobStatusId,
    customerId: row.CustomerId,
    vehicleId: row.VehicleId,
    advisorUserId: row.AdvisorUserId,
    estimatorUserId: row.EstimatorUserId,
    approverUserId: row.ApproverUserId,
    serviceGroupId: row.ServiceGroupId,
    odometer: row.Odometer,
    nextOdometerReminder: row.NextOdometerReminder,
    invoiceId: row.InvoiceId,
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
    serviceGroup: row.ServiceGroup
      ? {
          id: row.ServiceGroup.Id,
          name: row.ServiceGroup.Name ?? "",
          description: row.ServiceGroup.Description ?? "",
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
          companyName: row.Customer.CompanyName ?? "",
        }
      : null,
    advisorUser: mapUser(row.AdvisorUser),
    estimatorUser: mapUser(row.EstimatorUser),
    approverUser: mapUser(row.ApproverUser),
    technicians,
    packages,
    services,
    products,
  };
}

export async function createJobOrder(body: JsonRecord, actorUserId: number) {
  const estimateId = readInteger(body, "estimateId", "EstimateId") ?? 0;

  if (estimateId > 0) {
    const existingJobOrder = await prisma.jobOrder.findFirst({
      where: { EstimateId: estimateId },
      orderBy: { Id: "desc" },
      select: { Id: true, ReferenceNo: true },
    });

    if (existingJobOrder) {
      throw new OperationServiceError(
        `Estimate is already linked to job order ${existingJobOrder.ReferenceNo ?? ""}.`,
        409,
        {
          message: `Estimate is already linked to job order ${existingJobOrder.ReferenceNo ?? ""}.`,
          id: existingJobOrder.Id,
          jobOrderId: existingJobOrder.Id,
          referenceNo: existingJobOrder.ReferenceNo ?? "",
        },
      );
    }
  }

  const now = new Date();
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ??
    (actorUserId > 0 ? actorUserId : 0);
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") || createdById;
  const packages = readPackageLines(body);
  const products = readProductLines(body);
  const services = readServiceLines(body);
  const technicians = readTechnicianLines(body);
  const summary = readString(body, "summary", "Summary") ?? "";
  const laborDiscount = readDecimal(body, "laborDiscount", "LaborDiscount");
  const productDiscount = readDecimal(body, "productDiscount", "ProductDiscount");
  const additionalDiscount = readDecimal(
    body,
    "additionalDiscount",
    "AdditionalDiscount",
  );
  const jobStatusId = readInteger(body, "jobStatusId", "JobStatusId") ?? 0;
  const referenceNo =
    readString(body, "referenceNo", "ReferenceNo")?.trim() ||
    (await getNextJobOrderReferenceNo()).referenceNo;
  const isPackage = deriveIsPackage(
    packages,
    products,
    services,
    readBoolean(body, "isPackage", "IsPackage") ?? false,
  );

  validateDiscountRemarks(
    summary,
    laborDiscount,
    productDiscount,
    additionalDiscount,
  );
  await validateNonQuickSalesProducts(products);
  await validateJobOrderLines(packages, products, services, technicians);
  await validateInventoryUsageIfNeeded(jobStatusId, products);

  const tagContext =
    estimateId > 0 ? await buildLinkedEstimateLineTagContext(estimateId) : null;
  const taggedPackages = packages.map((line) => ({
    line,
    isAdditional: shouldTagPackageAdditional(line, tagContext),
  }));
  const taggedProducts = products.map((line) => ({
    line,
    isAdditional: shouldTagProductAdditional(line, tagContext),
  }));
  const taggedServices = services.map((line) => ({
    line,
    isAdditional: shouldTagServiceAdditional(line, tagContext),
  }));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.jobOrder.create({
        data: {
          IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
          IsPackage: isPackage,
          IsPaid: readBoolean(body, "isPaid", "IsPaid") ?? false,
          EstimateId: estimateId,
          ReferenceNo: referenceNo,
          TransactionDate: readDate(body, "transactionDate", "TransactionDate"),
          ExpirationDate: readDate(body, "expirationDate", "ExpirationDate"),
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
          InvoiceId: readInteger(body, "invoiceId", "InvoiceId"),
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
        select: { Id: true },
      });

      await writeJobOrderLines(tx, row.Id, {
        taggedPackages,
        taggedProducts,
        taggedServices,
        technicians,
        createdById,
        updatedById,
        now,
      });
      await syncLinkedEstimateAdditionalLines(tx, {
        jobOrderId: row.Id,
        estimateId,
        isPackage,
        subTotal: readDecimal(body, "subTotal", "SubTotal"),
        vat12: readDecimal(body, "vat12", "VAT12"),
        laborDiscount,
        productDiscount,
        additionalDiscount,
        totalAmount: readDecimal(body, "totalAmount", "TotalAmount"),
        taggedPackages,
        taggedProducts,
        taggedServices,
        updaterId: updatedById,
        now,
      });

      return row;
    });

    return { id: created.Id };
  } catch (error) {
    throw normalizePrismaError(error, "job order");
  }
}

export async function updateJobOrder(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.jobOrder.findUnique({
    where: { Id: id },
    select: {
      Id: true,
      EstimateId: true,
      IsPackage: true,
      Summary: true,
      LaborDiscount: true,
      ProductDiscount: true,
      AdditionalDiscount: true,
      SubTotal: true,
      VAT12: true,
      TotalAmount: true,
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

  validateDiscountRemarks(
    readString(body, "summary", "Summary") ?? existing.Summary ?? "",
    hasField(body, "laborDiscount", "LaborDiscount")
      ? readDecimal(body, "laborDiscount", "LaborDiscount")
      : numberFromDecimal(existing.LaborDiscount),
    hasField(body, "productDiscount", "ProductDiscount")
      ? readDecimal(body, "productDiscount", "ProductDiscount")
      : numberFromDecimal(existing.ProductDiscount),
    hasField(body, "additionalDiscount", "AdditionalDiscount")
      ? readDecimal(body, "additionalDiscount", "AdditionalDiscount")
      : numberFromDecimal(existing.AdditionalDiscount),
  );

  const requestedJobStatusId = readInteger(body, "jobStatusId", "JobStatusId");
  if (requestedJobStatusId !== null) {
    await rejectReopenTransition(existing.JobStatusId, requestedJobStatusId);
    data.JobStatusId = requestedJobStatusId;
  }

  if (products) {
    await validateNonQuickSalesProducts(products);
  }

  if (products || requestedJobStatusId !== null) {
    await validateInventoryUsageIfNeeded(
      requestedJobStatusId ?? existing.JobStatusId,
      products ?? (await getJobOrderUsage(id)),
      id,
    );
  }

  await validateJobOrderLines(
    packages ?? [],
    products ?? [],
    services ?? [],
    technicians ?? [],
  );

  if (packages || products || services) {
    data.IsPackage = deriveIsPackage(packages ?? [], products ?? [], services ?? [], false);
  } else {
    setIfProvided(data, "IsPackage", body, readBoolean, "isPackage", "IsPackage");
  }

  setIfProvided(data, "IsChangan", body, readBoolean, "isChangan", "IsChangan");
  setIfProvided(data, "IsPaid", body, readBoolean, "isPaid", "IsPaid");
  setIfProvided(data, "EstimateId", body, readInteger, "estimateId", "EstimateId");
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
  setIfProvided(data, "InvoiceId", body, readInteger, "invoiceId", "InvoiceId");
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

  const nextEstimateId =
    (data.EstimateId as number | undefined) ?? existing.EstimateId;
  const tagContext =
    nextEstimateId > 0 && (packages || products || services)
      ? await buildLinkedEstimateLineTagContext(nextEstimateId)
      : null;
  const taggedPackages = packages?.map((line) => ({
    line,
    isAdditional: shouldTagPackageAdditional(line, tagContext),
  }));
  const taggedProducts = products?.map((line) => ({
    line,
    isAdditional: shouldTagProductAdditional(line, tagContext),
  }));
  const taggedServices = services?.map((line) => ({
    line,
    isAdditional: shouldTagServiceAdditional(line, tagContext),
  }));
  const updaterId =
    readPositiveInteger(body, "updatedById", "UpdatedById") ??
    existing.UpdatedById ??
    (actorUserId > 0 ? actorUserId : 0);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.jobOrder.update({ where: { Id: id }, data });

      if (taggedPackages) {
        await tx.jobOrderPackage.deleteMany({ where: { JobOrderId: id } });
        await createJobOrderPackages(tx, id, taggedPackages, updaterId, updaterId, now);
      }

      if (taggedProducts) {
        await tx.jobOrderProduct.deleteMany({ where: { JobOrderId: id } });
        await createJobOrderProducts(tx, id, taggedProducts, updaterId, updaterId, now);
      }

      if (taggedServices) {
        await tx.jobOrderService.deleteMany({ where: { JobOrderId: id } });
        await createJobOrderServices(tx, id, taggedServices, updaterId, updaterId, now);
      }

      if (technicians) {
        await tx.jobOrderTechnician.deleteMany({ where: { JobOrderId: id } });
        await createJobOrderTechnicians(tx, id, technicians, updaterId, updaterId, now);
      }

      await syncLinkedEstimateAdditionalLines(tx, {
        jobOrderId: id,
        estimateId: nextEstimateId,
        isPackage: (data.IsPackage as boolean | undefined) ?? existing.IsPackage,
        subTotal:
          (data.SubTotal as number | undefined) ??
          numberFromDecimal(existing.SubTotal),
        vat12:
          (data.VAT12 as number | undefined) ?? numberFromDecimal(existing.VAT12),
        laborDiscount:
          (data.LaborDiscount as number | undefined) ??
          numberFromDecimal(existing.LaborDiscount),
        productDiscount:
          (data.ProductDiscount as number | undefined) ??
          numberFromDecimal(existing.ProductDiscount),
        additionalDiscount:
          (data.AdditionalDiscount as number | undefined) ??
          numberFromDecimal(existing.AdditionalDiscount),
        totalAmount:
          (data.TotalAmount as number | undefined) ??
          numberFromDecimal(existing.TotalAmount),
        taggedPackages,
        taggedProducts,
        taggedServices,
        updaterId,
        now,
      });
    });
  } catch (error) {
    throw normalizePrismaError(error, "job order");
  }

  return true;
}

export async function deleteJobOrder(id: number, actorUserId: number) {
  const existing = await prisma.jobOrder.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);
  await prisma.jobOrder.update({
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

async function listJobOrderLookup(jobOrderIds: number[]) {
  const rows = await prisma.jobOrder.findMany({
    where: { Id: { in: jobOrderIds } },
    orderBy: { Id: "asc" },
    select: jobOrderListSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    customerId: row.CustomerId,
    vehicleId: row.VehicleId,
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

async function getJobOrderServices(jobOrderId: number) {
  const rows = await prisma.jobOrderService.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: serviceLineSelect,
  });

  return rows.map((row) => mapServiceLine(row, row.JobOrderId));
}

async function getEstimateServices(estimateId: number, jobOrderId: number) {
  const rows = await prisma.estimateService.findMany({
    where: { EstimateId: estimateId },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsPackage: true,
      IsRequired: true,
      IsAdditional: true,
      PackageId: true,
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
  });

  return rows.map((row) => mapServiceLine(row, jobOrderId));
}

async function getJobOrderProducts(jobOrderId: number) {
  const rows = await prisma.jobOrderProduct.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: productLineSelect,
  });

  return rows.map((row) => mapProductLine(row, row.JobOrderId));
}

async function getEstimateProducts(estimateId: number, jobOrderId: number) {
  const rows = await prisma.estimateProduct.findMany({
    where: { EstimateId: estimateId },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsPackage: true,
      IsRequired: true,
      IsAdditional: true,
      PackageId: true,
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
  });

  return rows.map((row) => mapProductLine(row, jobOrderId));
}

async function getJobOrderPackages(jobOrderId: number) {
  const rows = await prisma.jobOrderPackage.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: packageLineSelect,
  });

  return rows.map(mapPackageLine);
}

async function getEstimatePackages(estimateId: number) {
  const rows = await prisma.estimatePackage.findMany({
    where: { EstimateId: estimateId },
    orderBy: { Id: "asc" },
    select: packageLineSelect,
  });

  return rows.map(mapPackageLine);
}

async function getJobOrderTechnicians(jobOrderId: number) {
  const rows = await prisma.jobOrderTechnician.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: technicianLineSelect,
  });

  return rows.map(mapTechnicianLine);
}

async function getEstimateTechnicians(estimateId: number) {
  const rows = await prisma.estimateTechnician.findMany({
    where: { EstimateId: estimateId },
    orderBy: { Id: "asc" },
    select: technicianLineSelect,
  });

  return rows.map(mapTechnicianLine);
}

const packageLineSelect = {
  PackageId: true,
  IsAdditional: true,
  IncentiveSA: true,
  IncentiveTech: true,
  Package: {
    select: {
      Name: true,
      Code: true,
    },
  },
} as const;

const serviceLineSelect = {
  Id: true,
  IsPackage: true,
  IsRequired: true,
  IsAdditional: true,
  PackageId: true,
  JobOrderId: true,
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
} as const;

const productLineSelect = {
  Id: true,
  IsPackage: true,
  IsRequired: true,
  IsAdditional: true,
  PackageId: true,
  JobOrderId: true,
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
} as const;

const technicianLineSelect = {
  Id: true,
  TechnicianUserId: true,
  TechnicianUser: {
    select: {
      Id: true,
      Firstname: true,
      LastName: true,
      MobileNumber: true,
      Role: {
        select: {
          Name: true,
        },
      },
    },
  },
} as const;

function mapPackageLine(row: {
  PackageId: number;
  IsAdditional: boolean;
  IncentiveSA: unknown;
  IncentiveTech: unknown;
  Package: { Name: string; Code: string } | null;
}) {
  return {
    id: row.PackageId,
    name: row.Package?.Name ?? "",
    code: row.Package?.Code ?? "",
    isAdditional: row.IsAdditional,
    incentiveSA: row.IncentiveSA,
    incentiveTech: row.IncentiveTech,
  };
}

function mapServiceLine(
  row: {
    Id: number;
    IsPackage: boolean;
    IsRequired: boolean;
    IsAdditional: boolean;
    PackageId: number | null;
    ServiceId: number;
    Rate: unknown;
    Hours: unknown;
    Amount: unknown;
    Service: { Id: number; Name: string; Code: string } | null;
  },
  jobOrderId: number,
) {
  return {
    id: row.Id,
    isPackage: row.IsPackage,
    isRequired: row.IsRequired,
    isAdditional: row.IsAdditional,
    packageId: row.PackageId,
    jobOrderId,
    serviceId: row.ServiceId,
    rate: row.Rate,
    hours: row.Hours,
    amount: row.Amount,
    service: row.Service
      ? {
          id: row.Service.Id,
          name: row.Service.Name ?? "",
          code: row.Service.Code ?? "",
        }
      : null,
  };
}

function mapProductLine(
  row: {
    Id: number;
    IsPackage: boolean;
    IsRequired: boolean;
    IsAdditional: boolean;
    PackageId: number | null;
    ProductId: number;
    Price: unknown;
    Qty: number;
    Amount: unknown;
    IncentiveSA: unknown;
    IncentiveTech: unknown;
    Product: {
      Id: number;
      Name: string;
      DisplayName: string;
      PartNo: string | null;
    } | null;
  },
  jobOrderId: number,
) {
  return {
    id: row.Id,
    isPackage: row.IsPackage,
    isRequired: row.IsRequired,
    isAdditional: row.IsAdditional,
    packageId: row.PackageId,
    jobOrderId,
    productId: row.ProductId,
    price: row.Price,
    qty: row.Qty,
    amount: row.Amount,
    incentiveSA: row.IncentiveSA,
    incentiveTech: row.IncentiveTech,
    product: row.Product
      ? {
          id: row.Product.Id,
          name: row.Product.Name ?? "",
          displayName: row.Product.DisplayName ?? "",
          partNo: row.Product.PartNo ?? "",
        }
      : null,
  };
}

function mapTechnicianLine(row: {
  Id: number;
  TechnicianUserId: number;
  TechnicianUser: {
    Id: number;
    Firstname: string;
    LastName: string;
    MobileNumber: string | null;
    Role: { Name: string } | null;
  } | null;
}) {
  return {
    id: row.Id,
    technicianUserId: row.TechnicianUserId,
    technicianUser: row.TechnicianUser
      ? {
          id: row.TechnicianUser.Id,
          firstName: row.TechnicianUser.Firstname ?? "",
          lastName: row.TechnicianUser.LastName ?? "",
          mobileNumber: row.TechnicianUser.MobileNumber ?? "",
          role: row.TechnicianUser.Role?.Name ?? "",
        }
      : null,
  };
}

function mapUser(
  user: {
    Id: number;
    Firstname: string;
    LastName: string;
    Role: { Name: string } | null;
  } | null,
) {
  return user
    ? {
        id: user.Id,
        firstName: user.Firstname ?? "",
        lastName: user.LastName ?? "",
        role: user.Role?.Name ?? "",
      }
    : null;
}

function nextReferenceValue(latestRef: string) {
  if (!latestRef) return defaultJobOrderReference;

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

function pushUnique<T>(map: Map<number, T[]>, key: number, value: T) {
  const values = map.get(key) ?? [];
  if (!values.includes(value)) {
    values.push(value);
  }
  map.set(key, values);
}

function distinct<T>(values: T[]) {
  return values.filter((value, index, source) => source.indexOf(value) === index);
}

type JobOrderPackageLine = {
  packageId: number;
  isAdditional: boolean;
  incentiveSA: number;
  incentiveTech: number;
};

type JobOrderProductLine = {
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

type JobOrderServiceLine = {
  isPackage: boolean;
  isRequired: boolean;
  isAdditional: boolean;
  packageId: number | null;
  serviceId: number;
  rate: number;
  hours: number;
  amount: number;
};

type JobOrderTechnicianLine = {
  technicianUserId: number;
};

type TaggedPackageLine = {
  line: JobOrderPackageLine;
  isAdditional: boolean;
};

type TaggedProductLine = {
  line: JobOrderProductLine;
  isAdditional: boolean;
};

type TaggedServiceLine = {
  line: JobOrderServiceLine;
  isAdditional: boolean;
};

type LineTagContext = {
  originalPackages: Set<string>;
  originalProducts: Set<string>;
  originalServices: Set<string>;
};

type JobOrderTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

type JobOrderLineWriteContext = {
  taggedPackages: TaggedPackageLine[];
  taggedProducts: TaggedProductLine[];
  taggedServices: TaggedServiceLine[];
  technicians: JobOrderTechnicianLine[];
  createdById: number;
  updatedById: number;
  now: Date;
};

type SyncEstimateContext = {
  jobOrderId: number;
  estimateId: number;
  isPackage: boolean;
  subTotal: number;
  vat12: number;
  laborDiscount: number;
  productDiscount: number;
  additionalDiscount: number;
  totalAmount: number;
  taggedPackages?: TaggedPackageLine[] | null;
  taggedProducts?: TaggedProductLine[] | null;
  taggedServices?: TaggedServiceLine[] | null;
  updaterId: number;
  now: Date;
};

async function writeJobOrderLines(
  tx: JobOrderTransaction,
  jobOrderId: number,
  context: JobOrderLineWriteContext,
) {
  await createJobOrderPackages(
    tx,
    jobOrderId,
    context.taggedPackages,
    context.createdById,
    context.updatedById,
    context.now,
  );
  await createJobOrderProducts(
    tx,
    jobOrderId,
    context.taggedProducts,
    context.createdById,
    context.updatedById,
    context.now,
  );
  await createJobOrderServices(
    tx,
    jobOrderId,
    context.taggedServices,
    context.createdById,
    context.updatedById,
    context.now,
  );
  await createJobOrderTechnicians(
    tx,
    jobOrderId,
    context.technicians,
    context.createdById,
    context.updatedById,
    context.now,
  );
}

async function createJobOrderPackages(
  tx: JobOrderTransaction,
  jobOrderId: number,
  packages: TaggedPackageLine[],
  createdById: number,
  updatedById: number,
  now = new Date(),
) {
  if (packages.length === 0) return;

  await tx.jobOrderPackage.createMany({
    data: packages.map((tagged) => ({
      JobOrderId: jobOrderId,
      PackageId: tagged.line.packageId,
      IsAdditional: tagged.isAdditional,
      IncentiveSA: tagged.line.incentiveSA,
      IncentiveTech: tagged.line.incentiveTech,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    })),
  });
}

async function createJobOrderProducts(
  tx: JobOrderTransaction,
  jobOrderId: number,
  products: TaggedProductLine[],
  createdById: number,
  updatedById: number,
  now = new Date(),
) {
  if (products.length === 0) return;

  await tx.jobOrderProduct.createMany({
    data: products.map((tagged) => ({
      JobOrderId: jobOrderId,
      IsPackage: tagged.line.isPackage,
      IsRequired: tagged.line.isRequired,
      IsAdditional: tagged.isAdditional,
      PackageId: tagged.line.packageId,
      ProductId: tagged.line.productId,
      Price: tagged.line.price,
      Qty: tagged.line.qty,
      Amount: tagged.line.amount,
      IncentiveSA: tagged.line.incentiveSA,
      IncentiveTech: tagged.line.incentiveTech,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    })),
  });
}

async function createJobOrderServices(
  tx: JobOrderTransaction,
  jobOrderId: number,
  services: TaggedServiceLine[],
  createdById: number,
  updatedById: number,
  now = new Date(),
) {
  if (services.length === 0) return;

  await tx.jobOrderService.createMany({
    data: services.map((tagged) => ({
      JobOrderId: jobOrderId,
      IsPackage: tagged.line.isPackage,
      IsRequired: tagged.line.isRequired,
      IsAdditional: tagged.isAdditional,
      PackageId: tagged.line.packageId,
      ServiceId: tagged.line.serviceId,
      Rate: tagged.line.rate,
      Hours: tagged.line.hours,
      Amount: tagged.line.amount,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    })),
  });
}

async function createJobOrderTechnicians(
  tx: JobOrderTransaction,
  jobOrderId: number,
  technicians: JobOrderTechnicianLine[],
  createdById: number,
  updatedById: number,
  now = new Date(),
) {
  if (technicians.length === 0) return;

  await tx.jobOrderTechnician.createMany({
    data: technicians.map((technician) => ({
      JobOrderId: jobOrderId,
      TechnicianUserId: technician.technicianUserId,
      CreatedById: createdById,
      CreatedDateTime: now,
      UpdatedById: updatedById,
      UpdatedDateTime: now,
    })),
  });
}

async function syncLinkedEstimateAdditionalLines(
  tx: JobOrderTransaction,
  context: SyncEstimateContext,
) {
  if (
    context.estimateId <= 0 ||
    (!context.taggedPackages && !context.taggedProducts && !context.taggedServices)
  ) {
    return;
  }

  const estimate = await tx.estimate.findUnique({
    where: { Id: context.estimateId },
    select: { Id: true },
  });

  if (!estimate) return;

  if (context.taggedPackages) {
    await tx.estimatePackage.deleteMany({
      where: { EstimateId: context.estimateId, IsAdditional: true },
    });

    const additionalPackages = context.taggedPackages.filter(
      (line) => line.isAdditional,
    );
    if (additionalPackages.length > 0) {
      await tx.estimatePackage.createMany({
        data: additionalPackages.map((tagged) => ({
          EstimateId: context.estimateId,
          PackageId: tagged.line.packageId,
          IsAdditional: true,
          IncentiveSA: tagged.line.incentiveSA,
          IncentiveTech: tagged.line.incentiveTech,
          CreatedById: context.updaterId,
          CreatedDateTime: context.now,
          UpdatedById: context.updaterId,
          UpdatedDateTime: context.now,
        })),
      });
    }
  }

  if (context.taggedProducts) {
    await tx.estimateProduct.deleteMany({
      where: { EstimateId: context.estimateId, IsAdditional: true },
    });

    const additionalProducts = context.taggedProducts.filter(
      (line) => line.isAdditional,
    );
    if (additionalProducts.length > 0) {
      await tx.estimateProduct.createMany({
        data: additionalProducts.map((tagged) => ({
          EstimateId: context.estimateId,
          IsPackage: tagged.line.isPackage,
          IsRequired: tagged.line.isRequired,
          IsAdditional: true,
          PackageId: tagged.line.packageId,
          ProductId: tagged.line.productId,
          Price: tagged.line.price,
          Qty: tagged.line.qty,
          Amount: tagged.line.amount,
          IncentiveSA: tagged.line.incentiveSA,
          IncentiveTech: tagged.line.incentiveTech,
          CreatedById: context.updaterId,
          CreatedDateTime: context.now,
          UpdatedById: context.updaterId,
          UpdatedDateTime: context.now,
        })),
      });
    }
  }

  if (context.taggedServices) {
    await tx.estimateService.deleteMany({
      where: { EstimateId: context.estimateId, IsAdditional: true },
    });

    const additionalServices = context.taggedServices.filter(
      (line) => line.isAdditional,
    );
    if (additionalServices.length > 0) {
      await tx.estimateService.createMany({
        data: additionalServices.map((tagged) => ({
          EstimateId: context.estimateId,
          IsPackage: tagged.line.isPackage,
          IsRequired: tagged.line.isRequired,
          IsAdditional: true,
          PackageId: tagged.line.packageId,
          ServiceId: tagged.line.serviceId,
          Rate: tagged.line.rate,
          Hours: tagged.line.hours,
          Amount: tagged.line.amount,
          CreatedById: context.updaterId,
          CreatedDateTime: context.now,
          UpdatedById: context.updaterId,
          UpdatedDateTime: context.now,
        })),
      });
    }
  }

  await tx.estimate.update({
    where: { Id: context.estimateId },
    data: {
      IsPackage: context.isPackage,
      SubTotal: context.subTotal,
      VAT12: context.vat12,
      LaborDiscount: context.laborDiscount,
      ProductDiscount: context.productDiscount,
      AdditionalDiscount: context.additionalDiscount,
      TotalAmount: context.totalAmount,
      UpdatedById: context.updaterId,
      UpdatedDateTime: context.now,
    },
  });
}

async function buildLinkedEstimateLineTagContext(
  estimateId: number,
): Promise<LineTagContext | null> {
  if (estimateId <= 0) return null;

  const [packages, products, services] = await Promise.all([
    prisma.estimatePackage.findMany({
      where: { EstimateId: estimateId, IsAdditional: false },
      select: { PackageId: true },
    }),
    prisma.estimateProduct.findMany({
      where: { EstimateId: estimateId, IsAdditional: false },
      select: { ProductId: true, PackageId: true, IsPackage: true },
    }),
    prisma.estimateService.findMany({
      where: { EstimateId: estimateId, IsAdditional: false },
      select: { ServiceId: true, PackageId: true, IsPackage: true },
    }),
  ]);

  return {
    originalPackages: new Set(packages.map((line) => packageKey(line.PackageId))),
    originalProducts: new Set(
      products.map((line) =>
        productKey(line.ProductId, line.PackageId, line.IsPackage),
      ),
    ),
    originalServices: new Set(
      services.map((line) =>
        serviceKey(line.ServiceId, line.PackageId, line.IsPackage),
      ),
    ),
  };
}

function shouldTagPackageAdditional(
  line: JobOrderPackageLine,
  context: LineTagContext | null,
) {
  return (
    line.isAdditional ||
    (context !== null && !context.originalPackages.has(packageKey(line.packageId)))
  );
}

function shouldTagProductAdditional(
  line: JobOrderProductLine,
  context: LineTagContext | null,
) {
  return (
    line.isAdditional ||
    (context !== null &&
      !context.originalProducts.has(
        productKey(line.productId, line.packageId, line.isPackage),
      ))
  );
}

function shouldTagServiceAdditional(
  line: JobOrderServiceLine,
  context: LineTagContext | null,
) {
  return (
    line.isAdditional ||
    (context !== null &&
      !context.originalServices.has(
        serviceKey(line.serviceId, line.packageId, line.isPackage),
      ))
  );
}

function packageKey(packageId: number) {
  return String(packageId);
}

function productKey(productId: number, packageId: number | null, isPackage: boolean) {
  return `${productId}:${packageId ?? ""}:${isPackage}`;
}

function serviceKey(serviceId: number, packageId: number | null, isPackage: boolean) {
  return `${serviceId}:${packageId ?? ""}:${isPackage}`;
}

async function validateJobOrderLines(
  packages: JobOrderPackageLine[],
  products: JobOrderProductLine[],
  services: JobOrderServiceLine[],
  technicians: JobOrderTechnicianLine[],
) {
  await Promise.all([
    validatePackageIds([
      ...packages.map((line) => line.packageId),
      ...products
        .map((line) => line.packageId)
        .filter((packageId): packageId is number => !!packageId),
      ...services
        .map((line) => line.packageId)
        .filter((packageId): packageId is number => !!packageId),
    ]),
    validateProductIds(products.map((line) => line.productId)),
    validateServiceIds(services.map((line) => line.serviceId)),
    validateTechnicianIds(technicians.map((line) => line.technicianUserId)),
  ]);
}

async function validatePackageIds(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.package.count({ where: { Id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) {
    throw new OperationServiceError("One or more package ids are invalid.");
  }
}

async function validateProductIds(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.product.count({ where: { Id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) {
    throw new OperationServiceError("One or more product ids are invalid.");
  }
}

async function validateServiceIds(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.service.count({ where: { Id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) {
    throw new OperationServiceError("One or more service ids are invalid.");
  }
}

async function validateTechnicianIds(ids: number[]) {
  const uniqueIds = distinctPositiveIds(ids);
  if (uniqueIds.length === 0) return;

  const count = await prisma.user.count({ where: { Id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) {
    throw new OperationServiceError("One or more technician user ids are invalid.");
  }
}

async function validateNonQuickSalesProducts(products: JobOrderProductLine[]) {
  const ids = distinctPositiveIds(products.map((line) => line.productId));
  if (ids.length === 0) return;

  const mismatchedProducts = await prisma.product.findMany({
    where: { Id: { in: ids }, IsQuickSalesProduct: true },
    take: 3,
    select: { Id: true, Name: true, DisplayName: true },
  });

  if (mismatchedProducts.length === 0) return;

  const names = mismatchedProducts
    .map(
      (product) =>
        product.Name?.trim() || product.DisplayName?.trim() || `Product ${product.Id}`,
    )
    .join(", ");

  throw new OperationServiceError(
    `Only non-quick sales products can be used in job orders. Not available here: ${names}.`,
  );
}

async function validateInventoryUsageIfNeeded(
  jobStatusId: number,
  products: JobOrderProductLine[] | Map<number, number>,
  excludeJobOrderId?: number,
) {
  if (!(await isInventoryAffectingStatus(jobStatusId))) return;

  const requestedUsage =
    products instanceof Map ? products : aggregateProductUsage(products);
  const stockError = await validateProductUsage(requestedUsage, excludeJobOrderId);
  if (stockError) {
    throw new OperationServiceError(stockError);
  }
}

function aggregateProductUsage(products: JobOrderProductLine[]) {
  const usage = new Map<number, number>();
  for (const product of products) {
    if (product.productId > 0) {
      usage.set(product.productId, (usage.get(product.productId) ?? 0) + product.qty);
    }
  }

  return usage;
}

async function validateProductUsage(
  requestedUsage: Map<number, number>,
  excludeJobOrderId?: number,
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

  const balances = await getInventoryBalances(excludeJobOrderId);
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
      productId,
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

async function getInventoryBalances(excludeJobOrderId?: number) {
  const balances = new Map<number, number>();
  const [manual, jobOrderUsage, quickSaleUsage] = await Promise.all([
    prisma.productInventoryTransaction.findMany({
      select: { ProductId: true, TransactionType: true, Quantity: true },
    }),
    prisma.jobOrderProduct.findMany({
      where: excludeJobOrderId ? { JobOrderId: { not: excludeJobOrderId } } : {},
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

async function getJobOrderUsage(jobOrderId: number) {
  const products = await prisma.jobOrderProduct.findMany({
    where: { JobOrderId: jobOrderId },
    select: { ProductId: true, Qty: true },
  });

  const usage = new Map<number, number>();
  for (const product of products) {
    addToMap(usage, product.ProductId, product.Qty);
  }

  return usage;
}

async function isInventoryAffectingStatus(jobStatusId: number) {
  if (jobStatusId <= 0) return true;

  const status = await prisma.jobStatus.findUnique({
    where: { Id: jobStatusId },
    select: { Name: true, Description: true },
  });

  return !isCanceledStatus(status);
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
    where: {
      Id: jobStatusId,
      Name: { equals: "OPEN", mode: "insensitive" },
    },
    select: { Id: true },
  });

  return !!status;
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

function deriveIsPackage(
  packages: JobOrderPackageLine[],
  products: JobOrderProductLine[],
  services: JobOrderServiceLine[],
  fallback: boolean,
) {
  return (
    packages.some((line) => line.packageId > 0) ||
    products.some((line) => line.isPackage || !!line.packageId) ||
    services.some((line) => line.isPackage || !!line.packageId) ||
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
  return readRecordArray(body, "technicians", "Technicians")
    .map(
      (item) =>
        readInteger(item, "technicianUserId", "TechnicianUserId") ??
        readInteger(item, "userId", "UserId") ??
        0,
    )
    .filter((technicianUserId) => technicianUserId > 0)
    .map((technicianUserId) => ({ technicianUserId }));
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

function formatQuantity(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function addToMap(map: Map<number, number>, key: number, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
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
