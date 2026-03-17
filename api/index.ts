import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;
let initError: string | null = null;

// Lazy init — catch any import/init errors
async function getApp() {
  if (app) return app;
  if (initError) throw new Error(initError);

  try {
    const express = (await import("express")).default;
    const { registerRoutes } = await import("../server/routes");

    app = express();

    // CORS
    app.use((req: any, res: any, next: any) => {
      const origin = req.headers.origin || "*";
      res.setHeader("Access-Control-Allow-Origin", origin);
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

    await registerRoutes(app);

    // Error handler
    app.use((err: any, _req: any, res: any, _next: any) => {
      console.error("API Error:", err);
      if (!res.headersSent) {
        res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
      }
    });

    console.log("[api/index] App initialized successfully");
    return app;
  } catch (err: any) {
    initError = err.stack || err.message || String(err);
    console.error("[api/index] Init failed:", initError);
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await getApp();
    return expressApp(req as any, res as any);
  } catch (err: any) {
    console.error("[api/index] Handler error:", err);
    return res.status(500).json({
      error: "Server initialization failed",
      message: err.message || String(err),
      stack: err.stack,
      initError: initError,
    });
  }
}
