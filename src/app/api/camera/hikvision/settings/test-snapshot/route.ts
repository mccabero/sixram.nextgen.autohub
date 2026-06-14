import { readJsonRecord } from "@/server/api/body";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  buildSnapshotUnavailableResponse,
  updateHikvisionSettings,
} from "@/server/camera/hikvision";
import { hikvisionErrorResponse } from "@/server/camera/route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const body = await readJsonRecord(request);
    if (body) updateHikvisionSettings(body);
    buildSnapshotUnavailableResponse();
    return legacyJson({});
  } catch (error) {
    return hikvisionErrorResponse(error);
  }
}

