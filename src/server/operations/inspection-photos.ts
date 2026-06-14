import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { del, list } from "@vercel/blob";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { getUploadsRoot } from "@/server/api/uploads";
import {
  getPrivateBlobResponse,
  getPrivateBlobToken,
  imageContentType,
  imageExtensionFromFile,
  imageTypes,
  putImageBlob,
  safeBlobFilename,
} from "@/server/storage/blob-images";

export async function listInspectionPhotos(inspectionId: number) {
  const token = getPrivateBlobToken();

  if (token) {
    const result = await list({
      prefix: photoBlobPrefix(inspectionId),
      limit: 1000,
      token,
    });

    return result.blobs
      .filter((blob) => imageTypes.has(path.extname(blob.pathname).toLowerCase()))
      .sort((a, b) => a.pathname.localeCompare(b.pathname))
      .map((blob) => {
        const filename = path.basename(blob.pathname);
        return {
          filename,
          url: photoApiUrl(inspectionId, filename),
        };
      });
  }

  const directory = photoDirectory(inspectionId);

  if (!existsSync(/*turbopackIgnore: true*/ directory)) {
    return [];
  }

  return readdirSync(/*turbopackIgnore: true*/ directory)
    .filter((fileName) => imageTypes.has(path.extname(fileName).toLowerCase()))
    .sort()
    .map((fileName) => ({
      filename: fileName,
      url: photoApiUrl(inspectionId, fileName),
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

  const extension = imageExtensionFromFile(file);

  if (!extension) {
    return badRequest("Only JPG, PNG, GIF, and WebP images are supported.");
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const token = getPrivateBlobToken();

  if (token) {
    const blob = await putImageBlob({
      access: "private",
      file,
      pathname: `${photoBlobPrefix(inspectionId)}${fileName}`,
      token,
    });

    if (!blob) {
      return badRequest("Only JPG, PNG, GIF, and WebP images are supported.");
    }

    return legacyJson({
      filename: fileName,
      url: photoApiUrl(inspectionId, fileName),
    });
  }

  const directory = photoDirectory(inspectionId);
  mkdirSync(/*turbopackIgnore: true*/ directory, { recursive: true });

  const filePath = path.join(directory, fileName);
  writeFileSync(
    /*turbopackIgnore: true*/ filePath,
    Buffer.from(await file.arrayBuffer()),
  );

  return legacyJson({
    filename: fileName,
    url: photoApiUrl(inspectionId, fileName),
  });
}

export async function serveInspectionPhoto(inspectionId: number, filename: string) {
  const safeFileName = safeBlobFilename(filename);
  const extension = path.extname(safeFileName).toLowerCase();

  if (!imageTypes.has(extension)) {
    return notFound();
  }

  const token = getPrivateBlobToken();

  if (token) {
    const response = await getPrivateBlobResponse(
      `${photoBlobPrefix(inspectionId)}${safeFileName}`,
      token,
    );

    return response ?? notFound();
  }

  const filePath = path.join(photoDirectory(inspectionId), safeFileName);

  if (!existsSync(/*turbopackIgnore: true*/ filePath)) {
    return notFound();
  }

  return new Response(readFileSync(/*turbopackIgnore: true*/ filePath), {
    headers: {
      "content-type": imageContentType(extension),
      "cache-control": "public, max-age=300",
    },
  });
}

export async function deleteInspectionPhoto(
  inspectionId: number,
  filename: string,
) {
  const safeFileName = safeBlobFilename(filename);
  const extension = path.extname(safeFileName).toLowerCase();

  if (!imageTypes.has(extension)) {
    return notFound();
  }

  const token = getPrivateBlobToken();

  if (token) {
    await del(`${photoBlobPrefix(inspectionId)}${safeFileName}`, { token });
    return new Response(null, { status: 204 });
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

function photoBlobPrefix(inspectionId: number) {
  return `inspections/${inspectionId}/photos/`;
}

function photoApiUrl(inspectionId: number, fileName: string) {
  return `/api/operations/inspections/${inspectionId}/photos/${encodeURIComponent(fileName)}`;
}
