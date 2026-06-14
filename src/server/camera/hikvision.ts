import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { JsonRecord } from "@/server/api/body";
import { getUploadsRoot } from "@/server/api/uploads";
import { prisma } from "@/server/db/prisma";
import { readBoolean, readString } from "@/server/operations/simple-fields";

type HikvisionSettings = {
  snapshotCaptureEnabled?: boolean;
  cameraIp?: string;
  username?: string;
  password?: string;
  snapshotChannel?: string;
};

export class HikvisionServiceError extends Error {
  readonly status: number;
  readonly body: { error: string };

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HikvisionServiceError";
    this.status = status;
    this.body = { error: message };
  }
}

export async function listCameraEvents(searchParams: URLSearchParams) {
  const take = clampInteger(Number(searchParams.get("take") ?? 100), 1, 500);
  const where = buildCameraEventWhere(searchParams);
  const rows = await prisma.cameraEvent.findMany({
    where,
    orderBy: [{ EventDateTime: "desc" }, { Id: "desc" }],
    take,
    select: {
      Id: true,
      CameraIp: true,
      Ipv6Address: true,
      PortNo: true,
      Protocol: true,
      MacAddress: true,
      ChannelId: true,
      ChannelName: true,
      EventDateTime: true,
      EventType: true,
      EventState: true,
      EventDescription: true,
      ActivePostCount: true,
      Source: true,
      SnapshotPath: true,
      SnapshotUrl: true,
      SnapshotCapturedDateTime: true,
      SnapshotError: true,
      CreatedDateTime: true,
    },
  });

  return rows.map((row) => ({
    id: row.Id,
    cameraIp: row.CameraIp,
    ipv6Address: row.Ipv6Address,
    portNo: row.PortNo,
    protocol: row.Protocol,
    macAddress: row.MacAddress,
    channelId: row.ChannelId,
    channelName: row.ChannelName,
    eventDateTime: row.EventDateTime,
    eventType: row.EventType,
    eventState: row.EventState,
    eventDescription: row.EventDescription,
    activePostCount: row.ActivePostCount,
    source: row.Source,
    snapshotPath: row.SnapshotPath,
    snapshotUrl: row.SnapshotUrl,
    snapshotCapturedDateTime: row.SnapshotCapturedDateTime,
    snapshotError: row.SnapshotError,
    createdDateTime: row.CreatedDateTime,
  }));
}

export async function getCameraEventSummary(searchParams: URLSearchParams) {
  const where = buildCameraEventWhere(searchParams);
  const rows = await prisma.cameraEvent.findMany({
    where,
    orderBy: [{ EventDateTime: "desc" }, { Id: "desc" }],
    select: {
      Id: true,
      CameraIp: true,
      ChannelId: true,
      ChannelName: true,
      EventDateTime: true,
      EventType: true,
      EventState: true,
      EventDescription: true,
      ActivePostCount: true,
      Source: true,
      SnapshotUrl: true,
      SnapshotCapturedDateTime: true,
      SnapshotError: true,
      CreatedDateTime: true,
    },
  });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRows = rows.filter((row) => row.EventDateTime >= todayStart);
  const active = rows.filter(isActiveEvent);
  const vmdActive = active.filter((row) => /vmd|motion/i.test(row.EventType));
  const captured = rows.filter((row) => !!row.SnapshotCapturedDateTime);
  const snapshotFailed = rows.filter((row) => !!row.SnapshotError);

  return {
    totalToday: todayRows.length,
    activeToday: todayRows.filter(isActiveEvent).length,
    vmdActiveToday: todayRows.filter((row) => isActiveEvent(row) && /vmd|motion/i.test(row.EventType)).length,
    total: rows.length,
    active: active.length,
    vmdActive: vmdActive.length,
    captured: captured.length,
    snapshotFailed: snapshotFailed.length,
    lastEvent: rows[0]
      ? {
          id: rows[0].Id,
          cameraIp: rows[0].CameraIp,
          channelId: rows[0].ChannelId,
          channelName: rows[0].ChannelName,
          eventDateTime: rows[0].EventDateTime,
          eventType: rows[0].EventType,
          eventState: rows[0].EventState,
          eventDescription: rows[0].EventDescription,
          activePostCount: rows[0].ActivePostCount,
          source: rows[0].Source,
          snapshotUrl: rows[0].SnapshotUrl,
          snapshotCapturedDateTime: rows[0].SnapshotCapturedDateTime,
          snapshotError: rows[0].SnapshotError,
          createdDateTime: rows[0].CreatedDateTime,
        }
      : null,
  };
}

export async function clearCameraEvents() {
  const result = await prisma.cameraEvent.deleteMany();
  return { deleted: result.count };
}

export function getHikvisionSettings() {
  const settings = readSettings();

  return {
    snapshotCaptureEnabled: Boolean(settings.snapshotCaptureEnabled),
    cameraIp: settings.cameraIp ?? "",
    username: settings.username ?? "admin",
    snapshotChannel: settings.snapshotChannel ?? "101",
    passwordConfigured: Boolean(settings.password),
  };
}

export function updateHikvisionSettings(body: JsonRecord | null) {
  if (!body) {
    throw new HikvisionServiceError("Request is required.");
  }

  const existing = readSettings();
  const next: HikvisionSettings = {
    snapshotCaptureEnabled:
      readBoolean(body, "snapshotCaptureEnabled", "SnapshotCaptureEnabled") ??
      Boolean(existing.snapshotCaptureEnabled),
    cameraIp:
      readString(body, "cameraIp", "CameraIp")?.trim() ??
      existing.cameraIp ??
      "",
    username:
      readString(body, "username", "Username")?.trim() ??
      existing.username ??
      "admin",
    snapshotChannel:
      readString(body, "snapshotChannel", "SnapshotChannel")?.trim() ??
      existing.snapshotChannel ??
      "101",
    password:
      readString(body, "password", "Password") ?? existing.password ?? "",
  };

  writeSettings(next);

  return getHikvisionSettings();
}

export function buildSnapshotUnavailableResponse() {
  throw new HikvisionServiceError(
    "Hikvision snapshot testing requires a server that can reach the camera network. Configure a gateway service before enabling this in production.",
    501,
  );
}

function buildCameraEventWhere(searchParams: URLSearchParams) {
  const eventType = searchParams.get("eventType")?.trim();
  const eventState = searchParams.get("eventState")?.trim();
  const start = readDateQuery(searchParams.get("start") ?? searchParams.get("capturedStart"));
  const end = readDateQuery(searchParams.get("end") ?? searchParams.get("capturedEnd"), true);

  return {
    ...(eventType ? { EventType: { equals: eventType, mode: "insensitive" as const } } : {}),
    ...(eventState ? { EventState: { equals: eventState, mode: "insensitive" as const } } : {}),
    ...(start || end
      ? {
          EventDateTime: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
  };
}

function readDateQuery(value: string | null, endOfDay = false) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function isActiveEvent(row: { EventState: string | null }) {
  return ["active", "start", "on", "true", "1"].includes(
    (row.EventState ?? "").trim().toLowerCase(),
  );
}

function settingsPath() {
  return path.join(getUploadsRoot(), "hikvision", "settings.json");
}

function readSettings(): HikvisionSettings {
  const file = settingsPath();
  if (!existsSync(/*turbopackIgnore: true*/ file)) return {};

  try {
    return JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as HikvisionSettings;
  } catch {
    return {};
  }
}

function writeSettings(settings: HikvisionSettings) {
  const file = settingsPath();
  mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ file, JSON.stringify(settings, null, 2));
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isInteger(value)) return max;
  return Math.min(Math.max(value, min), max);
}

