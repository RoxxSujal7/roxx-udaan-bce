import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveBoard } from "@/src/live/live-board";

const rootEl = document.getElementById("live-board-root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <LiveBoard />
    </StrictMode>,
  );
}
