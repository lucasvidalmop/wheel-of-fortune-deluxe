import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { ownerId, amount, description, userName, userPhone, userAccountId } = body;

    if (!ownerId || !amount) {
      return new Response(JSON.stringify({ error: "ownerId e amount são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountNum = Number(amount);
    if (amountNum < 1) {
      return new Response(JSON.stringify({ error: "Valor mínimo: R$ 1,00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch operator's EdPay keys from wheel_configs
    const { data: configData } = await supabaseAdmin
      .from("wheel_configs")
      .select("config")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (!configData?.config) {
      return new Response(JSON.stringify({ error: "Configuração do operador não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = typeof configData.config === "string" ? JSON.parse(configData.config) : configData.config;
    const dashSettings = cfg.dashboardSettings || {};
    const edpayPublicKey = dashSettings.edpayPublicKey || "";
    const edpaySecretKey = dashSettings.edpaySecretKey || "";

    if (!edpayPublicKey || !edpaySecretKey) {
      return new Response(JSON.stringify({ error: "Credenciais de pagamento não configuradas pelo operador" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate deposit config
    const depositConfig = cfg.depositConfig || {};
    if (!depositConfig.enabled) {
      return new Response(JSON.stringify({ error: "Página de depósito não está ativa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const minValue = depositConfig.minimumValue || 1;
    if (amountNum < minValue) {
      return new Response(JSON.stringify({ error: `Valor mínimo: R$ ${minValue.toFixed(2)}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Authenticate with EdPay
    const authResponse = await fetch("https://api.edpay.me/authorization", {
      method: "POST",
      headers: {
        "pubkey": edpayPublicKey,
        "seckey": edpaySecretKey,
      },
    });

    if (!authResponse.ok) {
      console.error("EdPay auth failed:", await authResponse.text());
      return new Response(JSON.stringify({ error: "Falha na autenticação com sistema de pagamento" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authData = await authResponse.json();
    const token = authData.token;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token de pagamento não retornado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Generate QR Code PIX
    const descText = description || `Depósito - ${userName || "Cliente"}`;
    const webhookSecret = Deno.env.get("EDPAY_WEBHOOK_SECRET") || "";
    const callbackUrl = webhookSecret
      ? `${supabaseUrl}/functions/v1/edpay/webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${supabaseUrl}/functions/v1/edpay/webhook`;

    const qrResponse = await fetch("https://api.edpay.me/qrcode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: amountNum,
        description: descText,
        callback: callbackUrl,
      }),
    });

    if (!qrResponse.ok) {
      const qrErr = await qrResponse.text();
      console.error("EdPay QR failed:", qrErr);
      return new Response(JSON.stringify({ error: "Falha ao gerar QR Code", details: qrErr }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qrData = await qrResponse.json();

    // Log the deposit transaction
    await supabaseAdmin.from("edpay_transactions").insert({
      owner_id: ownerId,
      type: "deposit_public",
      amount: amountNum,
      status: "pending",
      edpay_id: qrData.id || null,
      metadata: {
        userName: userName || "",
        userPhone: userPhone || "",
        userAccountId: userAccountId || "",
        description: descText,
      },
    });

    return new Response(JSON.stringify({ success: true, data: qrData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
