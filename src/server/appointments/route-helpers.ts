import { serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { AppointmentServiceError } from "@/server/appointments/service";

export function appointmentErrorResponse(error: unknown) {
  if (error instanceof AppointmentServiceError) {
    return legacyJson(error.body, { status: error.status });
  }

  return serverError();
}

