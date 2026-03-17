import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const results: Record<string, string> = {};

  // Test each heavy import individually
  try {
    await import("../server/supabaseClient");
    results.supabaseClient = "OK";
  } catch (e: any) {
    results.supabaseClient = `FAIL: ${e.message}`;
  }

  try {
    await import("../server/storage");
    results.storage = "OK";
  } catch (e: any) {
    results.storage = `FAIL: ${e.message}`;
  }

  try {
    await import("../server/emailService");
    results.emailService = "OK";
  } catch (e: any) {
    results.emailService = `FAIL: ${e.message}`;
  }

  try {
    await import("../server/devisTemplates");
    results.devisTemplates = "OK";
  } catch (e: any) {
    results.devisTemplates = `FAIL: ${e.message}`;
  }

  try {
    await import("../server/pdfGenerator");
    results.pdfGenerator = "OK";
  } catch (e: any) {
    results.pdfGenerator = `FAIL: ${e.message}`;
  }

  try {
    await import("../server/integrationRoutes");
    results.integrationRoutes = "OK";
  } catch (e: any) {
    results.integrationRoutes = `FAIL: ${e.message}`;
  }

  try {
    await import("../server/whatsappApiRoutes");
    results.whatsappApiRoutes = "OK";
  } catch (e: any) {
    results.whatsappApiRoutes = `FAIL: ${e.message}`;
  }

  try {
    await import("../server/routes");
    results.routes = "OK";
  } catch (e: any) {
    results.routes = `FAIL: ${e.message}`;
  }

  return res.status(200).json(results);
}
