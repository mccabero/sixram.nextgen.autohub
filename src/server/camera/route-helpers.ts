import { serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { HikvisionServiceError } from "@/server/camera/hikvision";

export function hikvisionErrorResponse(error: unknown) {
  if (error instanceof HikvisionServiceError) {
    return legacyJson(error.body, { status: error.status });
  }

  return serverError();
}

