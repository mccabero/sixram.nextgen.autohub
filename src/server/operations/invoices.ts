import type { JsonRecord } from "@/server/api/body";
import { OperationServiceError } from "@/server/operations/inspections";
import { prisma } from "@/server/db/prisma";

const defaultInvoiceReference = "INV0000001";

const invoiceListSelect = {
  Id: true,
  IsChangan: true,
  IsPackage: true,
  InvoiceNo: true,
  InvoiceDate: true,
  DueDate: true,
  JobOrderId: true,
  JobStatusId: true,
  CustomerId: true,
  CustomerPO: true,
  AdvisorUserId: true,
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
} as const;

const userSummarySelect = {
  Id: true,
  Firstname: true,
  LastName: true,
  MobileNumber: true,
  Role: {
    select: {
      Name: true,
    },
  },
} as const;

const invoiceDetailSelect = {
  Id: true,
  IsChangan: true,
  IsPackage: true,
  InvoiceNo: true,
  InvoiceDate: true,
  DueDate: true,
  JobOrderId: true,
  JobStatusId: true,
  CustomerId: true,
  CustomerPO: true,
  AdvisorUserId: true,
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
  Customer: {
    select: {
      Id: true,
      FirstName: true,
      LastName: true,
      CompanyName: true,
      HomeAddress: true,
      CompanyAddress: true,
      MobileNumber: true,
      CompanyNo: true,
    },
  },
  AdvisorUser: {
    select: userSummarySelect,
  },
  JobOrder: {
    select: {
      Id: true,
      ReferenceNo: true,
      EstimateId: true,
      EstimatorUserId: true,
      ApproverUserId: true,
      ServiceGroupId: true,
      Odometer: true,
      NextOdometerReminder: true,
      VehicleId: true,
      Estimate: {
        select: {
          EstimatedDays: true,
        },
      },
      EstimatorUser: {
        select: userSummarySelect,
      },
      ApproverUser: {
        select: userSummarySelect,
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
    },
  },
} as const;

type DateRange = {
  startDate: Date;
  endDate: Date;
};

export async function listInvoices() {
  const rows = await prisma.invoice.findMany({
    orderBy: { Id: "asc" },
    select: invoiceListSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    isPackage: row.IsPackage,
    invoiceNo: row.InvoiceNo ?? "",
    invoiceDate: row.InvoiceDate,
    dueDate: row.DueDate,
    jobOrderId: row.JobOrderId,
    jobStatusId: row.JobStatusId,
    customerId: row.CustomerId,
    customerPO: row.CustomerPO,
    advisorUserId: row.AdvisorUserId,
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
  }));
}

export async function getNextInvoiceReferenceNo() {
  const latestRef = await prisma.invoice.findFirst({
    where: {
      InvoiceNo: {
        not: "",
      },
    },
    orderBy: { Id: "desc" },
    select: { InvoiceNo: true },
  });

  const invoiceNo = nextReferenceValue(latestRef?.InvoiceNo ?? "");

  return {
    invoiceNo,
    referenceNo: invoiceNo,
  };
}

export async function listInvoiceSummary() {
  const rows = await prisma.invoice.findMany({
    orderBy: [{ CreatedDateTime: "desc" }, { Id: "desc" }],
    select: {
      Id: true,
      JobOrderId: true,
      CustomerId: true,
      IsChangan: true,
      CreatedDateTime: true,
      InvoiceNo: true,
      InvoiceDate: true,
      DueDate: true,
      VAT12: true,
      TotalAmount: true,
      IsPackage: true,
      Customer: {
        select: {
          FirstName: true,
          LastName: true,
        },
      },
      JobOrder: {
        select: {
          ReferenceNo: true,
        },
      },
      JobStatus: {
        select: {
          Name: true,
        },
      },
    },
  });

  const invoiceIds = rows.map((row) => row.Id);
  const jobOrderIds = distinct(rows.map((row) => row.JobOrderId));
  const [depositTotals, paidTotals] = await Promise.all([
    getDepositTotalsByJobOrder(jobOrderIds),
    getPaidTotalsByInvoice(invoiceIds),
  ]);

  return rows.map((row) => {
    const depositAmount = depositTotals.get(row.JobOrderId) ?? 0;
    const paidAmount = paidTotals.get(row.Id) ?? 0;
    const balanceDue = Math.max(
      0,
      numberFromDecimal(row.TotalAmount) - depositAmount - paidAmount,
    );

    return {
      id: row.Id,
      jobOrderId: row.JobOrderId,
      customerId: row.CustomerId,
      isChangan: row.IsChangan,
      createdDateTime: row.CreatedDateTime,
      invoiceNo: row.InvoiceNo ?? "",
      invoiceDate: row.InvoiceDate,
      dueDate: row.DueDate,
      customer: customerName(row.Customer),
      jobOrder: row.JobOrder?.ReferenceNo ?? "",
      vat12: row.VAT12,
      totalAmount: row.TotalAmount,
      depositAmount,
      paidAmount,
      balanceDue,
      isPackage: row.IsPackage,
      status: row.JobStatus?.Name ?? "",
    };
  });
}

