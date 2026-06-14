import { notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  listInspectionPhotos,
  saveInspectionPhoto,
} from "@/server/operations/inspection-photos";

export const runtime = "nodejs";

type InspectionPhotosContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: InspectionPhotosContext,
) {
  const inspectionId = parsePositiveInt((await context.params).id);

  if (!inspectionId) {
    return notFound();
  }

  return legacyJson(listInspectionPhotos(inspectionId));
}

export async function POST(
  request: Request,
  context: InspectionPhotosContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const inspectionId = parsePositiveInt((await context.params).id);

  if (!inspectionId) {
    return notFound();
  }

  return saveInspectionPhoto(request, inspectionId);
}

