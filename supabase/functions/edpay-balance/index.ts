import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    const { edpayPublicKey, edpaySecretKey } = body;

    if (!edpayPublicKey || !edpaySecretKey) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: edpayPublicKey, edpaySecretKey" }), {
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
      return new Response(JSON.stringify({ error: "Falha na autenticação EdPay" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authData = await authResponse.json();
    const token = authData.token;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token não retornado pela EdPay" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get balance
    const balanceResponse = await fetch("https://api.edpay.me/balance", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!balanceResponse.ok) {
      const errText = await balanceResponse.text();
      return new Response(JSON.stringify({ error: "Falha ao consultar saldo", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const balanceData = await balanceResponse.json();
    console.log("EdPay balance response:", JSON.stringify(balanceData));

    return new Response(JSON.stringify({ success: true, data: balanceData }), {
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
