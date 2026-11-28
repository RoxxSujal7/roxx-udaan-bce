import type { FolderSheet } from "../components/ui/frosted-folder-lookbook";

export interface TorchbearerFolder {
  year: string;
  subtitle: string;
  line: string;
  sheets: FolderSheet[];
}

// Easy-to-edit list of UDAAN Presidents grouped by year (newest first).
export const FOLDERS: TorchbearerFolder[] = [
  {
    year: "2026",
    subtitle: "Presidents of UDAAN",
    line: "Bhagalpur College of Engineering · 2026",
    sheets: [
      {
        image: "/Assets/presidents/2026-akash-deep.jpg",
        alt: "Akash Deep",
        code: "President",
        title: "Akash Deep",
        detail: "UDAAN 2026",
      },
    ],
  },
  {
    year: "2025",
    subtitle: "Presidents of UDAAN",
    line: "Bhagalpur College of Engineering · 2025",
    sheets: [
      {
        image: "/Assets/presidents/2025-avineesh-kumar.jpg",
        alt: "Avineesh Kumar",
        code: "President",
        title: "Avineesh Kumar",
        detail: "CSE 22-26 · UDAAN 2025",
      },
      {
        image: "/Assets/presidents/2025-anmol-ratan.jpg",
        alt: "Anmol Ratan",
        code: "Vice President",
        title: "Anmol Ratan",
        detail: "UDAAN 2025",
      },
    ],
  },
];
