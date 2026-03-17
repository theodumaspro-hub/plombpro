import { execSync } from "child_process";
import { writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = process.cwd();
const OUT = join(ROOT, ".vercel/output");
const FRONTEND_OUT = join(ROOT, "dist/public");

// Clean previous output
execSync(`rm -rf ${OUT}`);
execSync(`rm -rf ${FRONTEND_OUT}`);

// ─── Step 1: Build frontend with Vite ───────────────────────────
console.log("=== Step 1: Building frontend ===");
execSync("npx vite build", { stdio: "inherit", cwd: ROOT });

// Verify frontend output exists
if (!existsSync(FRONTEND_OUT)) {
  console.error("ERROR: Frontend build output not found at", FRONTEND_OUT);
  process.exit(1);
}
console.log("Frontend built to:", FRONTEND_OUT);
console.log("Files:", readdirSync(FRONTEND_OUT).slice(0, 10));

// ─── Step 2: Bundle API functions with esbuild ──────────────────
console.log("=== Step 2: Bundling API functions ===");

const functions = [
  { src: "api/index.ts", name: "api/index" },
  { src: "api/health.ts", name: "api/health" },
];

for (const fn of functions) {
  const fnDir = join(OUT, "functions", `${fn.name}.func`);
  mkdirSync(fnDir, { recursive: true });

  console.log(`Bundling ${fn.src} -> ${fnDir}/index.cjs`);
  execSync(
    `npx esbuild ${fn.src} --bundle --platform=node --target=node18 --format=cjs --outfile=${fnDir}/index.cjs --log-level=info`,
    { stdio: "inherit", cwd: ROOT }
  );

  writeFileSync(join(fnDir, ".vc-config.json"), JSON.stringify({
    runtime: "nodejs18.x",
    handler: "index.cjs",
    launcherType: "Nodejs",
    maxDuration: 30,
  }));
  console.log(`  ✓ ${fn.name} bundled`);
}

// ─── Step 3: Copy static frontend files ─────────────────────────
console.log("=== Step 3: Copying static output ===");
const staticDir = join(OUT, "static");
mkdirSync(staticDir, { recursive: true });
cpSync(FRONTEND_OUT, staticDir, { recursive: true });
console.log("Static files copied:", readdirSync(staticDir).slice(0, 10));

// ─── Step 4: Write Build Output API config ──────────────────────
console.log("=== Step 4: Writing config.json ===");
writeFileSync(join(OUT, "config.json"), JSON.stringify({
  version: 3,
  routes: [
    { src: "/api/health", dest: "/api/health" },
    { src: "/api/(.*)", dest: "/api/index" },
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/index.html" },
  ],
}, null, 2));

console.log("=== Build complete ===");
console.log("Output structure:");
execSync(`find ${OUT} -maxdepth 4 -type f | head -20`, { stdio: "inherit" });
