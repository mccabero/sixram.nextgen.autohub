import type { JsonRecord } from "@/server/api/body";
import { prisma } from "@/server/db/prisma";
import { ConfigServiceError } from "@/server/config/reference-data";

const legacyLayoutKey = "legacy-basic-v1";

type ChecklistItem = {
  id: number;
  name: string;
  isRed: boolean;
  isAmber: boolean;
  isGreen: boolean;
  remarks: string;
};

type ChecklistGroup = {
  group: string;
  sequence: number;
  detailsModelList: ChecklistItem[];
};

type InspectionTemplateRow = {
  Id: number;
  Name: string;
  Description: string | null;
  Revision: number;
  IsActive: boolean;
  ChecklistJson: string;
  CreatedById: number;
  CreatedDateTime: Date;
  UpdatedById: number;
  UpdatedDateTime: Date;
};

export async function listInspectionTemplates() {
  const rows = await prisma.inspectionChecklistTemplate.findMany({
    orderBy: [
      { IsActive: "desc" },
      { Name: "asc" },
      { UpdatedDateTime: "desc" },
    ],
  });

  return rows.map((row) => mapTemplate(row, false));
}

export async function getActiveInspectionTemplate() {
  const row = await prisma.inspectionChecklistTemplate.findFirst({
    orderBy: [
      { IsActive: "desc" },
      { UpdatedDateTime: "desc" },
      { Id: "desc" },
    ],
  });

  return row ? mapTemplate(row, true) : null;
}

export async function getInspectionTemplate(id: number) {
  const row = await prisma.inspectionChecklistTemplate.findUnique({
    where: { Id: id },
  });

  return row ? mapTemplate(row, true) : null;
}

export async function createInspectionTemplate(
  body: JsonRecord,
  actorUserId: number,
) {
  const name = normalizeName(readString(body, "name", "Name"));
  const description = normalizeDescription(
    readString(body, "description", "Description"),
  );
  const layoutKey = normalizeLayoutKey(readString(body, "layoutKey", "LayoutKey"));
  const groups = normalizeGroups(body.groups ?? body.Groups);
  validateTemplate(name, groups);

  const createdById =
    readInteger(body, "createdById", "CreatedById") ?? actorUserId;
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ?? createdById;
  const isActive = readBoolean(body, "isActive", "IsActive") ?? false;
  const now = new Date();

  const row = await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.inspectionChecklistTemplate.updateMany({
        where: { IsActive: true },
        data: {
          IsActive: false,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
      });
    }

    return tx.inspectionChecklistTemplate.create({
      data: {
        Name: name,
        Description: description,
        Revision: 1,
        IsActive: isActive,
        ChecklistJson: serializeGroups(groups, layoutKey),
        CreatedById: createdById,
        CreatedDateTime: now,
        UpdatedById: updatedById,
        UpdatedDateTime: now,
      },
    });
  });

  return mapTemplate(row, true);
}

