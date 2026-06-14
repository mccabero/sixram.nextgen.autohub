import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { findUploadedImageFile } from "@/server/api/uploads";

const imageTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export function serveUploadedImage(directory: string, prefix: string) {
  const asset = findUploadedImageFile(directory, prefix);

  if (!asset) {
    return notFound();
  }

  return new Response(readFileSync(/*turbopackIgnore: true*/ asset.fullPath), {
    headers: {
      "content-type": imageTypes.get(asset.extension) ?? "application/octet-stream",
      "cache-control": "public, max-age=300",
    },
  });
}

export async function saveUploadedImage(
  request: Request,
  directory: string,
  prefix: string,
  responsePayload: Record<string, unknown>,
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

  mkdirSync(/*turbopackIgnore: true*/ directory, { recursive: true });
  removeUploadedImageFiles(directory, prefix);

  const filePath = path.join(directory, `${prefix}${extension}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  writeFileSync(/*turbopackIgnore: true*/ filePath, bytes);

  return legacyJson(responsePayload);
}

export function deleteUploadedImage(
  directory: string,
  prefix: string,
  responsePayload: Record<string, unknown>,
) {
  removeUploadedImageFiles(directory, prefix);
  return legacyJson(responsePayload);
}

function extensionFromFile(file: Blob) {
  const type = file.type.toLowerCase();
  const byType = [...imageTypes.entries()].find(([, mime]) => mime === type)?.[0];
  if (byType) return byType;

  const maybeName = "name" in file ? String(file.name) : "";
  const extension = path.extname(maybeName).toLowerCase();
  return imageTypes.has(extension) ? extension : null;
}

function removeUploadedImageFiles(directory: string, prefix: string) {
  if (!existsSync(/*turbopackIgnore: true*/ directory)) return;

  for (const extension of imageTypes.keys()) {
    const filePath = path.join(directory, `${prefix}${extension}`);
    if (existsSync(/*turbopackIgnore: true*/ filePath)) {
      rmSync(/*turbopackIgnore: true*/ filePath);
    }
  }
}

