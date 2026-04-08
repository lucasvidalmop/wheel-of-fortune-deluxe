import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const EDPAY_API_BASE = "https://api.edpay.me/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { amount, edpayPublicKey, edpaySecretKey, description } = body;

    if (!amount || !edpayPublicKey || !edpaySecretKey) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: amount, edpayPublicKey, edpaySecretKey" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountCents = Math.round(Number(amount) * 100);
    if (amountCents < 100) {
      return new Response(JSON.stringify({ error: "Valor mínimo: R$ 1,00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Authenticate with EdPay
    const authResponse = await fetch(`${EDPAY_API_BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_key: edpayPublicKey,
        secret_key: edpaySecretKey,
      }),
    });

    if (!authResponse.ok) {
      const authErr = await authResponse.text();
      console.error("EdPay auth failed:", authErr);
      return new Response(JSON.stringify({ error: "Falha na autenticação EdPay. Verifique suas credenciais." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authData = await authResponse.json();
    const token = authData.token || authData.access_token || authData.data?.token;

    if (!token) {
      console.error("EdPay auth response:", JSON.stringify(authData));
      return new Response(JSON.stringify({ error: "Token não retornado pela EdPay", debug: authData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Generate QR Code PIX
    const qrResponse = await fetch(`${EDPAY_API_BASE}/pix/qrcode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        description: description || "Depósito via Roleta",
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
