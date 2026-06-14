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
import {
  deleteBlobImagesByPrefix,
  findBlobImageByPrefix,
  getPublicBlobToken,
  imageContentType,
  imageExtensionFromFile,
  imageTypes,
  localDirectoryToBlobPrefix,
  putImageBlob,
} from "@/server/storage/blob-images";

export async function serveUploadedImage(directory: string, prefix: string) {
  const token = getPublicBlobToken();

  if (token) {
    const blob = await findBlobImageByPrefix(
      localDirectoryToBlobPrefix(directory, prefix),
      token,
    );

    if (blob) {
      return Response.redirect(blob.url);
    }
  }

  const asset = findUploadedImageFile(directory, prefix);

  if (!asset) {
    return notFound();
  }

  return new Response(readFileSync(/*turbopackIgnore: true*/ asset.fullPath), {
    headers: {
      "content-type": imageContentType(asset.extension),
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

  const extension = imageExtensionFromFile(file);

  if (!extension) {
    return badRequest("Only JPG, PNG, GIF, and WebP images are supported.");
  }

  const token = getPublicBlobToken();
  const blobPrefix = localDirectoryToBlobPrefix(directory, prefix);

  if (token) {
    await deleteBlobImagesByPrefix(blobPrefix, token);
    const blob = await putImageBlob({
      access: "public",
      allowOverwrite: true,
      file,
      pathname: `${blobPrefix}${extension}`,
      token,
    });

    if (!blob) {
      return badRequest("Only JPG, PNG, GIF, and WebP images are supported.");
    }

    return legacyJson({
      ...responsePayload,
      path: blob.url,
      url: blob.url,
    });
  }

  mkdirSync(/*turbopackIgnore: true*/ directory, { recursive: true });
  removeUploadedImageFiles(directory, prefix);

  const filePath = path.join(directory, `${prefix}${extension}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  writeFileSync(/*turbopackIgnore: true*/ filePath, bytes);

  return legacyJson(responsePayload);
}

export async function deleteUploadedImage(
  directory: string,
  prefix: string,
  responsePayload: Record<string, unknown>,
) {
  const token = getPublicBlobToken();

  if (token) {
    await deleteBlobImagesByPrefix(
      localDirectoryToBlobPrefix(directory, prefix),
      token,
    );
    return legacyJson(responsePayload);
  }

  removeUploadedImageFiles(directory, prefix);
  return legacyJson(responsePayload);
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
