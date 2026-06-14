import { notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { ManagementServiceError } from "@/server/management/service";

export function managementErrorResponse(error: unknown) {
  if (error instanceof ManagementServiceError) {
    return error.status === 404
      ? notFound()
      : legacyJson(error.body, { status: error.status });
  }

  return serverError();
}
