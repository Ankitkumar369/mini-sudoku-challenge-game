export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const swEnabled = import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW === "true";

  window.addEventListener("load", () => {
    if (!swEnabled) {
      // Safety mode: clear stale service workers/caches that can cause blank screens after deploy.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});

      if ("caches" in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith("daily-puzzle-"))
                .map((key) => caches.delete(key))
            )
          )
          .catch(() => {});
      }

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
