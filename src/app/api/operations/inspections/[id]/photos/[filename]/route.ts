import { notFound } from "@/server/api/errors";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteInspectionPhoto,
  serveInspectionPhoto,
} from "@/server/operations/inspection-photos";

export const runtime = "nodejs";

type InspectionPhotoContext = {
  params: Promise<{
    id: string;
    filename: string;
  }>;
};

export async function GET(_request: Request, context: InspectionPhotoContext) {
  const { id, filename } = await context.params;
  const inspectionId = parsePositiveInt(id);

  if (!inspectionId) {
    return notFound();
  }

  return serveInspectionPhoto(inspectionId, decodeURIComponent(filename));
}

export async function DELETE(request: Request, context: InspectionPhotoContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id, filename } = await context.params;
  const inspectionId = parsePositiveInt(id);

  if (!inspectionId) {
    return notFound();
  }

  return deleteInspectionPhoto(inspectionId, decodeURIComponent(filename));
}
