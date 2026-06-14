import type { JsonRecord } from "@/server/api/body";
import { getActiveInspectionTemplate } from "@/server/config/inspection-templates";
import { prisma } from "@/server/db/prisma";

const defaultInspectionReference = "V10000001";
const legacyLayoutKey = "legacy-basic-v1";

type OperationErrorBody =
  | string
  | {
      [key: string]: string | number | boolean | null;
    };

export class OperationServiceError extends Error {
  readonly status: number;
  readonly body: OperationErrorBody;

  constructor(
    message: string,
    status = 400,
    body: OperationErrorBody = { error: message },
  ) {
    super(message);
    this.name = "OperationServiceError";
    this.status = status;
    this.body = body;
  }
}

const inspectionListSelect = {
  Id: true,
  IsChangan: true,
  ReferenceNo: true,
  TransactionDate: true,
  VehicleId: true,
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

const inspectionDetailSelect = {
  Id: true,
  IsChangan: true,
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
  InspectorUserId: true,
  Odometer: true,
  VehicleFindings: true,
  InspectionDetails: true,
  Remarks: true,
  DiagnosticResult: true,
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
      MobileNumber: true,
    },
  },
  InspectionTechniciansAsInspection: {
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
  },
} as const;

export async function listInspections() {
  const rows = await prisma.inspection.findMany({
    orderBy: { Id: "asc" },
    select: inspectionListSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    clientType: row.IsChangan ? "CHANGAN" : "BOSCH",
    referenceNo: row.ReferenceNo,
    inspectionDate: row.TransactionDate,
    customerName: customerName(row.Customer),
    vehicle: vehicleName(row.Vehicle),
    plateNo: row.Vehicle?.PlateNo ?? "",
    status: row.JobStatus?.Name ?? "",
  }));
}

export async function listInspectionSummary() {
  const rows = await prisma.inspection.findMany({
    orderBy: { Id: "asc" },
    select: inspectionListSelect,
  });

  return rows.map((row) => ({
    id: row.Id,
    vehicleId: row.VehicleId,
    isChangan: row.IsChangan,
    referenceNo: row.ReferenceNo ?? "",
    transactionDate: row.TransactionDate,
    customerName: customerName(row.Customer),
    vehicle: vehicleName(row.Vehicle),
    plateNo: row.Vehicle?.PlateNo ?? "",
    status: row.JobStatus?.Name ?? "",
  }));
}

export async function getInspectionChecklistTemplate() {
  const template = await getActiveInspectionTemplate();
  if (template) return template;

  const groups = defaultChecklistGroups();
  const itemCount = groups.reduce(
    (total, group) => total + group.detailsModelList.length,
    0,
  );

  return {
    id: 0,
    name: "Default Inspection Template",
    description: "Baseline inspection checklist used for new inspection records.",
    layoutKey: legacyLayoutKey,
    revision: 1,
    isActive: true,
    groupCount: groups.length,
    itemCount,
    groups,
  };
}

