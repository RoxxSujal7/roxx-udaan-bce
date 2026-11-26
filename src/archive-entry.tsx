import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArchivePage } from "@/src/archive/archive-page";

const rootEl = document.getElementById("archive-root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ArchivePage />
    </StrictMode>,
  );
}
