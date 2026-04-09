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
        callback: "https://api.tipspayroleta.com/api/edpay/webhook",
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferResponse.ok) {
      console.error("EdPay transfer failed:", JSON.stringify(transferData));
      // Revert to pending so it appears in approvals for manual retry
      await supabaseAdmin
        .from("prize_payments")
        .update({
          status: "pending",
          auto_payment: false,
          notes: `Falha auto-pagamento EdPay: ${JSON.stringify(transferData)}. Aguardando aprovação manual.`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      return new Response(JSON.stringify({ error: "Falha na transferência PIX - enviado para aprovação manual", details: transferData }), {
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

    // Step 4: Send WhatsApp notification if configured
    {
      try {
        const cfg = typeof configData?.config === "string" ? JSON.parse(configData.config) : configData?.config;
        const ds = cfg?.dashboardSettings || {};
        const notifyEnabled = ds.notifyAutoPaymentEnabled;
        const notifyPhone = ds.notifyWhatsappPhone;
        const notifyUrl = ds.notifyEvolutionApiUrl;
        const notifyKey = ds.notifyEvolutionApiKey;
        const notifyInstance = ds.notifyEvolutionInstance;

        if (notifyEnabled && notifyPhone && notifyUrl && notifyKey && notifyInstance) {
          let cleanNotifyPhone = notifyPhone.replace(/\D/g, "");
          if (!cleanNotifyPhone.startsWith("55")) cleanNotifyPhone = "55" + cleanNotifyPhone;

          const notifyApiUrl = notifyUrl.replace(/\/+$/, "");
          const paymentTypeLabel = autoPayment ? "Automático" : "Manual";
          const notifyMsg = `💰 *Pagamento ${paymentTypeLabel} Realizado!*\n\n👤 *Inscrito:* ${payment.user_name}\n📧 *Email:* ${payment.user_email}\n🎁 *Prêmio:* ${payment.prize}\n💵 *Valor:* R$ ${Number(payment.amount).toFixed(2)}\n🔑 *PIX:* ${payment.pix_key}\n🕐 *Data:* ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

          await fetch(`${notifyApiUrl}/message/sendText/${notifyInstance}`, {
            method: "POST",
            headers: { "apikey": notifyKey, "Content-Type": "application/json" },
            body: JSON.stringify({ number: cleanNotifyPhone, text: notifyMsg }),
          });
          console.log("WhatsApp notification sent to owner");
        }
      } catch (notifyErr) {
        console.error("Failed to send WhatsApp notification:", notifyErr);
      }
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