export async function updateInspectionTemplate(
  id: number,
  body: JsonRecord,
  actorUserId: number,
) {
  const updatedById =
    readInteger(body, "updatedById", "UpdatedById") ?? actorUserId;
  const now = new Date();

  const row = await prisma.$transaction(async (tx) => {
    const template = await tx.inspectionChecklistTemplate.findUnique({
      where: { Id: id },
    });

    if (!template) {
      throw new ConfigServiceError("Template not found.", 404, {});
    }

    const nextName = hasField(body, "name", "Name")
      ? normalizeName(readString(body, "name", "Name"))
      : template.Name;
    const nextDescription = hasField(body, "description", "Description")
      ? normalizeDescription(readString(body, "description", "Description"))
      : template.Description;
    const nextLayoutKey = hasField(body, "layoutKey", "LayoutKey")
      ? normalizeLayoutKey(readString(body, "layoutKey", "LayoutKey"))
      : getLayoutKey(template.ChecklistJson);
    const nextGroups = hasField(body, "groups", "Groups")
      ? normalizeGroups(body.groups ?? body.Groups)
      : deserializeGroups(template.ChecklistJson);

    validateTemplate(nextName, nextGroups);

    const nextChecklistJson = hasField(body, "groups", "Groups")
      ? serializeGroups(nextGroups, nextLayoutKey)
      : nextLayoutKey.toLowerCase() === getLayoutKey(template.ChecklistJson).toLowerCase()
        ? template.ChecklistJson
        : serializeGroups(nextGroups, nextLayoutKey);
    const contentChanged =
      template.Name !== nextName ||
      (template.Description ?? "") !== (nextDescription ?? "") ||
      template.ChecklistJson !== nextChecklistJson;

    const requestedActive = readBoolean(body, "isActive", "IsActive");
    let nextIsActive = template.IsActive;

    if (requestedActive === true && !template.IsActive) {
      await tx.inspectionChecklistTemplate.updateMany({
        where: {
          IsActive: true,
          Id: { not: id },
        },
        data: {
          IsActive: false,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
      });
      nextIsActive = true;
    } else if (requestedActive === false && template.IsActive) {
      const fallback = await tx.inspectionChecklistTemplate.findFirst({
        where: { Id: { not: id } },
        orderBy: [{ UpdatedDateTime: "desc" }, { Id: "desc" }],
        select: { Id: true },
      });

      if (!fallback) {
        throw new ConfigServiceError(
          "At least one inspection template must remain active.",
          409,
          "At least one inspection template must remain active.",
        );
      }

      nextIsActive = false;
      await tx.inspectionChecklistTemplate.update({
        where: { Id: id },
        data: {
          IsActive: false,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
      });
      await tx.inspectionChecklistTemplate.update({
        where: { Id: fallback.Id },
        data: {
          IsActive: true,
          UpdatedById: updatedById,
          UpdatedDateTime: now,
        },
      });
    }

    return tx.inspectionChecklistTemplate.update({
      where: { Id: id },
      data: {
        Name: nextName,
        Description: nextDescription,
        ChecklistJson: nextChecklistJson,
        IsActive: nextIsActive,
        Revision: contentChanged ? Math.max(1, template.Revision) + 1 : template.Revision,
        UpdatedById: updatedById,
        UpdatedDateTime: now,
      },
    });
  });

  return mapTemplate(row, true);
}

export async function activateInspectionTemplate(
  id: number,
  actorUserId: number,
) {
  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    const template = await tx.inspectionChecklistTemplate.findUnique({
      where: { Id: id },
      select: { Id: true },
    });

    if (!template) {
      throw new ConfigServiceError("Template not found.", 404, {});
    }

    await tx.inspectionChecklistTemplate.updateMany({
      where: {
        IsActive: true,
        Id: { not: id },
      },
      data: {
        IsActive: false,
        UpdatedById: actorUserId,
        UpdatedDateTime: now,
      },
    });

    return tx.inspectionChecklistTemplate.update({
      where: { Id: id },
      data: {
        IsActive: true,
        UpdatedById: actorUserId,
        UpdatedDateTime: now,
      },
    });
  });

  return mapTemplate(row, true);
}

export async function deleteInspectionTemplate(id: number, actorUserId: number) {
  await prisma.$transaction(async (tx) => {
    const template = await tx.inspectionChecklistTemplate.findUnique({
      where: { Id: id },
    });

    if (!template) {
      throw new ConfigServiceError("Template not found.", 404, {});
    }

    const remainingCount = await tx.inspectionChecklistTemplate.count({
      where: { Id: { not: id } },
    });

    if (remainingCount === 0) {
      throw new ConfigServiceError(
        "At least one inspection template is required.",
        409,
        "At least one inspection template is required.",
      );
    }

    let fallbackId: number | null = null;

    if (template.IsActive) {
      const fallback = await tx.inspectionChecklistTemplate.findFirst({
        where: { Id: { not: id } },
        orderBy: [{ UpdatedDateTime: "desc" }, { Id: "desc" }],
        select: { Id: true },
      });
      fallbackId = fallback?.Id ?? null;
    }

    await tx.inspectionChecklistTemplate.delete({
      where: { Id: id },
    });

    if (fallbackId) {
      await tx.inspectionChecklistTemplate.update({
        where: { Id: fallbackId },
        data: {
          IsActive: true,
          UpdatedById: actorUserId,
          UpdatedDateTime: new Date(),
        },
      });
    }
  });
}

