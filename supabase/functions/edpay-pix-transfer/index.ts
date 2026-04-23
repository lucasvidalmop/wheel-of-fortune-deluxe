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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { paymentId, autoPayment } = body;
    let { edpayPublicKey, edpaySecretKey } = body;

    if (!paymentId) {
      return new Response(JSON.stringify({ error: "paymentId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment record (using service role for auto-payment support)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("prize_payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch owner's wheel_config (needed for EdPay keys and notification settings)
    const { data: configData } = await supabaseAdmin
      .from("wheel_configs")
      .select("config")
      .eq("user_id", payment.owner_id)
      .maybeSingle();

    // For auto-payment or when keys not provided, use config keys
    if (autoPayment || !edpayPublicKey || !edpaySecretKey) {
      if (configData?.config) {
        const cfg = typeof configData.config === "string" ? JSON.parse(configData.config) : configData.config;
        const dashSettings = cfg.dashboardSettings || {};
        edpayPublicKey = edpayPublicKey || dashSettings.edpayPublicKey || "";
        edpaySecretKey = edpaySecretKey || dashSettings.edpaySecretKey || "";
      }
    }

    // If not auto-payment, verify the caller is the owner
    if (!autoPayment) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user || user.id !== payment.owner_id) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!edpayPublicKey || !edpaySecretKey) {
      return new Response(JSON.stringify({ error: "Credenciais EdPay não configuradas" }), {
        status: 400,
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
    const edpayToken = authData.token;

    if (!edpayToken) {
      console.error("EdPay auth response:", JSON.stringify(authData));
      return new Response(JSON.stringify({ error: "Token EdPay não retornado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Execute PIX transfer
    const pixTypeMap: Record<string, string> = {
      cpf: "CPF",
      cnpj: "CNPJ",
      email: "EMAIL",
      telefone: "TELEFONE",
      phone: "TELEFONE",
      aleatoria: "CHAVE_ALEATORIA",
      random: "CHAVE_ALEATORIA",
    };
    const pixType = pixTypeMap[(payment.pix_key_type || "cpf").toLowerCase()] || "CPF";

    const webhookSecret = Deno.env.get("EDPAY_WEBHOOK_SECRET") || "";
    const webhookUrl = webhookSecret
      ? `${supabaseUrl}/functions/v1/edpay/webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${supabaseUrl}/functions/v1/edpay/webhook`;

    const transferResponse = await fetch("https://api.edpay.me/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${edpayToken}`,
      },
      body: JSON.stringify({
        amount: Number(payment.amount),
        pix_type: pixType,
        pix_key: payment.pix_key,
        callback: webhookUrl,
      }),
    });

    const transferData = await transferResponse.json();
    console.log("EdPay transfer response:", JSON.stringify(transferData));

    // Check both HTTP status AND response body for failure indicators
    const transferStatus = (transferData.status || "").toString().toLowerCase();
    const transferError = transferData.error || transferData.message || transferData.msg || "";
    const isInsufficient = transferStatus === "insufficient_funds" ||
      transferStatus === "failed" ||
      transferStatus === "error" ||
      transferStatus === "rejected" ||
      transferStatus === "declined" ||
      transferStatus === false ||
      transferData.status === false ||
      (typeof transferError === "string" && transferError.toLowerCase().includes("saldo")) ||
      (typeof transferError === "string" && transferError.toLowerCase().includes("insufficient")) ||
      (typeof transferError === "string" && transferError.toLowerCase().includes("balance"));

    if (!transferResponse.ok || isInsufficient) {
      console.error("EdPay transfer failed:", JSON.stringify(transferData));
      await supabaseAdmin
        .from("prize_payments")
        .update({
          status: "failed",
          auto_payment: false,
          notes: `Falha EdPay: ${JSON.stringify(transferData)}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      return new Response(JSON.stringify({ error: "Falha na transferência PIX", details: transferData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Check if EdPay already confirmed the transfer immediately
    const transactionId = transferData.id || transferData.transaction_id || transferData.data?.id || "";
    const isAlreadyConfirmed = transferStatus === "confirmed" ||
      transferStatus === "completed" ||
      transferStatus === "approved" ||
      transferStatus === "success" ||
      transferStatus === "paid";

    // If response is successful (HTTP 200) and has a transaction ID but no explicit pending/processing status,
    // treat it as confirmed — EdPay returns just {id} for successful transfers
    const isImplicitlyConfirmed = !isAlreadyConfirmed &&
      transferResponse.ok &&
      transactionId &&
      transferStatus !== "pending" &&
      transferStatus !== "processing" &&
      transferStatus !== "waiting";

    if (isAlreadyConfirmed || isImplicitlyConfirmed) {
      await supabaseAdmin
        .from("prize_payments")
        .update({
          status: "paid",
          edpay_transaction_id: String(transactionId),
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
    } else {
      // Set as processing and wait for webhook confirmation
      await supabaseAdmin
        .from("prize_payments")
        .update({
          status: "processing",
          edpay_transaction_id: String(transactionId),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
    }

    // Step 4: Send auto-payment notification if configured
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-owner-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({
          ownerId: payment.owner_id,
          type: "payment_auto",
          payload: {
            userName: payment.user_name,
            userEmail: payment.user_email,
            prize: payment.prize,
            amount: payment.amount,
            pixKey: payment.pix_key,
          },
        }),
      });
    } catch (notifyErr) {
      console.error("Failed to send auto payment notification:", notifyErr);
    }

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
