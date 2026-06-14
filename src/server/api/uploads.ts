import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const allowedImageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export function getUploadsRoot() {
  return "uploads";
}

export function findUploadedImageFile(directory: string, prefix: string) {
  for (const extension of allowedImageExtensions) {
    const fileName = `${prefix}${extension}`;
    const fullPath = path.join(directory, fileName);

    if (existsSync(/*turbopackIgnore: true*/ fullPath)) {
      return { fileName, fullPath, extension };
    }
  }

  return null;
}

export function getFileVersion(fullPath: string) {
  return statSync(/*turbopackIgnore: true*/ fullPath)
    .mtimeMs.toString()
    .replace(".", "");
}

export function readJsonFile<T>(fullPath: string, fallback: T): T {
  if (!existsSync(/*turbopackIgnore: true*/ fullPath)) {
    return fallback;
  }

  try {
    return JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ fullPath, "utf8"),
    ) as T;
  } catch {
    return fallback;
  }
}