export async function getNextInspectionReferenceNo() {
  const latestRef = await prisma.inspection.findFirst({
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

export async function getInspection(id: number) {
  const row = await prisma.inspection.findUnique({
    where: { Id: id },
    select: inspectionDetailSelect,
  });

  if (!row) return null;

  return {
    id: row.Id,
    isChangan: row.IsChangan,
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
    inspectorUserId: row.InspectorUserId,
    odometer: row.Odometer,
    vehicleFindings: row.VehicleFindings,
    inspectionDetails: row.InspectionDetails,
    remarks: row.Remarks,
    diagnosticResult: row.DiagnosticResult,
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
          mobileNumber: row.Customer.MobileNumber ?? "",
        }
      : null,
    technicians: row.InspectionTechniciansAsInspection.map((technician) => ({
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
  };
}

export async function createInspection(body: JsonRecord, actorUserId: number) {
  const now = new Date();
  const createdById =
    readPositiveInteger(body, "createdById", "CreatedById") ??
    (actorUserId > 0 ? actorUserId : 0);
  const updatedById =
    readPositiveInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const technicianUserIds = distinctPositiveIds(
    readIntegerArray(body, "technicianUserIds", "TechnicianUserIds"),
  );

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.inspection.create({
      data: {
        IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
        ReferenceNo: readString(body, "referenceNo", "ReferenceNo") ?? "",
        TransactionDate: requiredDate(
          body,
          "TransactionDate is required",
          "transactionDate",
          "TransactionDate",
        ),
        ExpirationDate: readDate(body, "expirationDate", "ExpirationDate"),
        JobStatusId: requiredPositiveInteger(
          body,
          "JobStatusId is required",
          "jobStatusId",
          "JobStatusId",
        ),
        CustomerId: requiredPositiveInteger(
          body,
          "CustomerId is required",
          "customerId",
          "CustomerId",
        ),
        VehicleId: requiredPositiveInteger(
          body,
          "VehicleId is required",
          "vehicleId",
          "VehicleId",
        ),
        AdvisorUserId: requiredPositiveInteger(
          body,
          "AdvisorUserId is required",
          "advisorUserId",
          "AdvisorUserId",
        ),
        EstimatorUserId: requiredPositiveInteger(
          body,
          "EstimatorUserId is required",
          "estimatorUserId",
          "EstimatorUserId",
        ),
        ApproverUserId:
          readPositiveInteger(body, "approverUserId", "ApproverUserId") ??
          readPositiveInteger(body, "advisorUserId", "AdvisorUserId") ??
          createdById,
        ServiceGroupId: requiredPositiveInteger(
          body,
          "ServiceGroupId is required",
          "serviceGroupId",
          "ServiceGroupId",
        ),
        InspectorUserId: requiredPositiveInteger(
          body,
          "InspectorUserId is required",
          "inspectorUserId",
          "InspectorUserId",
        ),
        Odometer: readInteger(body, "odometer", "Odometer"),
        VehicleFindings: readString(body, "vehicleFindings", "VehicleFindings") ?? "",
        InspectionDetails:
          readString(body, "inspectionDetails", "InspectionDetails") ?? "",
        Remarks: readString(body, "remarks", "Remarks") ?? "",
        DiagnosticResult:
          readString(body, "diagnosticResult", "DiagnosticResult") ?? "",
        CreatedById: createdById,
        CreatedDateTime: now,
        UpdatedById: updatedById,
        UpdatedDateTime: now,
      },
      select: {
        Id: true,
        IsChangan: true,
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
        InspectorUserId: true,
        Odometer: true,
        VehicleFindings: true,
        InspectionDetails: true,
        Remarks: true,
        DiagnosticResult: true,
        CreatedById: true,
        CreatedDateTime: true,
        UpdatedById: true,
        UpdatedDateTime: true,
      },
    });

    if (technicianUserIds.length > 0) {
      await tx.inspectionTechnician.createMany({
        data: technicianUserIds.map((technicianUserId) => ({
          InspectionId: row.Id,
          TechnicianUserId: technicianUserId,
          CreatedById: createdById,
          CreatedDateTime: now,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        })),
      });
    }

    return row;
  }).catch((error) => {
    throw normalizePrismaError(error, "inspection");
  });

  return {
    id: created.Id,
    isChangan: created.IsChangan,
    referenceNo: created.ReferenceNo,
    transactionDate: created.TransactionDate,
    expirationDate: created.ExpirationDate,
    jobStatusId: created.JobStatusId,
    customerId: created.CustomerId,
    vehicleId: created.VehicleId,
    advisorUserId: created.AdvisorUserId,
    estimatorUserId: created.EstimatorUserId,
    approverUserId: created.ApproverUserId,
    serviceGroupId: created.ServiceGroupId,
    inspectorUserId: created.InspectorUserId,
    odometer: created.Odometer,
    vehicleFindings: created.VehicleFindings,
    inspectionDetails: created.InspectionDetails,
    remarks: created.Remarks,
    diagnosticResult: created.DiagnosticResult,
    createdById: created.CreatedById,
    createdDateTime: created.CreatedDateTime,
    updatedById: created.UpdatedById,
    updatedDateTime: created.UpdatedDateTime,
    technicianUserIds,
  };
}

export async function updateInspection(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const existing = await prisma.inspection.findUnique({
    where: { Id: id },
    select: { Id: true, JobStatusId: true },
  });

  if (!existing) return false;

  const nextJobStatusId = readPositiveInteger(body, "jobStatusId", "JobStatusId");
  if (nextJobStatusId) {
    await rejectReopenTransition(existing.JobStatusId, nextJobStatusId);
  }

  const data: Record<string, unknown> = {
    UpdatedDateTime: new Date(),
    UpdatedById:
      readPositiveInteger(body, "updatedById", "UpdatedById") ??
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
  setIfProvided(
    data,
    "ExpirationDate",
    body,
    readDate,
    "expirationDate",
    "ExpirationDate",
  );
  setIfProvided(data, "JobStatusId", body, readPositiveInteger, "jobStatusId", "JobStatusId");
  setIfProvided(data, "CustomerId", body, readPositiveInteger, "customerId", "CustomerId");
  setIfProvided(data, "VehicleId", body, readPositiveInteger, "vehicleId", "VehicleId");
  setIfProvided(
    data,
    "AdvisorUserId",
    body,
    readPositiveInteger,
    "advisorUserId",
    "AdvisorUserId",
  );
  setIfProvided(
    data,
    "EstimatorUserId",
    body,
    readPositiveInteger,
    "estimatorUserId",
    "EstimatorUserId",
  );
  setIfProvided(
    data,
    "ApproverUserId",
    body,
    readPositiveInteger,
    "approverUserId",
    "ApproverUserId",
  );
  setIfProvided(
    data,
    "ServiceGroupId",
    body,
    readPositiveInteger,
    "serviceGroupId",
    "ServiceGroupId",
  );
  setIfProvided(
    data,
    "InspectorUserId",
    body,
    readPositiveInteger,
    "inspectorUserId",
    "InspectorUserId",
  );
  setIfProvided(data, "Odometer", body, readInteger, "odometer", "Odometer");
  setIfProvided(
    data,
    "VehicleFindings",
    body,
    readString,
    "vehicleFindings",
    "VehicleFindings",
  );
  setIfProvided(
    data,
    "InspectionDetails",
    body,
    readString,
    "inspectionDetails",
    "InspectionDetails",
  );
  setIfProvided(data, "Remarks", body, readString, "remarks", "Remarks");
  setIfProvided(
    data,
    "DiagnosticResult",
    body,
    readString,
    "diagnosticResult",
    "DiagnosticResult",
  );

  const technicianUserIds = hasField(
    body,
    "technicianUserIds",
    "TechnicianUserIds",
  )
    ? distinctPositiveIds(readIntegerArray(body, "technicianUserIds", "TechnicianUserIds"))
    : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.inspection.update({
        where: { Id: id },
        data,
      });

      if (technicianUserIds) {
        const now = new Date();
        const updaterId =
          readPositiveInteger(body, "updatedById", "UpdatedById") ??
          (actorUserId > 0 ? actorUserId : 0);

        await tx.inspectionTechnician.deleteMany({
          where: { InspectionId: id },
        });

        if (technicianUserIds.length > 0) {
          await tx.inspectionTechnician.createMany({
            data: technicianUserIds.map((technicianUserId) => ({
              InspectionId: id,
              TechnicianUserId: technicianUserId,
              CreatedById: updaterId,
              CreatedDateTime: now,
              UpdatedById: updaterId,
              UpdatedDateTime: now,
            })),
          });
        }
      }
    });
  } catch (error) {
    throw normalizePrismaError(error, "inspection");
  }

  return true;
}

export async function deleteInspection(id: number, actorUserId: number) {
  const existing = await prisma.inspection.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!existing) return null;

  const deletedStatusId = await getOrCreateDeletedJobStatusId(actorUserId);
  await prisma.inspection.update({
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
  if (!latestRef) return defaultInspectionReference;

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

function defaultChecklistGroups() {
  return [
    {
      group: "Lights",
      sequence: 1,
      detailsModelList: [
        checklistItem(1, "Head Lights"),
        checklistItem(2, "Signal Lights"),
        checklistItem(3, "Tail Lights"),
        checklistItem(4, "Fog Lights"),
        checklistItem(5, "Wipers"),
        checklistItem(6, "Aircon"),
      ],
    },
    {
      group: "Fluids",
      sequence: 2,
      detailsModelList: [
        checklistItem(1, "ATF"),
        checklistItem(2, "Brake Fluid"),
        checklistItem(3, "Clutch Fluid"),
        checklistItem(4, "P/STR Fluid"),
        checklistItem(5, "Coolant"),
      ],
    },
    {
      group: "PMS",
      sequence: 3,
      detailsModelList: [
        checklistItem(1, "Engine Oil"),
        checklistItem(2, "Oil Filter"),
        checklistItem(3, "Spark Plugs"),
        checklistItem(4, "Air Filter"),
        checklistItem(5, "Fuel Filter"),
        checklistItem(6, "Cabin Filter"),
      ],
    },
  ];
}

function checklistItem(id: number, name: string) {
  return {
    id,
    name,
    isRed: false,
    isAmber: false,
    isGreen: false,
    remarks: "",
  };
}

async function rejectReopenTransition(
  currentJobStatusId: number | null,
  requestedJobStatusId: number,
) {
  if (requestedJobStatusId <= 0) return;
  if (!(await isOpenJobStatus(requestedJobStatusId))) return;
  if (currentJobStatusId && currentJobStatusId > 0) {
    if (!(await isOpenJobStatus(currentJobStatusId))) {
      throw new OperationServiceError(
        "Re-opening operation records is no longer supported.",
      );
    }
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

function requiredDate(body: JsonRecord, message: string, ...keys: string[]) {
  const value = readDate(body, ...keys);
  if (!value) throw new OperationServiceError(message);
  return value;
}

function requiredPositiveInteger(
  body: JsonRecord,
  message: string,
  ...keys: string[]
) {
  const value = readPositiveInteger(body, ...keys);
  if (!value) throw new OperationServiceError(message);
  return value;
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

function distinctPositiveIds(values: number[]) {
  return values
    .filter((value) => value > 0)
    .filter((value, index, source) => source.indexOf(value) === index);
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
