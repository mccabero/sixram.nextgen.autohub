import { notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { UserServiceError } from "@/server/users/service";

export function userErrorResponse(error: unknown) {
  if (error instanceof UserServiceError) {
    return error.status === 404
      ? notFound()
      : legacyJson(error.body, { status: error.status });
  }

  return serverError();
}
