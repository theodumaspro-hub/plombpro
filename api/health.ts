import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? "set" : "missing",
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ? "set" : "missing",
      NODE_ENV: process.env.NODE_ENV || "not set",
    }
  });
}
