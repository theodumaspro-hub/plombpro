import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";

// ─── Build Express app for Vercel Serverless ───────
const app = express();

// CORS for cross-origin requests (ElevenLabs, frontend, etc.)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin as string);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

// ─── Register all routes ───────────────────────────
let routesRegistered = false;
let routesError: Error | null = null;

const routesReady = registerRoutes(app)
  .then(() => {
    routesRegistered = true;
    console.log("[api/index] Routes registered successfully");
  })
  .catch((err) => {
    routesError = err;
    console.error("[api/index] Failed to register routes:", err);
  });

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("API Error:", err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  }
});

// ─── Vercel serverless handler ─────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Ensure routes are registered before handling
    if (!routesRegistered && !routesError) {
      await routesReady;
    }
    if (routesError) {
      console.error("[api/index] Routes failed:", routesError.message);
      return res.status(500).json({ 
        error: "Server initialization failed",
        detail: routesError.message 
      });
    }
    return app(req as any, res as any);
  } catch (err: any) {
    console.error("[api/index] Handler error:", err);
    return res.status(500).json({ 
      error: "Internal server error", 
      detail: err.message 
    });
  }
}
