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
    const { amount, address, edpayPublicKey, edpaySecretKey, description, callback } = body;

    if (!amount || !address || !edpayPublicKey || !edpaySecretKey) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: amount, address, edpayPublicKey, edpaySecretKey" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!address.startsWith("T") || address.length !== 34) {
      return new Response(JSON.stringify({ error: "Endereço TRC20 inválido. Deve começar com 'T' e ter 34 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Authenticate
    const authResponse = await fetch("https://api.edpay.me/authorization", {
      method: "POST",
      headers: { "pubkey": edpayPublicKey, "seckey": edpaySecretKey },
    });

    if (!authResponse.ok) {
      const errText = await authResponse.text();
      console.error("EdPay auth failed:", errText);
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

    // Step 2: Crypto withdraw
    const withdrawBody: Record<string, unknown> = { amount: Number(amount), address };
    if (description) withdrawBody.description = description;
    if (callback) withdrawBody.callback = callback;

    const withdrawResponse = await fetch("https://api.edpay.me/crypto-withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(withdrawBody),
    });

    if (!withdrawResponse.ok) {
      const errText = await withdrawResponse.text();
      console.error("EdPay crypto-withdraw failed:", errText);
      return new Response(JSON.stringify({ error: "Falha no saque crypto", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const withdrawData = await withdrawResponse.json();

    return new Response(JSON.stringify({ success: true, data: withdrawData }), {
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
