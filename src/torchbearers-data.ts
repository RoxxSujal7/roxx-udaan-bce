import type { FolderSheet } from "../components/ui/frosted-folder-lookbook";

export interface TorchbearerFolder {
  year: string;
  subtitle: string;
  line: string;
  sheets: FolderSheet[];
}

// Easy-to-edit list of UDAAN Presidents grouped by year (newest first).
// Replace placeholder entries with real names, tenures, and photos in Assets/presidents/.
export const FOLDERS: TorchbearerFolder[] = [
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
        detail: "UDAAN 2025–26",
      },
    ],
  },
  {
    year: "2024",
    subtitle: "Presidents of UDAAN",
    line: "Bhagalpur College of Engineering · 2024",
    sheets: [
      {
        image: "/Assets/presidents/placeholder.svg",
        alt: "Name TBD",
        code: "President",
        title: "Name TBD",
        detail: "UDAAN 2024–25",
      },
    ],
  },
  {
    year: "2023",
    subtitle: "Presidents of UDAAN",
    line: "Bhagalpur College of Engineering · 2023",
    sheets: [
      {
        image: "/Assets/presidents/placeholder.svg",
        alt: "Name TBD",
        code: "President",
        title: "Name TBD",
        detail: "UDAAN 2023–24",
      },
    ],
  },
];
