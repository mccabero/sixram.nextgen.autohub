import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { getUploadsRoot } from "@/server/api/uploads";

const imageTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export function listInspectionPhotos(inspectionId: number) {
  const directory = photoDirectory(inspectionId);

  if (!existsSync(/*turbopackIgnore: true*/ directory)) {
    return [];
  }

  return readdirSync(/*turbopackIgnore: true*/ directory)
    .filter((fileName) => imageTypes.has(path.extname(fileName).toLowerCase()))
    .sort()
    .map((fileName) => ({
      filename: fileName,
      url: `/api/operations/inspections/${inspectionId}/photos/${encodeURIComponent(fileName)}`,
    }));
}

export async function saveInspectionPhoto(
  request: Request,
  inspectionId: number,
) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof Blob)) {
    return badRequest("Image file is required.");
  }

  const extension = extensionFromFile(file);

  if (!extension) {
    return badRequest("Only JPG, PNG, GIF, and WebP images are supported.");
  }

  const directory = photoDirectory(inspectionId);
  mkdirSync(/*turbopackIgnore: true*/ directory, { recursive: true });

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const filePath = path.join(directory, fileName);
  writeFileSync(
    /*turbopackIgnore: true*/ filePath,
    Buffer.from(await file.arrayBuffer()),
  );

  return legacyJson({
    filename: fileName,
    url: `/api/operations/inspections/${inspectionId}/photos/${encodeURIComponent(fileName)}`,
  });
}

export function serveInspectionPhoto(inspectionId: number, filename: string) {
  const safeFileName = path.basename(filename);
  const extension = path.extname(safeFileName).toLowerCase();

  if (!imageTypes.has(extension)) {
    return notFound();
  }

  const filePath = path.join(photoDirectory(inspectionId), safeFileName);

  if (!existsSync(/*turbopackIgnore: true*/ filePath)) {
    return notFound();
  }

  return new Response(readFileSync(/*turbopackIgnore: true*/ filePath), {
    headers: {
      "content-type": imageTypes.get(extension) ?? "application/octet-stream",
      "cache-control": "public, max-age=300",
    },
  });
}

export function deleteInspectionPhoto(inspectionId: number, filename: string) {
  const safeFileName = path.basename(filename);
  const extension = path.extname(safeFileName).toLowerCase();

  if (!imageTypes.has(extension)) {
    return notFound();
  }

  const filePath = path.join(photoDirectory(inspectionId), safeFileName);

  if (!existsSync(/*turbopackIgnore: true*/ filePath)) {
    return notFound();
  }

  rmSync(/*turbopackIgnore: true*/ filePath);
  return new Response(null, { status: 204 });
}

function photoDirectory(inspectionId: number) {
  return path.join(getUploadsRoot(), "inspections", String(inspectionId), "photos");
}

function extensionFromFile(file: Blob) {
  const type = file.type.toLowerCase();
  const byType = [...imageTypes.entries()].find(([, mime]) => mime === type)?.[0];
  if (byType) return byType;

  const maybeName = "name" in file ? String(file.name) : "";
  const extension = path.extname(maybeName).toLowerCase();
  return imageTypes.has(extension) ? extension : null;
}

