"use client";

import dynamic from "next/dynamic";

const LegacyApp = dynamic(() => import("../legacy-app"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Loading...
    </div>
  ),
});

export default function LegacyCatchAllPage() {
  return <LegacyApp />;
}