export async function listAccountsReceivable(searchParams: URLSearchParams) {
  const range = parseAccountsReceivableDateRange(searchParams);
  const endExclusive = addDays(range.endDate, 1);

  const invoices = (
    await prisma.invoice.findMany({
      select: {
        Id: true,
        JobOrderId: true,
        CustomerId: true,
        IsChangan: true,
        InvoiceNo: true,
        InvoiceDate: true,
        DueDate: true,
        CreatedDateTime: true,
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
        JobOrder: {
          select: {
            ReferenceNo: true,
          },
        },
        JobStatus: {
          select: {
            Name: true,
          },
        },
      },
    })
  )
    .filter((invoice) => {
      const date = invoice.InvoiceDate ?? invoice.CreatedDateTime;
      return date >= range.startDate && date < endExclusive;
    })
    .filter((invoice) => !isInactiveStatusName(invoice.JobStatus?.Name ?? ""))
    .sort((left, right) => {
      const leftDate = left.InvoiceDate ?? left.CreatedDateTime;
      const rightDate = right.InvoiceDate ?? right.CreatedDateTime;
      const dateCompare = leftDate.getTime() - rightDate.getTime();
      if (dateCompare !== 0) return dateCompare;
      return (left.InvoiceNo ?? "").localeCompare(right.InvoiceNo ?? "");
    });

  const invoiceIds = invoices.map((row) => row.Id);
  const jobOrderIds = distinct(invoices.map((row) => row.JobOrderId));
  const [depositTotals, paidTotals] = await Promise.all([
    getDepositTotalsByJobOrder(jobOrderIds),
    getPaidTotalsByInvoice(invoiceIds),
  ]);
  const today = startOfDay(new Date());

  return invoices
    .map((invoice) => {
      const depositAmount = depositTotals.get(invoice.JobOrderId) ?? 0;
      const paidAmount = paidTotals.get(invoice.Id) ?? 0;
      const invoiceAmount = roundCurrency(numberFromDecimal(invoice.TotalAmount));
      const balanceDue = roundCurrency(
        Math.max(0, invoiceAmount - depositAmount - paidAmount),
      );

      if (balanceDue <= 0.0001) return null;

      const invoiceDate = startOfDay(invoice.InvoiceDate ?? invoice.CreatedDateTime);
      const dueDate = invoice.DueDate ? startOfDay(invoice.DueDate) : null;
      const daysOutstanding = Math.max(0, daysBetween(invoiceDate, today));
      const daysOverdue = dueDate ? Math.max(0, daysBetween(dueDate, today)) : 0;
      const customer = customerName(invoice.Customer);
      const companyName = invoice.Customer?.CompanyName?.trim() ?? "";

      return {
        invoiceId: invoice.Id,
        customerId: invoice.CustomerId,
        isChangan: invoice.IsChangan,
        clientType: invoice.IsChangan ? "CHANGAN" : "BOSCH",
        invoiceDate,
        dueDate,
        customerName: customer || companyName,
        invoiceNo: invoice.InvoiceNo ?? "",
        jobOrderNo: invoice.JobOrder?.ReferenceNo ?? "",
        invoiceAmount,
        discountAmount: roundCurrency(
          numberFromDecimal(invoice.LaborDiscount) +
            numberFromDecimal(invoice.ProductDiscount) +
            numberFromDecimal(invoice.AdditionalDiscount),
        ),
        depositAmount: roundCurrency(depositAmount),
        paidAmount: roundCurrency(paidAmount),
        balanceDue,
        daysOutstanding,
        daysOverdue,
        status: daysOverdue > 0 ? "OVERDUE" : "CURRENT",
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => {
      const overdueCompare = right.daysOverdue - left.daysOverdue;
      if (overdueCompare !== 0) return overdueCompare;

      const leftSortDate = left.dueDate ?? left.invoiceDate;
      const rightSortDate = right.dueDate ?? right.invoiceDate;
      const dateCompare = leftSortDate.getTime() - rightSortDate.getTime();
      if (dateCompare !== 0) return dateCompare;

      return left.customerName.localeCompare(right.customerName);
    });
}

export async function getInvoice(id: number) {
  const row = await prisma.invoice.findUnique({
    where: { Id: id },
    select: invoiceDetailSelect,
  });

  if (!row) return null;

  const [jobOrderServices, jobOrderProducts, invoicePackages, jobOrderTechs] =
    await Promise.all([
      row.JobOrderId > 0 ? getJobOrderServices(row.JobOrderId) : [],
      row.JobOrderId > 0 ? getJobOrderProducts(row.JobOrderId) : [],
      getInvoicePackages(id),
      row.JobOrderId > 0 ? getJobOrderTechnicians(row.JobOrderId) : [],
    ]);

  let services:
    | Awaited<ReturnType<typeof getJobOrderServices>>
    | Awaited<ReturnType<typeof getEstimateServices>> = jobOrderServices;
  let products:
    | Awaited<ReturnType<typeof getJobOrderProducts>>
    | Awaited<ReturnType<typeof getEstimateProducts>> = jobOrderProducts;
  let packages:
    | Awaited<ReturnType<typeof getInvoicePackages>>
    | Awaited<ReturnType<typeof getEstimatePackages>>
    | Awaited<ReturnType<typeof getJobOrderPackages>> = invoicePackages;
  const technicians = jobOrderTechs;
  const estimateId = row.JobOrder?.EstimateId ?? 0;

  if (estimateId > 0) {
    const fallbackResults = await Promise.all([
      services.length === 0
        ? getEstimateServices(estimateId, row.JobOrderId)
        : Promise.resolve(services),
      products.length === 0
        ? getEstimateProducts(estimateId, row.JobOrderId)
        : Promise.resolve(products),
      packages.length === 0
        ? getEstimatePackages(estimateId)
        : Promise.resolve(packages),
    ]);

    services = fallbackResults[0];
    products = fallbackResults[1];
    packages = fallbackResults[2];
  }

  if (packages.length === 0 && row.JobOrderId > 0) {
    packages = await getJobOrderPackages(row.JobOrderId);
  }

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    isPackage: row.IsPackage,
    invoiceNo: row.InvoiceNo,
    invoiceDate: row.InvoiceDate,
    dueDate: row.DueDate,
    jobOrderId: row.JobOrderId,
    jobStatusId: row.JobStatusId,
    customerId: row.CustomerId,
    customerPO: row.CustomerPO,
    advisorUserId: row.AdvisorUserId,
    estimatorUserId: row.JobOrder?.EstimatorUserId ?? null,
    approverUserId: row.JobOrder?.ApproverUserId ?? null,
    serviceGroupId: row.JobOrder?.ServiceGroupId ?? null,
    estimatedDays: row.JobOrder?.Estimate?.EstimatedDays ?? null,
    odometer: row.JobOrder?.Odometer ?? null,
    nextServiceReminderDays: row.JobOrder?.NextOdometerReminder ?? null,
    vehicleId: row.JobOrder?.VehicleId ?? null,
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
          code: row.JobStatus.Name ?? "",
          description: row.JobStatus.Description ?? "",
        }
      : null,
    customer: row.Customer
      ? {
          id: row.Customer.Id,
          firstName: row.Customer.FirstName ?? "",
          lastName: row.Customer.LastName ?? "",
          companyName: row.Customer.CompanyName ?? "",
          homeAddress: row.Customer.HomeAddress ?? "",
          companyAddress: row.Customer.CompanyAddress ?? "",
          mobileNumber: row.Customer.MobileNumber ?? "",
          companyNo: row.Customer.CompanyNo ?? "",
        }
      : null,
    advisorUser: mapUser(row.AdvisorUser),
    estimatorUser: mapUser(row.JobOrder?.EstimatorUser ?? null),
    approverUser: mapUser(row.JobOrder?.ApproverUser ?? null),
    serviceGroup: row.JobOrder?.ServiceGroup
      ? {
          id: row.JobOrder.ServiceGroup.Id,
          name: row.JobOrder.ServiceGroup.Name ?? "",
          description: row.JobOrder.ServiceGroup.Description ?? "",
        }
      : null,
    vehicle: row.JobOrder?.Vehicle
      ? {
          id: row.JobOrder.Vehicle.Id,
          plateNo: row.JobOrder.Vehicle.PlateNo ?? "",
          vehicleModelId: row.JobOrder.Vehicle.VehicleModelId,
          vehicleModel: row.JobOrder.Vehicle.VehicleModel
            ? {
                id: row.JobOrder.Vehicle.VehicleModel.Id,
                name: row.JobOrder.Vehicle.VehicleModel.Name ?? "",
                description: row.JobOrder.Vehicle.VehicleModel.Description ?? "",
                vehicleMake: row.JobOrder.Vehicle.VehicleModel.VehicleMake
                  ? {
                      id: row.JobOrder.Vehicle.VehicleModel.VehicleMake.Id,
                      name:
                        row.JobOrder.Vehicle.VehicleModel.VehicleMake.Name ?? "",
                      description:
                        row.JobOrder.Vehicle.VehicleModel.VehicleMake
                          .Description ?? "",
                    }
                  : null,
              }
            : null,
        }
      : null,
    jobOrder: row.JobOrder
      ? {
          id: row.JobOrder.Id,
          referenceNo: row.JobOrder.ReferenceNo ?? "",
          estimateId: row.JobOrder.EstimateId,
        }
      : null,
    services,
    products,
    packages,
    technicians,
  };
}

