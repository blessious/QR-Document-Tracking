import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let cancelled = false;
    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((nextRegistration) => {
        if (cancelled) return;
        registration = nextRegistration;
        document.addEventListener("visibilitychange", updateWhenVisible);
      })
      .catch((error) => {
        console.warn("Could not register the service worker.", error);
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, []);

  return null;
}
