import { serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { OperationAccessServiceError } from "@/server/operations/access-control";

export function operationAccessErrorResponse(error: unknown) {
  if (error instanceof OperationAccessServiceError) {
    return legacyJson(error.body, { status: error.status });
  }

  return serverError();
}

