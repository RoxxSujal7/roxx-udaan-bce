import type { FolderSheet } from "../components/ui/frosted-folder-lookbook";

export interface TorchbearerFolder {
  year: string;
  subtitle: string;
  line: string;
  sheets: FolderSheet[];
}

// Easy-to-edit list of UDAAN Presidents grouped by year (newest first).
// Replace the 2026 demo logo entry with the 2026 President's photo & name when ready.
export const FOLDERS: TorchbearerFolder[] = [
  {
    year: "2026",
    subtitle: "Presidents of UDAAN",
    line: "Bhagalpur College of Engineering · 2026",
    sheets: [
      {
        image: "/Assets/presidents/2026-demo-logo.jpg",
        alt: "UDAAN 2026 Demo Logo",
        code: "President",
        title: "UDAAN 2026",
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
        image: "/Assets/presidents/2025-akash-deep.jpg",
        alt: "Akash Deep",
        code: "President",
        title: "Akash Deep",
        detail: "UDAAN 2025",
      },
    ],
  },
];
