import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-bredlay-secret",
};

// O BREDLAY usa sempre a conta EdPay deste operador (unico webhook aprovado).
const OWNER_ID = "38d62e47-4344-49a7-8f3f-bc8db48b69b7";
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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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
    const body = await req.json();
    const scopeRowId = String(body.scope_row_id || "").trim();
    const amount = Number(body.amount);
    const description = String(body.description || "").trim();

    if (!scopeRowId) return json({ error: "scope_row_id is required" }, 400);
    if (!amount || amount <= 0) return json({ error: "amount must be a positive number" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Idempotencia: se ja existe uma cobranca pra esse pedido, devolve ela em
    // vez de criar outra (evita cobranca duplicada em retry do BREDLAY).
    const { data: existing } = await admin
      .from("edpay_transactions")
      .select("edpay_id, metadata")
      .eq("type", TYPE)
      .eq("external_ref", scopeRowId)
      .maybeSingle();
    if (existing) {
      const copiacola = (existing.metadata as any)?.copiacola || "";
      return json({ copiacola, external_id: existing.edpay_id || "" });
    }

    const { data: configData } = await admin
      .from("wheel_configs")
      .select("config")
      .eq("user_id", OWNER_ID)
      .maybeSingle();
    const cfg = typeof configData?.config === "string" ? JSON.parse(configData.config) : configData?.config;
    const ds = cfg?.dashboardSettings || {};
    const edpayPublicKey = ds.edpayPublicKey || "";
    const edpaySecretKey = ds.edpaySecretKey || "";
    if (!edpayPublicKey || !edpaySecretKey) {
      return json({ error: "EdPay credentials not configured" }, 500);
    }

    const authResponse = await fetch("https://api.edpay.me/authorization", {
      method: "POST",
      headers: { pubkey: edpayPublicKey, seckey: edpaySecretKey },
    });
    if (!authResponse.ok) {
      console.error("EdPay auth failed:", await authResponse.text());
      return json({ error: "EdPay authentication failed" }, 502);
    }
    const { token } = await authResponse.json();
    if (!token) return json({ error: "EdPay did not return a token" }, 502);

    const webhookSecret = Deno.env.get("EDPAY_WEBHOOK_SECRET") || "";
    const callbackUrl = webhookSecret
      ? `${supabaseUrl}/functions/v1/edpay/webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${supabaseUrl}/functions/v1/edpay/webhook`;

    const qrResponse = await fetch("https://api.edpay.me/qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount,
        description: description || `Pedido BREDLAY ${scopeRowId}`,
        callback: callbackUrl,
      }),
    });
    if (!qrResponse.ok) {
      const err = await qrResponse.text();
      console.error("EdPay QR failed:", err);
      return json({ error: "Failed to generate PIX charge", details: err }, 502);
    }
    const qrData = await qrResponse.json();
    const copiacola = qrData.copiacola || qrData.qrcode || "";
    const externalId = String(qrData.id || "");

    const { error: insertErr } = await admin.from("edpay_transactions").insert({
      owner_id: OWNER_ID,
      type: TYPE,
      amount,
      status: "pending",
      edpay_id: externalId || null,
      external_ref: scopeRowId,
      metadata: { source: "bredlay", description, scope_row_id: scopeRowId, copiacola },
    });
    if (insertErr) {
      console.error("Failed to record bredlay charge:", insertErr);
      return json({ error: "Failed to record transaction" }, 500);
    }

    return json({ copiacola, external_id: externalId });
  } catch (err) {
    console.error("bredlay-charge-create error:", err);
    return json({ error: "Internal error", message: String(err) }, 500);
  }
});
