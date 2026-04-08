import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const EDPAY_API_BASE = "https://api.edpay.me/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { paymentId, edpayPublicKey, edpaySecretKey } = body;

    if (!paymentId || !edpayPublicKey || !edpaySecretKey) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: paymentId, edpayPublicKey, edpaySecretKey" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read/update payment
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("prize_payments")
      .select("*")
      .eq("id", paymentId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "paid") {
      return new Response(JSON.stringify({ error: "Pagamento já realizado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment.pix_key) {
      return new Response(JSON.stringify({ error: "Inscrito não possui chave PIX cadastrada" }), {
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
      const errText = await authResponse.text();
      console.error("EdPay auth failed:", errText);
      return new Response(JSON.stringify({ error: "Falha na autenticação EdPay" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authData = await authResponse.json();
    const edpayToken = authData.token || authData.access_token || authData.data?.token;

    if (!edpayToken) {
      console.error("EdPay auth response:", JSON.stringify(authData));
      return new Response(JSON.stringify({ error: "Token EdPay não retornado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Execute PIX transfer
    const amountCents = Math.round(Number(payment.amount) * 100);
    const transferResponse = await fetch(`${EDPAY_API_BASE}/pix/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${edpayToken}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        pix_key: payment.pix_key,
        pix_key_type: payment.pix_key_type || "cpf",
        description: `Prêmio: ${payment.prize} - ${payment.user_name}`,
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferResponse.ok) {
      console.error("EdPay transfer failed:", JSON.stringify(transferData));

      // Update payment status to failed
      await supabaseAdmin
        .from("prize_payments")
        .update({
          status: "failed",
          notes: `Erro EdPay: ${JSON.stringify(transferData)}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      return new Response(JSON.stringify({ error: "Falha na transferência PIX", details: transferData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Update payment as paid
    const transactionId = transferData.id || transferData.transaction_id || transferData.data?.id || "";
    await supabaseAdmin
      .from("prize_payments")
      .update({
        status: "paid",
        edpay_transaction_id: String(transactionId),
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    return new Response(JSON.stringify({ success: true, data: transferData }), {
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
