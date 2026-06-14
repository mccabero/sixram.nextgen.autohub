import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { JsonRecord } from "@/server/api/body";
import {
  findUploadedImageFile,
  getFileVersion,
  getUploadsRoot,
  readJsonFile,
} from "@/server/api/uploads";
import {
  findBlobImageByPrefix,
  getPublicBlobToken,
} from "@/server/storage/blob-images";

type LoginSettingsFileModel = {
  companyName?: string | null;
  showIsChanganOption?: boolean | null;
  termsAndConditions?: string | null;
  privacyPolicy?: string | null;
  cameraEventCooldownSeconds?: number | null;
};

const settingsBlobPath = "login/login-settings.json";

function normalizeCameraEventCooldown(value: number | null | undefined) {
  const fallback = Number.isFinite(value) ? Number(value) : 60;
  return Math.min(Math.max(fallback, 0), 3600);
}

function getLoginUploadsDir() {
  return path.join(getUploadsRoot(), "login");
}

async function buildAssetUrl(prefix: string, routeSegment: string) {
  const token = getPublicBlobToken();

  if (token) {
    const blob = await findBlobImageByPrefix(`login/${prefix}`, token);
    if (blob) return blob.url;
  }

  const asset = findUploadedImageFile(getLoginUploadsDir(), prefix);

  if (!asset) {
    return null;
  }

  return `/api/login-settings/${routeSegment}?v=${getFileVersion(asset.fullPath)}`;
}

async function readBlobSettings(token: string) {
  const result = await get(settingsBlobPath, {
    access: "public",
    token,
  });

  if (!result || result.statusCode === 304 || !result.stream) {
    return {};
  }

  try {
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as LoginSettingsFileModel;
  } catch {
    return {};
  }
}

function readLocalSettings() {
  return readJsonFile<LoginSettingsFileModel>(
    path.join(getLoginUploadsDir(), "login-settings.json"),
    {},
  );
}

async function readSettings() {
  const token = getPublicBlobToken();
  if (token) return readBlobSettings(token);
  return readLocalSettings();
}

async function writeSettings(settings: LoginSettingsFileModel) {
  const token = getPublicBlobToken();

  if (token) {
    await put(settingsBlobPath, JSON.stringify(settings, null, 2), {
      access: "public",
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
      token,
    });
    return;
  }

  const file = path.join(getLoginUploadsDir(), "login-settings.json");
  mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ file, JSON.stringify(settings, null, 2));
}

export async function getLoginSettingsPayload() {
  const settings = await readSettings();
  const [backgroundImageUrl, logoUrl] = await Promise.all([
    buildAssetUrl("login_background", "background"),
    buildAssetUrl("login_logo", "logo"),
  ]);

  return {
    companyName: settings.companyName ?? null,
    showIsChanganOption: settings.showIsChanganOption ?? true,
    termsAndConditions: settings.termsAndConditions ?? null,
    privacyPolicy: settings.privacyPolicy ?? null,
    cameraEventCooldownSeconds: normalizeCameraEventCooldown(
      settings.cameraEventCooldownSeconds,
    ),
    backgroundImageUrl,
    logoUrl,
  };
}

export async function updateLoginSettings(body: JsonRecord) {
  const current = await readSettings();
  const next: LoginSettingsFileModel = {
    ...current,
  };

  if (hasField(body, "companyName", "CompanyName")) {
    next.companyName = readString(body, "companyName", "CompanyName");
  }

  if (hasField(body, "showIsChanganOption", "ShowIsChanganOption")) {
    next.showIsChanganOption =
      readBoolean(body, "showIsChanganOption", "ShowIsChanganOption") ?? true;
  }

  if (hasField(body, "termsAndConditions", "TermsAndConditions")) {
    next.termsAndConditions = readString(
      body,
      "termsAndConditions",
      "TermsAndConditions",
    );
  }

  if (hasField(body, "privacyPolicy", "PrivacyPolicy")) {
    next.privacyPolicy = readString(body, "privacyPolicy", "PrivacyPolicy");
  }

  if (hasField(body, "cameraEventCooldownSeconds", "CameraEventCooldownSeconds")) {
    next.cameraEventCooldownSeconds = normalizeCameraEventCooldown(
      readNumber(body, "cameraEventCooldownSeconds", "CameraEventCooldownSeconds"),
    );
  }

  await writeSettings(next);
  return getLoginSettingsPayload();
}

function readString(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
  }

  return null;
}

function readBoolean(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
  }

  return null;
}

function readNumber(body: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    const numberValue =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;

    if (Number.isFinite(numberValue)) return numberValue;
  }

  return null;
}

function hasField(body: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.hasOwn(body, key));
}
