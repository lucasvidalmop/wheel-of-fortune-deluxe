import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-bredlay-secret",
};

const TYPE = "bredlay_order";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const sharedSecret = Deno.env.get("BREDLAY_SHARED_SECRET");
  if (!sharedSecret) {
    console.error("BREDLAY_SHARED_SECRET not configured");
    return json({ error: "Not configured" }, 503);
  }
  const provided = req.headers.get("x-bredlay-secret") || "";
  if (!provided || !safeEqual(provided, sharedSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const url = new URL(req.url);
    const scopeRowId = String(url.searchParams.get("scope_row_id") || "").trim();
    if (!scopeRowId) return json({ error: "scope_row_id is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tx } = await admin
      .from("edpay_transactions")
      .select("status, updated_at")
      .eq("type", TYPE)
      .eq("external_ref", scopeRowId)
      .maybeSingle();

    if (!tx) return json({ error: "Charge not found" }, 404);

    return json({
      status: tx.status,
      paid_at: tx.status === "paid" ? tx.updated_at : null,
    });
  } catch (err) {
    console.error("bredlay-charge-status error:", err);
    return json({ error: "Internal error", message: String(err) }, 500);
  }
});
