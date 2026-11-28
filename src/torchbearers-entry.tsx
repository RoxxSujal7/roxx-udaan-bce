import React from "react";
import { createRoot } from "react-dom/client";
import { FrostedFolderLookbook } from "../components/ui/frosted-folder-lookbook";
import { FOLDERS } from "./torchbearers-data";

function TorchbearersApp() {
  const [openYear, setOpenYear] = React.useState<string | null>(null);
  const [closeGen, setCloseGen] = React.useState<Record<string, number>>({});

  const handleOpenChange = React.useCallback(
    (year: string, isOpen: boolean) => {
      if (isOpen) {
        setOpenYear(year);
        setCloseGen((prev) => {
          const next = { ...prev };
          for (const f of FOLDERS) {
            if (f.year !== year) {
              next[f.year] = (next[f.year] ?? 0) + 1;
            }
          }
          return next;
        });
      } else {
        setOpenYear((prev) => (prev === year ? null : prev));
      }
    },
    [],
  );

  return (
    <div className="tb-shell">
      <div className="tb-container">
        <header className="tb-masthead">
          <div className="tb-meta-bar">
            <span>
              <span className="tb-meta-accent">UDAAN</span> · BCE BHAGALPUR
            </span>
            <span>PRESIDENTS ARCHIVE · 2025–2026</span>
          </div>
          <div className="tb-title-row">
            <h1 className="tb-h1">TORCHBEARERS</h1>
            <p className="tb-subtitle">Presidents of UDAAN, past &amp; present</p>
          </div>
        </header>

        <div className="tb-grid">
          {FOLDERS.map((folder, index) => {
            const gen = closeGen[folder.year] ?? 0;
            const isOpen = openYear === folder.year;
            return (
              <section
                key={folder.year}
                className="tb-slot"
                data-open={isOpen ? "true" : "false"}
                aria-label={`${folder.year} President Folder`}
              >
                <div className="tb-slot-head">
                  <span className="tb-slot-year">{folder.year}</span>
                  <span className="tb-slot-tag">
                    {index === 0 ? "Current" : "Past"} · {isOpen ? "Open" : "Archive"}
                  </span>
                </div>
                <div className="tb-folder-wrap">
                  <FrostedFolderLookbook
                    key={`${folder.year}-${gen}`}
                    className="tb-folder"
                    title={folder.year}
                    subtitle={folder.subtitle}
                    line={folder.line}
                    footer="Handle with pride"
                    wordmark="UDAAN"
                    sheets={folder.sheets}
                    openLabel={`Open ${folder.year}`}
                    closeLabel={`Close ${folder.year}`}
                    tint="#ee5622"
                    background="#0e1014"
                    height="85svh"
                    defaultOpen={isOpen}
                    onOpenChange={(nextOpen) => handleOpenChange(folder.year, nextOpen)}
                  />
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const mount = document.getElementById("torchbearers-root");
if (mount) {
  createRoot(mount).render(
    <React.StrictMode>
      <TorchbearersApp />
    </React.StrictMode>,
  );
}
