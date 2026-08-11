import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PUBLIC_ORIGIN = "https://tipspayroleta.com";

const REWARD_LABEL: Record<string, string> = { spin: "giro grátis", box: "caixa surpresa", coin: "coins", cash: "prêmio em dinheiro" };

function describeReward(tier: { reward_label?: string; reward_type: string; reward_amount: number }): string {
  if (tier.reward_label) return tier.reward_label;
  const label = REWARD_LABEL[tier.reward_type] || tier.reward_type;
  if (tier.reward_type === "cash") return `R$ ${Number(tier.reward_amount || 0).toFixed(2).replace(".", ",")}`;
  return `${Math.max(1, Number(tier.reward_amount || 1))}x ${label}`;
}

// Resolve as credenciais da Evolution API do mesmo numero/instancia que ja
// esta monitorando o grupo, igual ao send-whatsapp3/process-scheduled-messages.
function resolveCredentials(ds: Record<string, unknown>, label: string) {
  if (label === "notify") {
    return { url: ds.notifyEvolutionApiUrl, key: ds.notifyEvolutionApiKey, instance: ds.notifyEvolutionInstance };
  }
  if (label === "whatsapp2") {
    return { url: ds.evolutionApiUrl2, key: ds.evolutionApiKey2, instance: ds.evolutionInstance2 };
  }
  if (label === "whatsapp3") {
    return { url: ds.evolutionApiUrl3, key: ds.evolutionApiKey3, instance: ds.evolutionInstance3 };
  }
  return { url: ds.evolutionApiUrl, key: ds.evolutionApiKey, instance: ds.evolutionInstance };
}

async function sendGroupText(url: string, key: string, instance: string, groupJid: string, text: string) {
  const baseUrl = String(url).replace(/\/+$/, "").replace(/\/manager$/i, "");
  const resp = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ number: groupJid, text }),
  });
  return resp.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: events } = await admin
      .from("whatsapp_activity_events")
      .select("*")
      .in("scope", ["group", "both"])
      .eq("is_active", true)
      .eq("status", "active")
      .gt("reminder_interval_hours", 0);

    const results: Record<string, unknown>[] = [];

    for (const ev of events || []) {
      const intervalMs = Number(ev.reminder_interval_hours || 0) * 60 * 60 * 1000;
      if (intervalMs <= 0) continue;
      const lastSent = ev.last_reminder_sent_at ? new Date(ev.last_reminder_sent_at).getTime() : 0;
      if (Date.now() - lastSent < intervalMs) continue;

      const { data: prog } = await admin
        .from("whatsapp_activity_progress")
        .select("message_count")
        .eq("event_id", ev.id).eq("scope", "group").eq("sender_phone", "")
        .maybeSingle();
      const currentCount = prog?.message_count || 0;

      const { data: tiers } = await admin
        .from("whatsapp_activity_tiers")
        .select("*")
        .eq("event_id", ev.id).eq("scope", "group")
        .gt("threshold_messages", currentCount)
        .order("threshold_messages", { ascending: true })
        .limit(1);
      const nextTier = (tiers || [])[0];
      if (!nextTier) continue; // meta ja atingida (ou sem metas de grupo configuradas): nada a lembrar

      const remaining = Math.max(0, nextTier.threshold_messages - currentCount);
      const progressUrl = `${PUBLIC_ORIGIN}/sorteio-whatsapp=${ev.tag}`;
      const signupLine = ev.reminder_signup_url
        ? `\n\nNão tem conta ainda? Crie aqui: ${ev.reminder_signup_url}`
        : "";
      const message =
        `📊 Faltam *${remaining} mensagens* para a comunidade liberar: ${describeReward(nextTier)}! 🎉\n\n` +
        `Acompanhe o progresso: ${progressUrl}${signupLine}`;

      const { data: cfg } = await admin.from("wheel_configs").select("config").eq("user_id", ev.owner_id).maybeSingle();
      const ds = (cfg?.config as any)?.dashboardSettings || {};
      const creds = resolveCredentials(ds, ev.evolution_instance);
      if (!creds.url || !creds.key || !creds.instance) {
        results.push({ eventId: ev.id, sent: false, reason: "missing credentials" });
        continue;
      }

      const ok = await sendGroupText(String(creds.url), String(creds.key), String(creds.instance), ev.group_jid, message);
      if (ok) {
        await admin.from("whatsapp_activity_events").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", ev.id);
      }
      results.push({ eventId: ev.id, sent: ok, remaining });
    }

    return json({ ok: true, results });
  } catch (err) {
    console.error("whatsapp-activity-reminder error", err);
    return json({ error: err instanceof Error ? err.message : "erro desconhecido" }, 500);
  }
});
