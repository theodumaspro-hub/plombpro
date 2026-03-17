import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// Minimal test route
app.get("/api/test", (_req, res) => {
  res.json({ ok: true, message: "Express works in serverless" });
});

// Test Supabase connection
app.get("/api/test/supabase", async (_req, res) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SECRET_KEY || ""
    );
    const { data, error } = await supabase.from("company_settings").select("id").limit(1);
    res.json({ ok: !error, data, error: error?.message });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
