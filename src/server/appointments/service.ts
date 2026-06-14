import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { JsonRecord } from "@/server/api/body";
import { getUploadsRoot } from "@/server/api/uploads";
import { readString } from "@/server/operations/simple-fields";

type Appointment = {
  id: number;
  firstName: string;
  lastName: string;
  status: string;
  mobile: string;
  email: string;
  schedule: string;
  time: string;
  appointmentType: string;
  description: string;
  start: string;
  end: string;
  createdDateTime: string;
  updatedDateTime: string;
};

export class AppointmentServiceError extends Error {
  readonly status: number;
  readonly body: { error: string };

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppointmentServiceError";
    this.status = status;
    this.body = { error: message };
  }
}

export function listAppointments() {
  return readAppointments().sort((a, b) => a.start.localeCompare(b.start));
}

export function getAppointment(id: number) {
  return readAppointments().find((item) => item.id === id) ?? null;
}

export function createAppointment(body: JsonRecord) {
  validateAppointment(body);
  const rows = readAppointments();
  const now = new Date().toISOString();
  const nextId = Math.max(0, ...rows.map((item) => item.id)) + 1;
  const appointment = normalizeAppointment(body, nextId, now, now);

  rows.push(appointment);
  writeAppointments(rows);

  return appointment;
}

export function updateAppointment(id: number, body: JsonRecord) {
  const rows = readAppointments();
  const index = rows.findIndex((item) => item.id === id);

  if (index < 0) return null;

  const existing = rows[index];
  const next = normalizeAppointment(
    { ...existing, ...body },
    id,
    existing.createdDateTime,
    new Date().toISOString(),
  );

  rows[index] = next;
  writeAppointments(rows);

  return next;
}

export function deleteAppointment(id: number) {
  const rows = readAppointments();
  const nextRows = rows.filter((item) => item.id !== id);

  if (nextRows.length === rows.length) return false;

  writeAppointments(nextRows);
  return true;
}

function normalizeAppointment(
  body: JsonRecord,
  id: number,
  createdDateTime: string,
  updatedDateTime: string,
): Appointment {
  const schedule = readString(body, "schedule")?.trim() ?? "";
  const time = readString(body, "time")?.trim() ?? "";
  const start = buildDateTime(schedule, time);

  return {
    id,
    firstName: readString(body, "firstName")?.trim() ?? "",
    lastName: readString(body, "lastName")?.trim() ?? "",
    status: readString(body, "status")?.trim() || "Scheduled",
    mobile: readString(body, "mobile")?.trim() ?? "",
    email: readString(body, "email")?.trim() ?? "",
    schedule,
    time,
    appointmentType:
      readString(body, "appointmentType")?.trim() || "Consultation",
    description: readString(body, "description") ?? "",
    start,
    end: addOneHour(start),
    createdDateTime,
    updatedDateTime,
  };
}

function validateAppointment(body: JsonRecord) {
  const required = ["firstName", "lastName", "mobile", "schedule", "time"];
  const missing = required.filter((key) => !readString(body, key)?.trim());

  if (missing.length > 0) {
    throw new AppointmentServiceError("Required appointment fields are missing.");
  }
}

function appointmentsPath() {
  return path.join(getUploadsRoot(), "appointments", "appointments.json");
}

function readAppointments(): Appointment[] {
  const file = appointmentsPath();
  if (!existsSync(/*turbopackIgnore: true*/ file)) return [];

  try {
    const parsed = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8"));
    return Array.isArray(parsed) ? parsed.filter(isAppointment) : [];
  } catch {
    return [];
  }
}

function writeAppointments(rows: Appointment[]) {
  const file = appointmentsPath();
  mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ file, JSON.stringify(rows, null, 2));
}

function buildDateTime(schedule: string, time: string) {
  if (!schedule) return "";
  return `${schedule}T${time || "00:00"}:00`;
}

function addOneHour(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  date.setHours(date.getHours() + 1);
  return date.toISOString();
}

function isAppointment(value: unknown): value is Appointment {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "number"
  );
}

