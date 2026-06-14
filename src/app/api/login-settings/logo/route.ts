import path from "node:path";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteUploadedImage,
  saveUploadedImage,
  serveUploadedImage,
} from "@/server/api/image-assets";
import { getUploadsRoot } from "@/server/api/uploads";
import { getLoginSettingsPayload } from "@/server/login-settings/service";

export const runtime = "nodejs";

function directory() {
  return path.join(getUploadsRoot(), "login");
}

export async function GET() {
  return serveUploadedImage(directory(), "login_logo");
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return saveUploadedImage(
    request,
    directory(),
    "login_logo",
    getLoginSettingsPayload(),
  );
}

export async function DELETE(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return deleteUploadedImage(directory(), "login_logo", getLoginSettingsPayload());
}

