import { serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { VoidCodeServiceError } from "@/server/void-codes/service";

export function voidCodeErrorResponse(error: unknown) {
  if (error instanceof VoidCodeServiceError) {
    return legacyJson(error.body, { status: error.status });
  }

  return serverError();
}
