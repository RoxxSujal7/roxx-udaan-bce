// Bundles Cloudflare Pages Functions into standalone CommonJS Vercel handlers under api/.
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROUTES = [
  { out: "api/registrations.js", fn: "functions/api/registrations.ts", exp: "onRequestPost" },
  { out: "api/admin/login.js", fn: "functions/api/admin/login.ts", exp: "onRequest" },
  { out: "api/admin/logout.js", fn: "functions/api/admin/logout.ts", exp: "onRequest" },
  { out: "api/admin/registrations.js", fn: "functions/api/admin/registrations.ts", exp: "onRequestGet" },
  { out: "api/admin/announcements.js", fn: "functions/api/admin/announcements.ts", exp: "onRequest" },
  { out: "api/admin/matches.js", fn: "functions/api/admin/matches.ts", exp: "onRequest" },
  { out: "api/admin/teams.js", fn: "functions/api/admin/teams.ts", exp: "onRequest" },
  { out: "api/admin/podiums.js", fn: "functions/api/admin/podiums.ts", exp: "onRequest" },
  { out: "api/admin/brackets.js", fn: "functions/api/admin/brackets.ts", exp: "onRequest" },
];

const esbuildBin = path.resolve("node_modules", ".bin", process.platform === "win32" ? "esbuild.cmd" : "esbuild");

for (const r of ROUTES) {
  const entry = `import { ${r.exp} as fn } from './${r.fn}'; import { toVercelHandler } from './lib/server/vercel-adapter.ts'; export default toVercelHandler(fn);`;
  execFileSync(
    esbuildBin,
    ["--bundle", "--platform=node", "--format=cjs", "--loader=ts", "--sourcefile=vercel-entry.ts", `--outfile=${r.out}`],
    { input: entry, stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" },
  );
}
