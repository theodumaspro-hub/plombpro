import { execSync } from "child_process";
import { unlinkSync } from "fs";

// Step 1: Bundle API functions with esbuild (CJS, self-contained)
console.log("Bundling API functions...");
execSync("npx esbuild api/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=api/index.js --external:@vercel/node", { stdio: "inherit" });
execSync("npx esbuild api/health.ts --bundle --platform=node --target=node18 --format=cjs --outfile=api/health.js --external:@vercel/node", { stdio: "inherit" });

// Remove .ts so Vercel uses the bundled .js
unlinkSync("api/index.ts");
unlinkSync("api/health.ts");

// Step 2: Build frontend
console.log("Building frontend...");
execSync("npx vite build --outDir ../public", { stdio: "inherit" });
