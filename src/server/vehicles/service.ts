import type { JsonRecord } from "@/server/api/body";
import { customerSelect, mapCustomer } from "@/server/customers/service";
import { prisma } from "@/server/db/prisma";

type VehicleErrorBody =
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

type VehicleMakeRow = {
  Id: number;
  Name: string;
  Description: string | null;
  RegionParameterId: number;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
};

type VehicleModelRow = {
  Id: number;
  Name: string;
  Description: string | null;
  BodyParameterId: number;
  ClassificationParameterId: number;
  VehicleMakeId: number;
  VehicleMake: VehicleMakeRow | null;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
};

type VehicleRow = {
  Id: number;
  IsChangan: boolean;
  CustomerId: number;
  Customer: Parameters<typeof mapCustomer>[0];
  PlateNo: string;
  VehicleModelId: number;
  VehicleModel: VehicleModelRow | null;
  VIN: string | null;
  YearModel: number;
  EngineNo: string | null;
  ChasisNo: string | null;
  TransmissionParameterId: number;
  OdometerParameterId: number;
  CustomerRegistrationTypeParameterId: number;
  EngineSizeParameterId: number;
  EngineTypeParameterId: number;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
};

const vehicleMakeSelect = {
  Id: true,
  Name: true,
  Description: true,
  RegionParameterId: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

const vehicleModelSelect = {
  Id: true,
  Name: true,
  Description: true,
  BodyParameterId: true,
  ClassificationParameterId: true,
  VehicleMakeId: true,
  VehicleMake: { select: vehicleMakeSelect },
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

const vehicleSelect = {
  Id: true,
  IsChangan: true,
  CustomerId: true,
  Customer: { select: customerSelect },
  PlateNo: true,
  VehicleModelId: true,
  VehicleModel: { select: vehicleModelSelect },
  VIN: true,
  YearModel: true,
  EngineNo: true,
  ChasisNo: true,
  TransmissionParameterId: true,
  OdometerParameterId: true,
  CustomerRegistrationTypeParameterId: true,
  EngineSizeParameterId: true,
  EngineTypeParameterId: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

export class VehicleServiceError extends Error {
  readonly status: number;
  readonly body: VehicleErrorBody;

  constructor(
    message: string,
    status = 400,
    body: VehicleErrorBody = { error: message },
  ) {
    super(message);
    this.name = "VehicleServiceError";
    this.status = status;
    this.body = body;
  }
}

export async function listVehicles() {
  const rows = await prisma.vehicle.findMany({
    orderBy: { Id: "asc" },
    select: vehicleSelect,
  });

  return rows.map(mapVehicle);
}

export async function listVehicleSummary() {
  const rows = await prisma.vehicle.findMany({
    orderBy: { Id: "asc" },
    select: {
      Id: true,
      IsChangan: true,
      PlateNo: true,
      CreatedDateTime: true,
      Customer: {
        select: {
          FirstName: true,
          LastName: true,
          MobileNumber: true,
        },
      },
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
  });

  return rows.map((row) => ({
    id: row.Id,
    isChangan: row.IsChangan,
    plateNo: row.PlateNo,
    plateNumber: row.PlateNo,
    vehicle: vehicleName(row.VehicleModel),
    customer: `${row.Customer.FirstName} ${row.Customer.LastName}`.trim(),
    mobileNumber: row.Customer.MobileNumber,
    createdDate: row.CreatedDateTime,
  }));
}

export async function getVehicle(id: number) {
  const row = await prisma.vehicle.findUnique({
    where: { Id: id },
    select: vehicleSelect,
  });

  return row ? mapVehicle(row) : null;
}

export async function getVehicleByPlate(plate: string) {
  const normalizedPlate = plate.trim();

  if (!normalizedPlate) {
    return null;
  }

  const row = await prisma.vehicle.findFirst({
    where: {
      PlateNo: {
        equals: normalizedPlate,
        mode: "insensitive",
      },
    },
    orderBy: { Id: "asc" },
    select: vehicleSelect,
  });

  return row ? mapVehicle(row) : null;
}

export async function getVehiclesByCustomer(customerId: number) {
  const rows = await prisma.vehicle.findMany({
    where: { CustomerId: customerId },
    orderBy: { Id: "asc" },
    select: vehicleSelect,
  });

  return rows.map(mapVehicle);
}

export async function createVehicle(body: JsonRecord, actorUserId: number) {
  const data = await createVehicleData(body, actorUserId);

  try {
    const row = await prisma.vehicle.create({
      data,
      select: vehicleSelect,
    });

    return mapVehicle(row);
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function updateVehicle(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const data = await updateVehicleData(body, actorUserId);

  try {
    await prisma.vehicle.update({
      where: { Id: id },
      data,
    });
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function deleteVehicle(id: number) {
  try {
    await prisma.vehicle.delete({ where: { Id: id } });
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export function mapVehicle(row: VehicleRow) {
  const model = row.VehicleModel ? mapVehicleModel(row.VehicleModel) : null;
  const vehicle = vehicleName(row.VehicleModel);

  return {
    id: row.Id,
    isChangan: row.IsChangan,
    customerId: row.CustomerId,
    customer: mapCustomer(row.Customer),
    plateNumber: row.PlateNo,
    plateNo: row.PlateNo,
    vehicleModelId: row.VehicleModelId,
    vehicleModel: model,
    vehicle,
    vin: row.VIN,
    year: row.YearModel,
    engineNo: row.EngineNo,
    chasisNo: row.ChasisNo,
    transmissionParameterId: row.TransmissionParameterId,
    odometerParameterId: row.OdometerParameterId,
    customerRegistrationTypeParameterId:
      row.CustomerRegistrationTypeParameterId,
    engineSizeParameterId: row.EngineSizeParameterId,
    engineTypeParameterId: row.EngineTypeParameterId,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapVehicleModel(row: VehicleModelRow) {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
    bodyParameterId: row.BodyParameterId,
    classificationParameterId: row.ClassificationParameterId,
    vehicleMakeId: row.VehicleMakeId,
    vehicleMake: row.VehicleMake ? mapVehicleMake(row.VehicleMake) : null,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapVehicleMake(row: VehicleMakeRow) {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
    regionParameterId: row.RegionParameterId,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

async function createVehicleData(body: JsonRecord, actorUserId: number) {
  const customerId = requiredPositiveInteger(
    body,
    "CustomerId is required.",
    "customerId",
    "CustomerId",
  );
  const vehicleModelId = requiredPositiveInteger(
    body,
    "VehicleModelId is required.",
    "vehicleModelId",
    "VehicleModelId",
    "modelId",
  );
  const transmissionParameterId = requiredPositiveInteger(
    body,
    "TransmissionParameterId is required.",
    "transmissionParameterId",
    "TransmissionParameterId",
  );
  const odometerParameterId = requiredPositiveInteger(
    body,
    "OdometerParameterId is required.",
    "odometerParameterId",
    "OdometerParameterId",
  );
  const customerRegistrationTypeParameterId = requiredPositiveInteger(
    body,
    "CustomerRegistrationTypeParameterId is required.",
    "customerRegistrationTypeParameterId",
    "CustomerRegistrationTypeParameterId",
    "registrationTypeParameterId",
  );
  const engineSizeParameterId = requiredPositiveInteger(
    body,
    "EngineSizeParameterId is required.",
    "engineSizeParameterId",
    "EngineSizeParameterId",
  );
  const engineTypeParameterId = requiredPositiveInteger(
    body,
    "EngineTypeParameterId is required.",
    "engineTypeParameterId",
    "EngineTypeParameterId",
  );

  await assertExists(prisma.customer, customerId, "CustomerId does not exist.");
  await assertExists(
    prisma.vehicleModel,
    vehicleModelId,
    "VehicleModelId does not exist.",
  );
  await assertParameterExists(
    transmissionParameterId,
    "TransmissionParameterId does not exist.",
  );
  await assertParameterExists(odometerParameterId, "OdometerParameterId does not exist.");
  await assertParameterExists(
    customerRegistrationTypeParameterId,
    "CustomerRegistrationTypeParameterId does not exist.",
  );
  await assertParameterExists(
    engineSizeParameterId,
    "EngineSizeParameterId does not exist.",
  );
  await assertParameterExists(
    engineTypeParameterId,
    "EngineTypeParameterId does not exist.",
  );

  return {
    IsChangan: readBoolean(body, "isChangan", "IsChangan") ?? false,
    CustomerId: customerId,
    PlateNo:
      readString(body, "plateNumber", "PlateNumber", "plateNo", "PlateNo", "plate") ??
      "",
    VehicleModelId: vehicleModelId,
    VIN: readString(body, "vin", "VIN"),
    YearModel: readInteger(body, "year", "Year", "yearModel", "YearModel") ?? 0,
    EngineNo: readString(body, "engineNo", "EngineNo"),
    ChasisNo: readString(body, "chasisNo", "ChasisNo", "chassisNo", "ChassisNo"),
    TransmissionParameterId: transmissionParameterId,
    OdometerParameterId: odometerParameterId,
    CustomerRegistrationTypeParameterId: customerRegistrationTypeParameterId,
    EngineSizeParameterId: engineSizeParameterId,
    EngineTypeParameterId: engineTypeParameterId,
    ...createAudit(body, actorUserId),
  };
}

async function updateVehicleData(body: JsonRecord, actorUserId: number) {
  const data: Record<string, unknown> = {
    UpdatedById: readPositiveInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };

  await setForeignKeyIfPresent(
    data,
    "CustomerId",
    body,
    prisma.customer,
    "CustomerId does not exist.",
    "customerId",
    "CustomerId",
  );
  await setForeignKeyIfPresent(
    data,
    "VehicleModelId",
    body,
    prisma.vehicleModel,
    "VehicleModelId does not exist.",
    "vehicleModelId",
    "VehicleModelId",
    "modelId",
  );
  await setParameterIfPresent(
    data,
    "TransmissionParameterId",
    body,
    "TransmissionParameterId does not exist.",
    "transmissionParameterId",
    "TransmissionParameterId",
  );
  await setParameterIfPresent(
    data,
    "OdometerParameterId",
    body,
    "OdometerParameterId does not exist.",
    "odometerParameterId",
    "OdometerParameterId",
  );
  await setParameterIfPresent(
    data,
    "CustomerRegistrationTypeParameterId",
    body,
    "CustomerRegistrationTypeParameterId does not exist.",
    "customerRegistrationTypeParameterId",
    "CustomerRegistrationTypeParameterId",
    "registrationTypeParameterId",
  );
  await setParameterIfPresent(
    data,
    "EngineSizeParameterId",
    body,
    "EngineSizeParameterId does not exist.",
    "engineSizeParameterId",
    "EngineSizeParameterId",
  );
  await setParameterIfPresent(
    data,
    "EngineTypeParameterId",
    body,
    "EngineTypeParameterId does not exist.",
    "engineTypeParameterId",
    "EngineTypeParameterId",
  );

  setIfPresent(data, "IsChangan", body, readBoolean, "isChangan", "IsChangan");
  setIfPresent(
    data,
    "PlateNo",
    body,
    readStringOrEmpty,
    "plateNumber",
    "PlateNumber",
    "plateNo",
    "PlateNo",
    "plate",
  );
  setIfPresent(data, "VIN", body, readString, "vin", "VIN");
  setIfPresent(
    data,
    "YearModel",
    body,
    readIntegerOrZero,
    "year",
    "Year",
    "yearModel",
    "YearModel",
  );
  setIfPresent(data, "EngineNo", body, readString, "engineNo", "EngineNo");
  setIfPresent(
    data,
    "ChasisNo",
    body,
    readString,
    "chasisNo",
    "ChasisNo",
    "chassisNo",
    "ChassisNo",
  );

  return data;
}

async function setForeignKeyIfPresent(
  data: Record<string, unknown>,
  targetKey: string,
  body: JsonRecord,
  delegate: UniqueDelegate,
  missingMessage: string,
  ...keys: string[]
) {
  if (!hasField(body, ...keys)) {
    return;
  }

  const id = requiredPositiveInteger(body, `${targetKey} is required.`, ...keys);
  await assertExists(delegate, id, missingMessage);
  data[targetKey] = id;
}

async function setParameterIfPresent(
  data: Record<string, unknown>,
  targetKey: string,
  body: JsonRecord,
  missingMessage: string,
  ...keys: string[]
) {
  if (!hasField(body, ...keys)) {
    return;
  }

  const id = requiredPositiveInteger(body, `${targetKey} is required.`, ...keys);
  await assertParameterExists(id, missingMessage);
  data[targetKey] = id;
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

async function assertParameterExists(id: number, message: string) {
  await assertExists(prisma.parameter, id, message);
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

  if (!exists) {
    throw new VehicleServiceError(message);
  }
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

function vehicleName(
  vehicleModel: null | {
    Name: string | null;
    VehicleMake: null | {
      Name: string | null;
    };
  },
) {
  return [
    vehicleModel?.VehicleMake?.Name ?? "",
    vehicleModel?.Name ?? "",
  ].filter(Boolean).join(" ");
}

function requiredPositiveInteger(
  body: JsonRecord,
  message: string,
  ...keys: string[]
) {
  const value = readPositiveInteger(body, ...keys);

  if (!value) {
    throw new VehicleServiceError(message);
  }

  return value;
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

    if (Number.isInteger(numberValue) && numberValue >= 0) {
      return numberValue;
    }
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

function readBoolean(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
  }

  return null;
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

function normalizePrismaError(error: unknown): VehicleServiceError {
  if (error instanceof VehicleServiceError) {
    return error;
  }

  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new VehicleServiceError("Record not found.", 404, {});
    }

    if (error.code === "P2003") {
      return new VehicleServiceError(
        "Cannot delete this vehicle because it is already used by other records.",
        409,
        "Cannot delete this vehicle because it is already used by other records.",
      );
    }
  }

  return new VehicleServiceError("An unexpected error occurred.", 500);
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
