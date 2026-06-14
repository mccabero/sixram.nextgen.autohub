import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import { clearCameraEvents, listCameraEvents } from "@/server/camera/hikvision";
import { hikvisionErrorResponse } from "@/server/camera/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    return legacyJson(await listCameraEvents(new URL(request.url).searchParams));
  } catch (error) {
    return hikvisionErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    return legacyJson(await clearCameraEvents());
  } catch (error) {
    return hikvisionErrorResponse(error);
  }
}

