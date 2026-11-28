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
    <div style={{ background: "#111216", paddingTop: "6rem", paddingBottom: "3rem" }}>
      <header
        style={{
          textAlign: "center",
          padding: "0 1.25rem 2rem",
          fontFamily: '"Montserrat", sans-serif',
        }}
      >
        <h1
          className="sec-header"
          style={{
            margin: 0,
            color: "#ffffff",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          TORCHBEARERS
        </h1>
        <p
          style={{
            margin: "0.75rem auto 0",
            maxWidth: "34rem",
            fontSize: "1rem",
            color: "#b4b8c5",
            lineHeight: 1.6,
          }}
        >
          Presidents of UDAAN, past &amp; present
        </p>
      </header>

      <div>
        {FOLDERS.map((folder) => {
          const gen = closeGen[folder.year] ?? 0;
          return (
            <div key={folder.year} style={{ minHeight: "560px" }}>
              <FrostedFolderLookbook
                key={`${folder.year}-${gen}`}
                title={folder.year}
                subtitle={folder.subtitle}
                line={folder.line}
                footer="Handle with pride"
                wordmark="UDAAN"
                sheets={folder.sheets}
                openLabel={`Open ${folder.year}`}
                closeLabel={`Close ${folder.year}`}
                tint="#ff6b2b"
                background="#111216"
                height="85svh"
                defaultOpen={openYear === folder.year}
                onOpenChange={(isOpen) => handleOpenChange(folder.year, isOpen)}
              />
            </div>
          );
        })}
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
