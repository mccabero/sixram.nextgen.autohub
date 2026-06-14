import { notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { OperationServiceError } from "@/server/operations/inspections";

export function operationErrorResponse(error: unknown) {
  if (error instanceof OperationServiceError) {
    return error.status === 404
      ? notFound()
      : legacyJson(error.body, { status: error.status });
  }

  return serverError();
}
