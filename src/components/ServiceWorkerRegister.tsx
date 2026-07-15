"use client";

import { useEffect } from "react";

// Registers the service worker (F20) — production only, so local dev isn't
// affected by SW caching. Fails silently if unsupported.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
