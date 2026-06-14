import { prisma } from "@/server/db/prisma";
import type { JsonRecord } from "@/server/api/body";

export type ConfigResourceKey =
  | "service-categories"
  | "service-groups"
  | "vehicle-makes"
  | "vehicle-models"
  | "product-groups"
  | "product-categories"
  | "parameter-groups"
  | "parameters"
  | "unit-of-measures"
  | "job-statuses";

type DbRecord = Record<string, unknown>;
type ConfigErrorBody =
  | string
  | {
      [key: string]: string | number | boolean | null | string[] | number[];
    };

type CrudDelegate = {
  findMany(args: DbRecord): Promise<unknown[]>;
  findUnique(args: DbRecord): Promise<unknown | null>;
  create(args: DbRecord): Promise<unknown>;
  update(args: DbRecord): Promise<unknown>;
  delete(args: DbRecord): Promise<unknown>;
};

type ConfigDefinition = {
  getDelegate: () => CrudDelegate;
  kind: "simple" | "parameter-group";
};

const simpleSelect = {
  Id: true,
  Name: true,
  Description: true,
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

const parameterGroupSelect = {
  ...simpleSelect,
  Code: true,
};

const definitions: Partial<Record<ConfigResourceKey, ConfigDefinition>> = {
  "service-categories": {
    getDelegate: () => prisma.serviceCategory as unknown as CrudDelegate,
    kind: "simple",
  },
  "service-groups": {
    getDelegate: () => prisma.serviceGroup as unknown as CrudDelegate,
    kind: "simple",
  },
  "product-groups": {
    getDelegate: () => prisma.productGroup as unknown as CrudDelegate,
    kind: "simple",
  },
  "product-categories": {
    getDelegate: () => prisma.productCategory as unknown as CrudDelegate,
    kind: "simple",
  },
  "unit-of-measures": {
    getDelegate: () => prisma.unitOfMeasure as unknown as CrudDelegate,
    kind: "simple",
  },
  "job-statuses": {
    getDelegate: () => prisma.jobStatus as unknown as CrudDelegate,
    kind: "simple",
  },
  "parameter-groups": {
    getDelegate: () => prisma.parameterGroup as unknown as CrudDelegate,
    kind: "parameter-group",
  },
};

export class ConfigServiceError extends Error {
  readonly status: number;
  readonly body: ConfigErrorBody;

  constructor(
    message: string,
    status = 400,
    body: ConfigErrorBody = { error: message },
  ) {
    super(message);
    this.name = "ConfigServiceError";
    this.status = status;
    this.body = body;
  }
}

export function isConfigResourceKey(value: string): value is ConfigResourceKey {
  return [
    "service-categories",
    "service-groups",
    "vehicle-makes",
    "vehicle-models",
    "product-groups",
    "product-categories",
    "parameter-groups",
    "parameters",
    "unit-of-measures",
    "job-statuses",
  ].includes(value);
}

export async function listConfigResource(
  resource: ConfigResourceKey,
  searchParams?: URLSearchParams,
) {
  if (resource === "vehicle-makes") {
    const rows = await prisma.vehicleMake.findMany({
      orderBy: { Id: "asc" },
      select: vehicleMakeSelect,
    });
    return rows.map(mapVehicleMake);
  }

  if (resource === "vehicle-models") {
    const rows = await prisma.vehicleModel.findMany({
      orderBy: { Id: "asc" },
      select: vehicleModelSelect,
    });
    return rows.map(mapVehicleModel);
  }

  if (resource === "parameters") {
    const parameterGroup = searchParams?.get("parameterGroup")?.trim();
    const rows = await prisma.parameter.findMany({
      where: parameterGroup
        ? {
            ParameterGroup: {
              is: {
                OR: [
                  { Name: { equals: parameterGroup, mode: "insensitive" } },
                  { Code: { equals: parameterGroup, mode: "insensitive" } },
                ],
              },
            },
          }
        : undefined,
      orderBy: [{ SortOrder: "asc" }, { Name: "asc" }, { Id: "asc" }],
      select: parameterSelect,
    });
    return rows.map(mapParameter);
  }

  const definition = getDefinition(resource);
  const rows = await definition.getDelegate().findMany({
    orderBy: { Id: "asc" },
    select: selectFor(definition),
  });

  return rows.map((row) => mapDefinitionRecord(definition, row));
}

export async function getConfigResource(resource: ConfigResourceKey, id: number) {
  if (resource === "vehicle-makes") {
    const row = await prisma.vehicleMake.findUnique({
      where: { Id: id },
      select: vehicleMakeSelect,
    });
    return row ? mapVehicleMake(row) : null;
  }

  if (resource === "vehicle-models") {
    const row = await prisma.vehicleModel.findUnique({
      where: { Id: id },
      select: vehicleModelSelect,
    });
    return row ? mapVehicleModel(row) : null;
  }

  if (resource === "parameters") {
    const row = await prisma.parameter.findUnique({
      where: { Id: id },
      select: parameterSelect,
    });
    return row ? mapParameter(row) : null;
  }

  const definition = getDefinition(resource);
  const row = await definition.getDelegate().findUnique({
    where: { Id: id },
    select: selectFor(definition),
  });

  return row ? mapDefinitionRecord(definition, row) : null;
}

export async function createConfigResource(
  resource: ConfigResourceKey,
  body: JsonRecord,
  actorUserId: number,
) {
  try {
    if (resource === "vehicle-makes") {
      return createVehicleMake(body, actorUserId);
    }

    if (resource === "vehicle-models") {
      return createVehicleModel(body, actorUserId);
    }

    if (resource === "parameters") {
      return createParameter(body, actorUserId);
    }

    const definition = getDefinition(resource);
    const row = await definition.getDelegate().create({
      data: createDataForDefinition(definition, body, actorUserId),
      select: selectFor(definition),
    });
    return mapDefinitionRecord(definition, row);
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function updateConfigResource(
  resource: ConfigResourceKey,
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  try {
    if (resource === "vehicle-makes") {
      await updateVehicleMake(id, body, actorUserId);
      return;
    }

    if (resource === "vehicle-models") {
      await updateVehicleModel(id, body, actorUserId);
      return;
    }

    if (resource === "parameters") {
      await updateParameter(id, body, actorUserId);
      return;
    }

    const definition = getDefinition(resource);
    await definition.getDelegate().update({
      where: { Id: id },
      data: updateDataForDefinition(definition, body, actorUserId),
    });
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function deleteConfigResource(resource: ConfigResourceKey, id: number) {
  try {
    const definition =
      resource === "vehicle-makes" ||
      resource === "vehicle-models" ||
      resource === "parameters"
        ? null
        : getDefinition(resource);

    if (definition) {
      await definition.getDelegate().delete({ where: { Id: id } });
      return;
    }

    if (resource === "vehicle-makes") {
      await prisma.vehicleMake.delete({ where: { Id: id } });
      return;
    }

    if (resource === "vehicle-models") {
      await prisma.vehicleModel.delete({ where: { Id: id } });
      return;
    }

    if (resource === "parameters") {
      await prisma.parameter.delete({ where: { Id: id } });
      return;
    }
  } catch (error) {
    throw normalizePrismaError(error);
  }
}

export async function getVehicleModelApplicableProducts(vehicleModelId: number) {
  const vehicleModel = await prisma.vehicleModel.findUnique({
    where: { Id: vehicleModelId },
    select: { Id: true },
  });

  if (!vehicleModel) {
    return null;
  }

  const rows = await prisma.product.findMany({
    where: {
      ProductVehicleModelsAsProduct: {
        some: { VehicleModelId: vehicleModelId },
      },
    },
    orderBy: [{ DisplayName: "asc" }, { Name: "asc" }],
    select: {
      Id: true,
      Name: true,
      DisplayName: true,
      Description: true,
      PartNo: true,
      PurchaseCost: true,
      SellingPrice: true,
      ProductGroup: { select: { Id: true, Name: true } },
      ProductCategory: { select: { Id: true, Name: true } },
      Manufacturer: { select: { Id: true, Name: true } },
      Supplier: { select: { Id: true, Name: true } },
    },
  });

  return rows.map((product) => ({
    id: product.Id,
    name: product.Name,
    displayName: product.DisplayName,
    description: product.Description,
    partNo: product.PartNo,
    purchaseCost: product.PurchaseCost,
    sellingPrice: product.SellingPrice,
    productGroup: mapIdName(product.ProductGroup),
    productCategory: mapIdName(product.ProductCategory),
    manufacturer: mapIdName(product.Manufacturer),
    supplier: mapIdName(product.Supplier),
  }));
}

const vehicleMakeSelect = {
  Id: true,
  Name: true,
  Description: true,
  RegionParameterId: true,
  RegionParameter: {
    select: {
      Id: true,
      ParameterGroupId: true,
      Name: true,
      Code: true,
      Description: true,
      SortOrder: true,
      NumericData: true,
      OtherData: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      UpdatedDateTime: true,
    },
  },
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

const vehicleModelSelect = {
  Id: true,
  VehicleMakeId: true,
  Name: true,
  Description: true,
  BodyParameterId: true,
  ClassificationParameterId: true,
  VehicleMake: { select: { Id: true, Name: true } },
  BodyParameter: { select: { Id: true, Name: true, Code: true } },
  ClassificationParameter: { select: { Id: true, Name: true, Code: true } },
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

const parameterSelect = {
  Id: true,
  ParameterGroupId: true,
  Name: true,
  Code: true,
  Description: true,
  SortOrder: true,
  NumericData: true,
  OtherData: true,
  ParameterGroup: {
    select: {
      Id: true,
      Name: true,
      Code: true,
      Description: true,
      CreatedById: true,
      CreatedDateTime: true,
      UpdatedById: true,
      UpdatedDateTime: true,
    },
  },
  CreatedById: true,
  CreatedDateTime: true,
  UpdatedById: true,
  UpdatedDateTime: true,
};

function getDefinition(resource: ConfigResourceKey) {
  const definition = definitions[resource];

  if (!definition) {
    throw new ConfigServiceError("Configuration resource not found.", 404);
  }

  return definition;
}

function selectFor(definition: ConfigDefinition) {
  return definition.kind === "parameter-group"
    ? parameterGroupSelect
    : simpleSelect;
}

function mapDefinitionRecord(definition: ConfigDefinition, value: unknown) {
  const row = value as DbRecord;

  if (definition.kind === "parameter-group") {
    return {
      ...mapSimple(row),
      code: asString(row.Code),
    };
  }

  return mapSimple(row);
}

function mapSimple(row: DbRecord) {
  return {
    id: asNumber(row.Id),
    name: asString(row.Name),
    description: nullableString(row.Description),
    createdById: asNumber(row.CreatedById),
    createdDateTime: asDate(row.CreatedDateTime),
    updatedById: asNumber(row.UpdatedById),
    updatedDateTime: asDate(row.UpdatedDateTime),
  };
}

function mapVehicleMake(row: {
  Id: number;
  Name: string;
  Description: string | null;
  RegionParameterId: number;
  RegionParameter: null | {
    Id: number;
    ParameterGroupId: number;
    Name: string;
    Code: string;
    Description: string | null;
    SortOrder: number;
    NumericData: number;
    OtherData: string | null;
    CreatedById: number;
    CreatedDateTime: Date;
    UpdatedById: number;
    UpdatedDateTime: Date;
  };
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
}) {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
    regionParameterId: row.RegionParameterId,
    regionParameter: row.RegionParameter ? mapParameter(row.RegionParameter) : null,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapVehicleModel(row: {
  Id: number;
  VehicleMakeId: number;
  Name: string;
  Description: string | null;
  BodyParameterId: number;
  ClassificationParameterId: number;
  VehicleMake: null | { Id: number; Name: string };
  BodyParameter: null | { Id: number; Name: string; Code: string };
  ClassificationParameter: null | { Id: number; Name: string; Code: string };
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
}) {
  return {
    id: row.Id,
    vehicleMakeId: row.VehicleMakeId,
    name: row.Name,
    description: row.Description,
    bodyParameterId: row.BodyParameterId,
    classificationParameterId: row.ClassificationParameterId,
    vehicleMake: mapIdName(row.VehicleMake),
    bodyParameter: mapIdName(row.BodyParameter),
    classificationParameter: mapIdName(row.ClassificationParameter),
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapParameter(row: {
  Id: number;
  ParameterGroupId: number;
  Name: string;
  Code: string;
  Description: string | null;
  SortOrder: number;
  NumericData: number;
  OtherData: string | null;
  ParameterGroup?: null | {
    Id: number;
    Name: string;
    Code: string;
    Description: string | null;
    CreatedById: number;
    CreatedDateTime: Date;
    UpdatedById: number;
    UpdatedDateTime: Date;
  };
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
}) {
  return {
    id: row.Id,
    parameterGroupId: row.ParameterGroupId,
    name: row.Name,
    code: row.Code,
    description: row.Description,
    sortOrder: row.SortOrder,
    numericData: row.NumericData,
    otherData: row.OtherData,
    parameterGroup: row.ParameterGroup
      ? {
          id: row.ParameterGroup.Id,
          name: row.ParameterGroup.Name,
          code: row.ParameterGroup.Code,
          description: row.ParameterGroup.Description,
          createdById: row.ParameterGroup.CreatedById,
          createdDateTime: row.ParameterGroup.CreatedDateTime,
          updatedById: row.ParameterGroup.UpdatedById,
          updatedDateTime: row.ParameterGroup.UpdatedDateTime,
        }
      : null,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function mapIdName(value: null | { Id: number; Name: string }) {
  return value ? { id: value.Id, name: value.Name } : null;
}

function createDataForDefinition(
  definition: ConfigDefinition,
  body: JsonRecord,
  actorUserId: number,
) {
  const audit = createAudit(body, actorUserId);
  const data: DbRecord = {
    Name: readString(body, "name", "Name") ?? "",
    Description: readString(body, "description", "Description"),
    ...audit,
  };

  if (definition.kind === "parameter-group") {
    data.Code = readString(body, "code", "Code") ?? "";
  }

  return data;
}

function updateDataForDefinition(
  definition: ConfigDefinition,
  body: JsonRecord,
  actorUserId: number,
) {
  const data: DbRecord = {
    UpdatedById: readInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };

  if (hasField(body, "name", "Name")) {
    data.Name = readString(body, "name", "Name") ?? "";
  }

  if (hasField(body, "description", "Description")) {
    data.Description = readString(body, "description", "Description");
  }

  if (definition.kind === "parameter-group" && hasField(body, "code", "Code")) {
    data.Code = readString(body, "code", "Code") ?? "";
  }

  return data;
}

async function createVehicleMake(body: JsonRecord, actorUserId: number) {
  const regionParameterId = readInteger(
    body,
    "regionParameterId",
    "RegionParameterId",
  );

  if (!regionParameterId) {
    throw new ConfigServiceError("RegionParameterId is required.");
  }

  const row = await prisma.vehicleMake.create({
    data: {
      Name: readString(body, "name", "Name") ?? "",
      Description: readString(body, "description", "Description"),
      RegionParameterId: regionParameterId,
      ...createAudit(body, actorUserId),
    },
    select: vehicleMakeSelect,
  });

  return mapVehicleMake(row);
}

async function updateVehicleMake(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const data: DbRecord = {
    UpdatedById: readInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };

  if (hasField(body, "name", "Name")) {
    data.Name = readString(body, "name", "Name") ?? "";
  }

  if (hasField(body, "description", "Description")) {
    data.Description = readString(body, "description", "Description");
  }

  if (hasField(body, "regionParameterId", "RegionParameterId")) {
    data.RegionParameterId = readInteger(
      body,
      "regionParameterId",
      "RegionParameterId",
    );
  }

  await prisma.vehicleMake.update({
    where: { Id: id },
    data,
  });
}

async function createVehicleModel(body: JsonRecord, actorUserId: number) {
  const vehicleMakeId = readInteger(body, "vehicleMakeId", "VehicleMakeId");
  const bodyParameterId = readInteger(
    body,
    "bodyParameterId",
    "bodyTypeParameterId",
    "BodyParameterId",
  );
  const classificationParameterId = readInteger(
    body,
    "classificationParameterId",
    "ClassificationParameterId",
  );

  if (!vehicleMakeId) throw new ConfigServiceError("VehicleMakeId is required.");
  if (!bodyParameterId) throw new ConfigServiceError("BodyParameterId is required.");
  if (!classificationParameterId) {
    throw new ConfigServiceError("ClassificationParameterId is required.");
  }

  await assertExists(prisma.vehicleMake, vehicleMakeId, "VehicleMakeId does not exist");
  await assertExists(prisma.parameter, bodyParameterId, "BodyParameterId does not exist");
  await assertExists(
    prisma.parameter,
    classificationParameterId,
    "ClassificationParameterId does not exist",
  );

  const row = await prisma.vehicleModel.create({
    data: {
      VehicleMakeId: vehicleMakeId,
      Name: readString(body, "name", "Name") ?? "",
      Description: readString(body, "description", "Description"),
      BodyParameterId: bodyParameterId,
      ClassificationParameterId: classificationParameterId,
      ...createAudit(body, actorUserId),
    },
    select: vehicleModelSelect,
  });

  return mapVehicleModel(row);
}

async function updateVehicleModel(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const vehicleMakeId = readInteger(body, "vehicleMakeId", "VehicleMakeId");
  const bodyParameterId = readInteger(
    body,
    "bodyParameterId",
    "bodyTypeParameterId",
    "BodyParameterId",
  );
  const classificationParameterId = readInteger(
    body,
    "classificationParameterId",
    "ClassificationParameterId",
  );

  if (vehicleMakeId) {
    await assertExists(prisma.vehicleMake, vehicleMakeId, "VehicleMakeId does not exist");
  }

  if (bodyParameterId) {
    await assertExists(prisma.parameter, bodyParameterId, "BodyParameterId does not exist");
  }

  if (classificationParameterId) {
    await assertExists(
      prisma.parameter,
      classificationParameterId,
      "ClassificationParameterId does not exist",
    );
  }

  const data: DbRecord = {
    UpdatedById: readInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };

  if (vehicleMakeId) data.VehicleMakeId = vehicleMakeId;
  if (bodyParameterId) data.BodyParameterId = bodyParameterId;
  if (classificationParameterId) {
    data.ClassificationParameterId = classificationParameterId;
  }
  if (hasField(body, "name", "Name")) data.Name = readString(body, "name", "Name") ?? "";
  if (hasField(body, "description", "Description")) {
    data.Description = readString(body, "description", "Description");
  }

  await prisma.vehicleModel.update({
    where: { Id: id },
    data,
  });
}

async function createParameter(body: JsonRecord, actorUserId: number) {
  const parameterGroupId = readInteger(
    body,
    "parameterGroupId",
    "ParameterGroupId",
  );

  if (!parameterGroupId) {
    throw new ConfigServiceError("ParameterGroupId is required.");
  }

  await assertExists(
    prisma.parameterGroup,
    parameterGroupId,
    "ParameterGroupId does not exist",
  );

  const row = await prisma.parameter.create({
    data: {
      ParameterGroupId: parameterGroupId,
      Name: readString(body, "name", "Name") ?? "",
      Code: readString(body, "code", "Code") ?? "",
      Description: readString(body, "description", "Description"),
      SortOrder: readInteger(body, "sortOrder", "SortOrder") ?? 0,
      NumericData: readInteger(body, "numericData", "NumericData") ?? 0,
      OtherData: readString(body, "otherData", "OtherData"),
      ...createAudit(body, actorUserId),
    },
    select: parameterSelect,
  });

  return mapParameter(row);
}

async function updateParameter(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const parameterGroupId = readInteger(
    body,
    "parameterGroupId",
    "ParameterGroupId",
  );

  if (parameterGroupId) {
    await assertExists(
      prisma.parameterGroup,
      parameterGroupId,
      "ParameterGroupId does not exist",
    );
  }

  const data: DbRecord = {
    UpdatedById: readInteger(body, "updatedById", "UpdatedById") ?? actorUserId,
    UpdatedDateTime: new Date(),
  };

  if (parameterGroupId) data.ParameterGroupId = parameterGroupId;
  if (hasField(body, "name", "Name")) data.Name = readString(body, "name", "Name") ?? "";
  if (hasField(body, "code", "Code")) data.Code = readString(body, "code", "Code") ?? "";
  if (hasField(body, "description", "Description")) {
    data.Description = readString(body, "description", "Description");
  }
  if (hasField(body, "sortOrder", "SortOrder")) {
    data.SortOrder = readInteger(body, "sortOrder", "SortOrder") ?? 0;
  }
  if (hasField(body, "numericData", "NumericData")) {
    data.NumericData = readInteger(body, "numericData", "NumericData") ?? 0;
  }
  if (hasField(body, "otherData", "OtherData")) {
    data.OtherData = readString(body, "otherData", "OtherData");
  }

  await prisma.parameter.update({
    where: { Id: id },
    data,
  });
}

function createAudit(body: JsonRecord, actorUserId: number) {
  const createdById =
    readInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const now = new Date();

  return {
    CreatedById: createdById,
    CreatedDateTime: now,
    UpdatedById: updatedById,
    UpdatedDateTime: now,
  };
}

async function assertExists(
  delegate: { findUnique(args: DbRecord): Promise<unknown | null> },
  id: number,
  message: string,
) {
  const exists = await delegate.findUnique({
    where: { Id: id },
    select: { Id: true },
  });

  if (!exists) {
    throw new ConfigServiceError(message);
  }
}

function readString(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "string") {
      return value;
    }
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

    if (Number.isInteger(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }

  return null;
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  return typeof value === "string" ? value : null;
}

function normalizePrismaError(error: unknown): ConfigServiceError {
  if (error instanceof ConfigServiceError) {
    return error;
  }

  if (isPrismaError(error)) {
    if (error.code === "P2025") {
      return new ConfigServiceError("Record not found.", 404, {});
    }

    if (error.code === "P2003") {
      return new ConfigServiceError(
        "Cannot delete this record because it is already used by other records.",
        409,
        "Cannot delete this record because it is already used by other records.",
      );
    }
  }

  return new ConfigServiceError("An unexpected error occurred.", 500);
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
