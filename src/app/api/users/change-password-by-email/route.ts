import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { changePasswordByEmail } from "@/server/users/service";
import { userErrorResponse } from "@/server/users/route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await changePasswordByEmail(body);
    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return userErrorResponse(error);
  }
}
