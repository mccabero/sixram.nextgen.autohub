import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import {
  deleteAppointment,
  getAppointment,
  updateAppointment,
} from "@/server/appointments/service";
import { appointmentErrorResponse } from "@/server/appointments/route-helpers";
import { authorizeApiRequest } from "@/server/auth/guard";

export const runtime = "nodejs";

type AppointmentContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: AppointmentContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const appointmentId = parsePositiveInt((await context.params).id);

  if (!appointmentId) {
    return notFound();
  }

  const appointment = getAppointment(appointmentId);

  return appointment ? legacyJson(appointment) : notFound();
}

export async function PUT(request: Request, context: AppointmentContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const appointmentId = parsePositiveInt((await context.params).id);

  if (!appointmentId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const appointment = updateAppointment(appointmentId, body);

    return appointment ? legacyJson(appointment) : notFound();
  } catch (error) {
    return appointmentErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: AppointmentContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const appointmentId = parsePositiveInt((await context.params).id);

  if (!appointmentId) {
    return notFound();
  }

  return deleteAppointment(appointmentId)
    ? new Response(null, { status: 204 })
    : notFound();
}