function mapTemplate(row: InspectionTemplateRow, includeGroups: boolean) {
  const groups = deserializeGroups(row.ChecklistJson);
  const counts = countGroups(groups);

  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
    layoutKey: getLayoutKey(row.ChecklistJson),
    revision: row.Revision,
    isActive: row.IsActive,
    groupCount: counts.groupCount,
    itemCount: counts.itemCount,
    groups: includeGroups ? groups : null,
    createdById: row.CreatedById,
    createdDateTime: row.CreatedDateTime,
    updatedById: row.UpdatedById,
    updatedDateTime: row.UpdatedDateTime,
  };
}

function normalizeName(value: string | null) {
  return (value ?? "").trim();
}

function normalizeDescription(value: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeLayoutKey(value: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : legacyLayoutKey;
}

function validateTemplate(name: string, groups: ChecklistGroup[]) {
  if (!name) {
    throw new ConfigServiceError("Template name is required.");
  }

  if (groups.length === 0) {
    throw new ConfigServiceError(
      "At least one checklist section with at least one item is required.",
    );
  }
}

function getLayoutKey(json: string | null | undefined) {
  if (!json?.trim()) {
    return legacyLayoutKey;
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as JsonRecord).layoutKey === "string"
    ) {
      return normalizeLayoutKey((parsed as JsonRecord).layoutKey as string);
    }
  } catch {
    return legacyLayoutKey;
  }

  return legacyLayoutKey;
}

function deserializeGroups(json: string | null | undefined) {
  if (!json?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeGroups(parsed);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as JsonRecord).groups)
    ) {
      return normalizeGroups((parsed as JsonRecord).groups);
    }
  } catch {
    return [];
  }

  return [];
}

function normalizeGroups(value: unknown): ChecklistGroup[] {
  const source = Array.isArray(value) ? value : [];
  const normalized: ChecklistGroup[] = [];

  for (const rawGroup of source) {
    if (!rawGroup || typeof rawGroup !== "object" || Array.isArray(rawGroup)) {
      continue;
    }

    const groupRecord = rawGroup as JsonRecord;
    const group = String(groupRecord.group ?? groupRecord.Group ?? "").trim();

    if (!group) {
      continue;
    }

    const rawItems =
      groupRecord.detailsModelList ?? groupRecord.DetailsModelList;
    const items = Array.isArray(rawItems)
      ? rawItems
          .map((rawItem) => {
            if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
              return null;
            }

            const itemRecord = rawItem as JsonRecord;
            const name = String(itemRecord.name ?? itemRecord.Name ?? "").trim();

            return name;
          })
          .filter((name): name is string => !!name)
          .map((name, index) => ({
            id: index + 1,
            name,
            isRed: false,
            isAmber: false,
            isGreen: false,
            remarks: "",
          }))
      : [];

    if (items.length === 0) {
      continue;
    }

    normalized.push({
      group,
      sequence: normalized.length + 1,
      detailsModelList: items,
    });
  }

  return normalized;
}

function serializeGroups(groups: ChecklistGroup[], layoutKey: string) {
  const normalizedGroups = normalizeGroups(groups);
  const normalizedLayoutKey = normalizeLayoutKey(layoutKey);

  if (normalizedLayoutKey.toLowerCase() === legacyLayoutKey.toLowerCase()) {
    return JSON.stringify(normalizedGroups);
  }

  return JSON.stringify({
    layoutKey: normalizedLayoutKey,
    groups: normalizedGroups,
  });
}

function countGroups(groups: ChecklistGroup[]) {
  return {
    groupCount: groups.length,
    itemCount: groups.reduce(
      (total, group) => total + group.detailsModelList.length,
      0,
    ),
  };
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

function readBoolean(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}