export async function createInvoice(body: JsonRecord, actorUserId: number) {
  const jobOrderId = readInteger(body, "jobOrderId", "JobOrderId") ?? 0;

  if (jobOrderId > 0) {
    const existingInvoice = await prisma.invoice.findFirst({
      where: { JobOrderId: jobOrderId },
      orderBy: { Id: "desc" },
      select: { Id: true, InvoiceNo: true },
    });

    if (existingInvoice) {
      throw new OperationServiceError(
        `Job order is already linked to invoice ${existingInvoice.InvoiceNo ?? ""}.`,
        409,
        {
          message: `Job order is already linked to invoice ${existingInvoice.InvoiceNo ?? ""}.`,
          id: existingInvoice.Id,
          invoiceId: existingInvoice.Id,
          invoiceNo: existingInvoice.InvoiceNo ?? "",
        },
      );
    }
  }

  const createdById =
    readInteger(body, "createdById", "CreatedById") ??
    (actorUserId > 0 ? actorUserId : 0);
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const invoiceNo =
    readString(body, "invoiceNo", "InvoiceNo")?.trim() ||
    (await getNextInvoiceReferenceNo()).invoiceNo;
  const now = new Date();

  try {
    const created = await prisma.invoice.create({
      data: {
        IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
        IsPackage: readBoolean(body, "isPackage", "IsPackage") ?? false,
        InvoiceNo: invoiceNo,
        InvoiceDate: readDate(body, "invoiceDate", "InvoiceDate"),
        DueDate: readDate(body, "dueDate", "DueDate"),
        JobOrderId: jobOrderId,
        JobStatusId: readInteger(body, "jobStatusId", "JobStatusId") ?? 0,
        CustomerId: readInteger(body, "customerId", "CustomerId") ?? 0,
        CustomerPO: readString(body, "customerPO", "CustomerPO") ?? "",
        AdvisorUserId: readInteger(body, "advisorUserId", "AdvisorUserId") ?? 0,
        Summary: readString(body, "summary", "Summary") ?? "",
        SubTotal: readDecimal(body, "subTotal", "SubTotal"),
        VAT12: readDecimal(body, "vat12", "VAT12"),
        LaborDiscount: readDecimal(body, "laborDiscount", "LaborDiscount"),
        ProductDiscount: readDecimal(body, "productDiscount", "ProductDiscount"),
        AdditionalDiscount: readDecimal(
          body,
          "additionalDiscount",
          "AdditionalDiscount",
        ),
        TotalAmount: readDecimal(body, "totalAmount", "TotalAmount"),
        CreatedById: createdById,
        CreatedDateTime: now,
        UpdatedById: updatedById,
        UpdatedDateTime: now,
      },
      select: { Id: true },
    });

    return { id: created.Id };
  } catch (error) {
    throw normalizePrismaError(error, "invoice");
  }
}

