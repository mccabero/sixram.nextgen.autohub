import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

export const imageTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export type ImageBlobAccess = "public" | "private";

function cleanToken(value: string | undefined) {
  const token = value?.trim();
  return token ? token : null;
}

export function getPublicBlobToken() {
  return (
    cleanToken(process.env.PUBLIC_BLOB_READ_WRITE_TOKEN) ??
    cleanToken(process.env.BLOB_PUBLIC_READ_WRITE_TOKEN) ??
    cleanToken(process.env.VERCEL_BLOB_PUBLIC_READ_WRITE_TOKEN)
  );
}

export function getPrivateBlobToken() {
  return (
    cleanToken(process.env.PRIVATE_BLOB_READ_WRITE_TOKEN) ??
    cleanToken(process.env.BLOB_READ_WRITE_TOKEN)
  );
}

export function imageExtensionFromFile(file: Blob) {
  const type = file.type.toLowerCase();
  const byType = [...imageTypes.entries()].find(([, mime]) => mime === type)?.[0];
  if (byType) return byType;

  const maybeName = "name" in file ? String(file.name) : "";
  const extension = path.extname(maybeName).toLowerCase();
  return imageTypes.has(extension) ? extension : null;
}

export function imageContentType(extension: string) {
  return imageTypes.get(extension.toLowerCase()) ?? "application/octet-stream";
}

export function localDirectoryToBlobPrefix(directory: string, prefix: string) {
  const normalizedDirectory = directory
    .replaceAll("\\", "/")
    .replace(/^\.?\/*uploads\/*/, "")
    .replace(/^\/+|\/+$/g, "");

  return normalizedDirectory ? `${normalizedDirectory}/${prefix}` : prefix;
}

export function safeBlobFilename(fileName: string) {
  return path
    .basename(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

export async function findBlobImageByPrefix(prefix: string, token: string) {
  const result = await list({
    prefix,
    limit: 100,
    token,
  });

  return result.blobs
    .filter((blob) => imageTypes.has(path.extname(blob.pathname).toLowerCase()))
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0] ?? null;
}

export async function deleteBlobImagesByPrefix(prefix: string, token: string) {
  const result = await list({
    prefix,
    limit: 100,
    token,
  });
  const pathnames = result.blobs
    .filter((blob) => imageTypes.has(path.extname(blob.pathname).toLowerCase()))
    .map((blob) => blob.pathname);

  if (pathnames.length > 0) {
    await del(pathnames, { token });
  }
}

export async function putImageBlob(options: {
  access: ImageBlobAccess;
  pathname: string;
  file: Blob;
  token: string;
  allowOverwrite?: boolean;
  cacheControlMaxAge?: number;
}) {
  const extension = imageExtensionFromFile(options.file);

  if (!extension) {
    return null;
  }

  return put(options.pathname, options.file, {
    access: options.access,
    allowOverwrite: options.allowOverwrite ?? false,
    cacheControlMaxAge: options.cacheControlMaxAge ?? 300,
    contentType: imageContentType(extension),
    token: options.token,
  });
}

export async function getPrivateBlobResponse(pathname: string, token: string) {
  const result = await get(pathname, {
    access: "private",
    token,
  });

  if (!result || result.statusCode === 304 || !result.stream) {
    return null;
  }

  return new Response(result.stream, {
    headers: {
      "cache-control": "private, max-age=300",
      "content-type": result.blob.contentType,
      etag: result.blob.etag,
    },
  });
}
