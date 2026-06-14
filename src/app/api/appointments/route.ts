import { readJsonRecord } from "@/server/api/body";
import { badRequest } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import {
  createAppointment,
  listAppointments,
} from "@/server/appointments/service";
import { appointmentErrorResponse } from "@/server/appointments/route-helpers";
import { authorizeApiRequest } from "@/server/auth/guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(listAppointments());
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(createAppointment(body), { status: 201 });
  } catch (error) {
    return appointmentErrorResponse(error);
  }
}