export async function updateInvoice(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.invoice.findUnique({
    where: { Id: id },
    select: { Id: true, JobStatusId: true, UpdatedById: true },
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
  setIfProvided(data, "IsPackage", body, readBoolean, "isPackage", "IsPackage");
  setIfProvided(data, "InvoiceNo", body, readString, "invoiceNo", "InvoiceNo");
  setIfProvided(data, "InvoiceDate", body, readDate, "invoiceDate", "InvoiceDate");
  setIfProvided(data, "DueDate", body, readDate, "dueDate", "DueDate");
  setIfProvided(data, "JobOrderId", body, readInteger, "jobOrderId", "JobOrderId");
  setIfProvided(data, "CustomerId", body, readInteger, "customerId", "CustomerId");
  setIfProvided(data, "CustomerPO", body, readString, "customerPO", "CustomerPO");
  setIfProvided(
    data,
    "AdvisorUserId",
    body,
    readInteger,
    "advisorUserId",
    "AdvisorUserId",
  );
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

  if (hasField(body, "jobStatusId", "JobStatusId")) {
    const jobStatusId = readInteger(body, "jobStatusId", "JobStatusId");

    if (jobStatusId !== null) {
      await rejectReopenTransition(existing.JobStatusId, jobStatusId);
      data.JobStatusId = jobStatusId;
    }
  }

  try {
    await prisma.invoice.update({
      where: { Id: id },
      data,
    });

    return true;
  } catch (error) {
    throw normalizePrismaError(error, "invoice");
  }
}

export async function deleteInvoice(id: number, actorUserId: number) {
  const existing = await prisma.invoice.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);

  await prisma.invoice.update({
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

export async function completeJobOrderAsInvoice(
  jobOrderId: number,
  body: JsonRecord | null,
  actorUserId: number,
) {
  const jobOrder = await prisma.jobOrder.findUnique({
    where: { Id: jobOrderId },
    select: {
      Id: true,
      IsChangan: true,
      IsPackage: true,
      InvoiceId: true,
      ExpirationDate: true,
      JobStatusId: true,
      CustomerId: true,
      CustomerPO: true,
      AdvisorUserId: true,
      Summary: true,
      SubTotal: true,
      VAT12: true,
      LaborDiscount: true,
      ProductDiscount: true,
      AdditionalDiscount: true,
      TotalAmount: true,
      UpdatedById: true,
      JobStatus: {
        select: {
          Name: true,
        },
      },
      JobOrderPackagesAsJobOrder: {
        orderBy: { Id: "asc" },
        select: {
          PackageId: true,
          IsAdditional: true,
          IncentiveSA: true,
          IncentiveTech: true,
        },
      },
      Estimate: {
        select: {
          EstimatePackagesAsEstimate: {
            orderBy: { Id: "asc" },
            select: {
              PackageId: true,
              IsAdditional: true,
              IncentiveSA: true,
              IncentiveTech: true,
            },
          },
        },
      },
    },
  });

  if (!jobOrder) return null;

  const linkedInvoiceId =
    jobOrder.InvoiceId && jobOrder.InvoiceId > 0 ? jobOrder.InvoiceId : null;
  const existingInvoiceId =
    linkedInvoiceId ??
    (
      await prisma.invoice.findFirst({
        where: { JobOrderId: jobOrderId },
        orderBy: { Id: "desc" },
        select: { Id: true },
      })
    )?.Id ??
    null;
  const completedStatusId = await findJobStatusId("COMPLETED");

  if (!completedStatusId) {
    throw new OperationServiceError(
      "The COMPLETED job status is not configured.",
    );
  }

  const openStatusId = await findJobStatusId("OPEN");

  if (!openStatusId) {
    throw new OperationServiceError("The OPEN job status is not configured.");
  }

  const statusName = jobOrder.JobStatus?.Name ?? "";

  if (statusName.toUpperCase() !== "OPEN") {
    if (statusName.toUpperCase() !== "COMPLETED" || !existingInvoiceId) {
      throw new OperationServiceError("Only OPEN job orders can be completed.");
    }
  }

  const actorId =
    readInteger(body, "updatedById", "UpdatedById") ??
    (jobOrder.UpdatedById !== 0 ? jobOrder.UpdatedById : jobOrder.AdvisorUserId) ??
    (actorUserId > 0 ? actorUserId : 0);
  const now = new Date();

  if (existingInvoiceId) {
    await prisma.jobOrder.update({
      where: { Id: jobOrder.Id },
      data: {
        JobStatusId: completedStatusId,
        InvoiceId: existingInvoiceId,
        UpdatedById: actorId,
        UpdatedDateTime: now,
      },
    });

    const existingInvoice = await prisma.invoice.findUnique({
      where: { Id: existingInvoiceId },
      select: { InvoiceNo: true },
    });

    return {
      id: existingInvoiceId,
      jobOrderId: jobOrder.Id,
      invoiceId: existingInvoiceId,
      invoiceNo: existingInvoice?.InvoiceNo ?? "",
      existingInvoice: true,
    };
  }

  const invoiceDate = readDate(body, "invoiceDate", "InvoiceDate") ?? now;
  const dueDate =
    readDate(body, "dueDate", "DueDate") ?? jobOrder.ExpirationDate ?? invoiceDate;
  const invoiceNo = (await getNextInvoiceReferenceNo()).invoiceNo;
  const packageRows = jobOrder.JobOrderPackagesAsJobOrder.length
    ? jobOrder.JobOrderPackagesAsJobOrder
    : jobOrder.Estimate?.EstimatePackagesAsEstimate ?? [];

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const row = await tx.invoice.create({
        data: {
          IsChangan: jobOrder.IsChangan,
          IsPackage: jobOrder.IsPackage || packageRows.length > 0,
          InvoiceNo: invoiceNo,
          InvoiceDate: invoiceDate,
          DueDate: dueDate,
          JobOrderId: jobOrder.Id,
          JobStatusId: openStatusId,
          CustomerId: jobOrder.CustomerId,
          CustomerPO: jobOrder.CustomerPO ?? "",
          AdvisorUserId: jobOrder.AdvisorUserId,
          Summary: jobOrder.Summary ?? "",
          SubTotal: jobOrder.SubTotal,
          VAT12: jobOrder.VAT12,
          LaborDiscount: jobOrder.LaborDiscount,
          ProductDiscount: jobOrder.ProductDiscount,
          AdditionalDiscount: jobOrder.AdditionalDiscount,
          TotalAmount: jobOrder.TotalAmount,
          CreatedById: actorId,
          CreatedDateTime: now,
          UpdatedById: actorId,
          UpdatedDateTime: now,
        },
        select: { Id: true, InvoiceNo: true },
      });

      if (packageRows.length > 0) {
        await tx.invoicePackage.createMany({
          data: packageRows.map((pkg) => ({
            InvoiceId: row.Id,
            PackageId: pkg.PackageId,
            IncentiveSA: pkg.IncentiveSA,
            IncentiveTech: pkg.IncentiveTech,
            CreatedById: actorId,
            CreatedDateTime: now,
            UpdatedById: actorId,
            UpdatedDateTime: now,
          })),
        });
      }

      await tx.jobOrder.update({
        where: { Id: jobOrder.Id },
        data: {
          JobStatusId: completedStatusId,
          InvoiceId: row.Id,
          UpdatedById: actorId,
          UpdatedDateTime: now,
        },
      });

      return row;
    });

    return {
      id: invoice.Id,
      jobOrderId: jobOrder.Id,
      invoiceId: invoice.Id,
      invoiceNo: invoice.InvoiceNo,
    };
  } catch (error) {
    throw normalizePrismaError(error, "invoice");
  }
}

async function getJobOrderServices(jobOrderId: number) {
  const rows = await prisma.jobOrderService.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsPackage: true,
      IsRequired: true,
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
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    isPackage: row.IsPackage,
    isRequired: row.IsRequired,
    packageId: row.PackageId,
    jobOrderId: row.JobOrderId,
    serviceId: row.ServiceId,
    rate: row.Rate,
    hours: row.Hours,
    amount: row.Amount,
    service: mapService(row.Service),
  }));
}

