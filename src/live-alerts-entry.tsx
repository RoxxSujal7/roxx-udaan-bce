import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveAlerts } from "@/src/live/live-alerts";

function mountAlerts() {
  let rootEl = document.getElementById("udaan-alerts-root");
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "udaan-alerts-root";
    document.body.appendChild(rootEl);
  }
  createRoot(rootEl).render(
    <StrictMode>
      <LiveAlerts />
    </StrictMode>,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAlerts, { once: true });
} else {
  mountAlerts();
}
