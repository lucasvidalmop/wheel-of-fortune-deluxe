import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  ownerId: z.string().uuid(),
  type: z.enum(["referral_redeemed", "payment_pending", "payment_auto"]),
  payload: z.record(z.any()).default({}),
});

const formatCurrency = (value: unknown) => `R$ ${Number(value || 0).toFixed(2)}`;

const buildMessage = (type: z.infer<typeof BodySchema>["type"], payload: Record<string, any>) => {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  if (type === "referral_redeemed") {
    return `🔗 *Novo resgate no link de referência*\n\n🏷️ *Link:* ${payload.label || payload.code || "Link de referência"}\n👤 *Email:* ${payload.email || "-"}\n🆔 *ID:* ${payload.accountId || "-"}\n🎰 *Giros liberados:* ${payload.spins || 0}\n🕐 *Data:* ${now}`;
  }

  if (type === "payment_pending") {
    return `⏳ *Pagamento aguardando aprovação*\n\n👤 *Inscrito:* ${payload.userName || "-"}\n📧 *Email:* ${payload.userEmail || "-"}\n🎁 *Prêmio:* ${payload.prize || "-"}\n💵 *Valor:* ${formatCurrency(payload.amount)}\n🆔 *ID da conta:* ${payload.accountId || "-"}\n🕐 *Data:* ${now}`;
  }

  return `💰 *Pagamento automático realizado*\n\n👤 *Inscrito:* ${payload.userName || "-"}\n📧 *Email:* ${payload.userEmail || "-"}\n🎁 *Prêmio:* ${payload.prize || "-"}\n💵 *Valor:* ${formatCurrency(payload.amount)}\n🔑 *PIX:* ${payload.pixKey || "-"}\n🕐 *Data:* ${now}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      return new Response(JSON.stringify({ error: "SUPABASE_URL não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ownerId, type, payload } = parsed.data;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: configData, error: configError } = await supabaseAdmin
      .from("wheel_configs")
      .select("config")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (configError) {
      return new Response(JSON.stringify({ error: `Erro ao buscar configuração: ${configError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = typeof configData?.config === "string" ? JSON.parse(configData.config) : configData?.config;
    const ds = cfg?.dashboardSettings || {};

    const enabledMap = {
      referral_redeemed: !!ds.notifyReferralEnabled,
      payment_pending: !!ds.notifyPendingPaymentEnabled,
      payment_auto: !!ds.notifyAutoPaymentEnabled,
    } as const;

    if (!enabledMap[type]) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: "notification_disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifyPhone = ds.notifyWhatsappPhone;
    const notifyUrl = ds.notifyEvolutionApiUrl;
    const notifyKey = ds.notifyEvolutionApiKey;
    const notifyInstance = ds.notifyEvolutionInstance;
    const notifyGroupJid = ds.notifyGroupJid || "";
    const notifySelectedGroups: {id: string; subject: string}[] = Array.isArray(ds.notifySelectedGroups) ? ds.notifySelectedGroups : [];
    // Build list of group JIDs (from new multi-select or legacy single)
    const groupJids: string[] = notifySelectedGroups.length > 0
      ? notifySelectedGroups.map((g: any) => g.id)
      : notifyGroupJid ? [notifyGroupJid] : [];

    if (!notifyUrl || !notifyKey || !notifyInstance) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: "missing_notification_config" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!notifyPhone && groupJids.length === 0) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: "missing_notification_config" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = String(notifyUrl)
      .replace(/\/+$/, "")
      .replace(/\/manager$/i, "");

    const messageText = buildMessage(type, payload);
    const results: { target: string; ok: boolean; error?: string }[] = [];

    // Send to individual phone number
    if (notifyPhone) {
      let cleanPhone = String(notifyPhone).replace(/\D/g, "");
      if (!cleanPhone.startsWith("55")) cleanPhone = `55${cleanPhone}`;

      try {
        const response = await fetch(`${baseUrl}/message/sendText/${notifyInstance}`, {
          method: "POST",
          headers: { "apikey": notifyKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: cleanPhone, text: messageText }),
        });
        const responseText = await response.text();
        results.push({ target: "phone", ok: response.ok, error: response.ok ? undefined : responseText });
      } catch (e) {
        results.push({ target: "phone", ok: false, error: e instanceof Error ? e.message : "Erro" });
      }
    }

    // Send to all selected groups
    for (const jid of groupJids) {
      try {
        const response = await fetch(`${baseUrl}/message/sendText/${notifyInstance}`, {
          method: "POST",
          headers: { "apikey": notifyKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: jid, text: messageText }),
        });
        const responseText = await response.text();
        results.push({ target: `group:${jid}`, ok: response.ok, error: response.ok ? undefined : responseText });
      } catch (e) {
        results.push({ target: `group:${jid}`, ok: false, error: e instanceof Error ? e.message : "Erro" });
      }
    }

    const allOk = results.every(r => r.ok);

    return new Response(JSON.stringify({ success: allOk, results }), {
      status: allOk ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
