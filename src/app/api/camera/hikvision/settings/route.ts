import { readJsonRecord } from "@/server/api/body";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  getHikvisionSettings,
  updateHikvisionSettings,
} from "@/server/camera/hikvision";
import { hikvisionErrorResponse } from "@/server/camera/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return legacyJson(getHikvisionSettings());
}

export async function PUT(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    return legacyJson(updateHikvisionSettings(await readJsonRecord(request)));
  } catch (error) {
    return hikvisionErrorResponse(error);
  }
}

