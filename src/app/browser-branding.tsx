"use client";

import { useEffect } from "react";

const fallbackTitle = "SIXRAM NextGen AutoHub";
const loginSettingsUpdatedEvent = "login-settings-updated";
const brandedFaviconSelector = "link[rel='icon'][data-browser-branding='true']";

type BrowserBranding = {
  companyName?: string;
  logoUrl?: string;
};

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }

  return "";
}

function getLoginSettingsBranding(payload: unknown): BrowserBranding {
  if (!payload || typeof payload !== "object") return {};

  const record = payload as Record<string, unknown>;

  return {
    companyName: readString(record.companyName, record.CompanyName) || undefined,
    logoUrl:
      readString(record.logoUrl, record.logo, record.LogoUrl, record.Logo) ||
      undefined,
  };
}

async function fetchJson(path: string) {
  const response = await fetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return null;

  return response.json() as Promise<unknown>;
}

function getOrCreateBrandedFavicon() {
  const existing = document.querySelector<HTMLLinkElement>(
    brandedFaviconSelector,
  );

  if (existing) return existing;

  const link = document.createElement("link");
  link.rel = "icon";
  link.setAttribute("data-browser-branding", "true");
  document.head.appendChild(link);
  return link;
}

function removeBrandedFavicon() {
  document
    .querySelectorAll<HTMLLinkElement>(brandedFaviconSelector)
    .forEach((link) => link.remove());
}

function applyBrowserBranding(branding: BrowserBranding) {
  document.title = branding.companyName || fallbackTitle;

  if (branding.logoUrl) {
    getOrCreateBrandedFavicon().href = branding.logoUrl;
  } else {
    removeBrandedFavicon();
  }
}

export default function BrowserBranding() {
  useEffect(() => {
    let mounted = true;

    const loadBranding = async () => {
      try {
        const settings = await fetchJson("/api/login-settings");

        if (!mounted) return;

        applyBrowserBranding(getLoginSettingsBranding(settings));
      } catch {
        if (mounted) applyBrowserBranding({});
      }
    };

    const handleLoginSettingsUpdated = (event: Event) => {
      const branding = getLoginSettingsBranding(
        (event as CustomEvent<unknown>).detail,
      );
      applyBrowserBranding(branding);
    };

    void loadBranding();
    window.addEventListener(
      loginSettingsUpdatedEvent,
      handleLoginSettingsUpdated,
    );

    return () => {
      mounted = false;
      window.removeEventListener(
        loginSettingsUpdatedEvent,
        handleLoginSettingsUpdated,
      );
    };
  }, []);

  return null;
}