async function getJobOrderProducts(jobOrderId: number) {
  const rows = await prisma.jobOrderProduct.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: {
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
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    isPackage: row.IsPackage,
    isRequired: row.IsRequired,
    isAdditional: row.IsAdditional,
    packageId: row.PackageId,
    jobOrderId: row.JobOrderId,
    productId: row.ProductId,
    price: row.Price,
    qty: row.Qty,
    amount: row.Amount,
    incentiveSA: row.IncentiveSA,
    incentiveTech: row.IncentiveTech,
    product: mapProduct(row.Product),
  }));
}

async function getJobOrderTechnicians(jobOrderId: number) {
  const rows = await prisma.jobOrderTechnician.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      TechnicianUserId: true,
      TechnicianUser: {
        select: userSummarySelect,
      },
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    technicianUserId: row.TechnicianUserId,
    technicianUser: mapUser(row.TechnicianUser),
  }));
}

async function getInvoicePackages(invoiceId: number) {
  const rows = await prisma.invoicePackage.findMany({
    where: { InvoiceId: invoiceId },
    orderBy: { Id: "asc" },
    select: {
      PackageId: true,
      IncentiveSA: true,
      IncentiveTech: true,
      Package: {
        select: {
          Name: true,
          Code: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.PackageId,
    name: row.Package?.Name ?? "",
    code: row.Package?.Code ?? "",
    incentiveSA: row.IncentiveSA,
    incentiveTech: row.IncentiveTech,
  }));
}

async function getEstimateServices(estimateId: number, jobOrderId: number) {
  const rows = await prisma.estimateService.findMany({
    where: { EstimateId: estimateId },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsPackage: true,
      IsRequired: true,
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

  return rows.map((row) => ({
    id: row.Id,
    isPackage: row.IsPackage,
    isRequired: row.IsRequired,
    packageId: row.PackageId,
    jobOrderId,
    serviceId: row.ServiceId,
    rate: row.Rate,
    hours: row.Hours,
    amount: row.Amount,
    service: mapService(row.Service),
  }));
}

async function getEstimateProducts(estimateId: number, jobOrderId: number) {
  const rows = await prisma.estimateProduct.findMany({
    where: { EstimateId: estimateId },
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsPackage: true,
      IsRequired: true,
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

  return rows.map((row) => ({
    id: row.Id,
    isPackage: row.IsPackage,
    isRequired: row.IsRequired,
    packageId: row.PackageId,
    jobOrderId,
    productId: row.ProductId,
    price: row.Price,
    qty: row.Qty,
    amount: row.Amount,
    incentiveSA: row.IncentiveSA,
    incentiveTech: row.IncentiveTech,
    product: mapProduct(row.Product),
  }));
}

async function getEstimatePackages(estimateId: number) {
  const rows = await prisma.estimatePackage.findMany({
    where: { EstimateId: estimateId },
    orderBy: { Id: "asc" },
    select: {
      PackageId: true,
      IncentiveSA: true,
      IncentiveTech: true,
      Package: {
        select: {
          Name: true,
          Code: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.PackageId,
    name: row.Package?.Name ?? "",
    code: row.Package?.Code ?? "",
    incentiveSA: row.IncentiveSA,
    incentiveTech: row.IncentiveTech,
  }));
}

async function getJobOrderPackages(jobOrderId: number) {
  const rows = await prisma.jobOrderPackage.findMany({
    where: { JobOrderId: jobOrderId },
    orderBy: { Id: "asc" },
    select: {
      PackageId: true,
      IncentiveSA: true,
      IncentiveTech: true,
      Package: {
        select: {
          Name: true,
          Code: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.PackageId,
    name: row.Package?.Name ?? "",
    code: row.Package?.Code ?? "",
    incentiveSA: row.IncentiveSA,
    incentiveTech: row.IncentiveTech,
  }));
}

async function getDepositTotalsByJobOrder(jobOrderIds: number[]) {
  const totals = new Map<number, number>();

  if (jobOrderIds.length === 0) return totals;

  const rows = await prisma.deposit.findMany({
    where: { JobOrderId: { in: jobOrderIds } },
    select: {
      JobOrderId: true,
      DepositAmount: true,
      JobStatus: {
        select: {
          Name: true,
        },
      },
    },
  });

  for (const row of rows) {
    if (isInactiveStatusName(row.JobStatus?.Name ?? "")) continue;
    addToMap(totals, row.JobOrderId, numberFromDecimal(row.DepositAmount));
  }

  return totals;
}

async function getPaidTotalsByInvoice(invoiceIds: number[]) {
  const totals = new Map<number, number>();

  if (invoiceIds.length === 0) return totals;

  const rows = await prisma.paymentDetail.findMany({
    where: { InvoiceId: { in: invoiceIds } },
    select: {
      InvoiceId: true,
      AmountPaid: true,
      Payment: {
        select: {
          JobStatus: {
            select: {
              Name: true,
            },
          },
        },
      },
    },
  });

  for (const row of rows) {
    if (isInactiveStatusName(row.Payment.JobStatus?.Name ?? "")) continue;
    addToMap(totals, row.InvoiceId, numberFromDecimal(row.AmountPaid));
  }

  return totals;
}

function parseAccountsReceivableDateRange(
  searchParams: URLSearchParams,
): DateRange {
  const startDate =
    parseDateParam(searchParams.get("start")) ?? new Date(1900, 0, 1);
  const endDate =
    parseDateParam(searchParams.get("end")) ??
    new Date(new Date().getFullYear() + 10, new Date().getMonth(), new Date().getDate());

  if (endDate < startDate) {
    throw new OperationServiceError(
      "End date must be on or after the start date.",
      400,
      "End date must be on or after the start date.",
    );
  }

  return {
    startDate,
    endDate,
  };
}

function parseDateParam(value: string | null) {
  if (!value) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);

  if (Number.isNaN(parsed.valueOf())) {
    throw new OperationServiceError("Invalid date range.", 400, "Invalid date range.");
  }

  return startOfDay(parsed);
}

function customerName(
  customer: { FirstName: string | null; LastName: string | null } | null,
) {
  return `${customer?.FirstName ?? ""} ${customer?.LastName ?? ""}`.trim();
}

function mapUser(
  user: {
    Id: number;
    Firstname: string | null;
    LastName: string | null;
    MobileNumber?: string | null;
    Role?: { Name: string | null } | null;
  } | null,
) {
  return user
    ? {
        id: user.Id,
        firstName: user.Firstname ?? "",
        lastName: user.LastName ?? "",
        mobileNumber: user.MobileNumber ?? "",
        role: user.Role?.Name ?? "",
      }
    : null;
}

function mapService(
  service: { Id: number; Name: string | null; Code: string | null } | null,
) {
  return service
    ? {
        id: service.Id,
        name: service.Name ?? "",
        code: service.Code ?? "",
      }
    : null;
}

function mapProduct(
  product: {
    Id: number;
    Name: string | null;
    DisplayName: string | null;
    PartNo: string | null;
  } | null,
) {
  return product
    ? {
        id: product.Id,
        name: product.Name ?? "",
        displayName: product.DisplayName ?? "",
        partNo: product.PartNo ?? "",
      }
    : null;
}

function nextReferenceValue(latestRef: string) {
  if (!latestRef) return defaultInvoiceReference;

  const match = /^([A-Za-z-]*)(\d+)$/.exec(latestRef);

  if (!match) return latestRef;

  const [, prefix, numberText] = match;
  const numberValue = Number(numberText);

  if (!Number.isSafeInteger(numberValue)) return latestRef;

  return `${prefix}${String(numberValue + 1).padStart(numberText.length, "0")}`;
}

function isInactiveStatusName(name: string) {
  const normalized = name.toUpperCase();
  return (
    normalized.includes("DELETE") ||
    normalized.includes("VOID") ||
    normalized.includes("CANCEL")
  );
}

function numberFromDecimal(value: { toString: () => string } | number | null) {
  if (value === null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function distinct(values: number[]) {
  return values.filter((value, index, source) => source.indexOf(value) === index);
}

function addToMap(map: Map<number, number>, key: number, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
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

    if (value !== null) {
      data[field] = value;
    }
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
    where: {
      Id: jobStatusId,
      Name: { equals: "OPEN", mode: "insensitive" },
    },
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
