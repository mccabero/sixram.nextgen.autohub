import path from "node:path";
import {
  findUploadedImageFile,
  getFileVersion,
  getUploadsRoot,
  readJsonFile,
} from "@/server/api/uploads";

type LoginSettingsFileModel = {
  companyName?: string | null;
  showIsChanganOption?: boolean | null;
  termsAndConditions?: string | null;
  privacyPolicy?: string | null;
  cameraEventCooldownSeconds?: number | null;
};

function normalizeCameraEventCooldown(value: number | null | undefined) {
  const fallback = Number.isFinite(value) ? Number(value) : 60;
  return Math.min(Math.max(fallback, 0), 3600);
}

function getLoginUploadsDir() {
  return path.join(getUploadsRoot(), "login");
}

function buildAssetUrl(prefix: string, routeSegment: string) {
  const asset = findUploadedImageFile(getLoginUploadsDir(), prefix);

  if (!asset) {
    return null;
  }

  return `/api/login-settings/${routeSegment}?v=${getFileVersion(asset.fullPath)}`;
}

function readSettings() {
  return readJsonFile<LoginSettingsFileModel>(
    path.join(getLoginUploadsDir(), "login-settings.json"),
    {},
  );
}

export function getLoginSettingsPayload() {
  const settings = readSettings();

  return {
    companyName: settings.companyName ?? null,
    showIsChanganOption: settings.showIsChanganOption ?? true,
    termsAndConditions: settings.termsAndConditions ?? null,
    privacyPolicy: settings.privacyPolicy ?? null,
    cameraEventCooldownSeconds: normalizeCameraEventCooldown(
      settings.cameraEventCooldownSeconds,
    ),
    backgroundImageUrl: buildAssetUrl("login_background", "background"),
    logoUrl: buildAssetUrl("login_logo", "logo"),
  };
}
