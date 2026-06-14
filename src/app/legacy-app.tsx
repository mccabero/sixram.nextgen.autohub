"use client";

import "@/legacy/config/fetchWrapper";
import { BrowserRouter } from "react-router-dom";
import App from "@/legacy/App";
import { AuthProvider } from "@/legacy/auth/useAuth";
import { LoadingProvider } from "@/legacy/contexts/loading";
import { ToastProvider } from "@/legacy/contexts/toast";
import { setupChunkLoadRecovery } from "@/legacy/utils/chunkLoadRecovery";

if (typeof window !== "undefined") {
  setupChunkLoadRecovery();
}

export default function LegacyApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LoadingProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </LoadingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
