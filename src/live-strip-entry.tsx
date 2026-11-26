import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveStrip } from "@/src/live/live-strip";

const rootEl = document.getElementById("live-strip-root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <LiveStrip />
    </StrictMode>,
  );
}
