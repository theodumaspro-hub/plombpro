import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { registerRoutes } from "../server/routes";

let app: ReturnType<typeof express> | null = null;
let initPromise: Promise<void> | null = null;
let initError: string | null = null;

function createApp(): Promise<void> {
  app = express();

  app.use((req, res, next) => {
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

  return registerRoutes(app).then(() => {
    app!.use((err: any, _req: any, res: any, _next: any) => {
      console.error("API Error:", err);
      if (!res.headersSent) {
        res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
      }
    });
    console.log("[api/index] Routes registered successfully");
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!initPromise) {
      initPromise = createApp().catch((err) => {
        initError = err.stack || err.message || String(err);
        console.error("[api/index] Init failed:", initError);
      });
    }
    await initPromise;

    if (initError || !app) {
      return res.status(500).json({
        error: "Server initialization failed",
        detail: initError,
      });
    }

    return app(req as any, res as any);
  } catch (err: any) {
    console.error("[api/index] Handler error:", err);
    return res.status(500).json({
      error: "Handler error",
      message: err.message,
    });
  }
}
