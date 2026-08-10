import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

// Compara os ultimos 8 digitos (ignora DDI/DDD divergentes de formatacao).
const phoneMatches = (a: string, b: string) => {
  const da = onlyDigits(a), db = onlyDigits(b);
  if (!da || !db) return false;
  return da.slice(-8) === db.slice(-8);
};

function extractMessage(data: any): { type: string; text: string } {
  const m = data?.message || {};
  if (m.stickerMessage) return { type: "sticker", text: "" };
  if (m.conversation) return { type: "text", text: String(m.conversation) };
  if (m.extendedTextMessage?.text) return { type: "text", text: String(m.extendedTextMessage.text) };
  if (m.imageMessage) return { type: "image", text: String(m.imageMessage.caption || "") };
  if (m.videoMessage) return { type: "video", text: String(m.videoMessage.caption || "") };
  if (m.audioMessage) return { type: "audio", text: "" };
  if (m.documentMessage) return { type: "document", text: String(m.documentMessage.caption || "") };
  return { type: "other", text: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json();
    const eventName = String(body.event || "").toLowerCase();
    if (eventName && !eventName.includes("messages.upsert") && !eventName.includes("messages_upsert")) {
      return json({ ok: true, skipped: "not a message event" });
    }

    const instanceName = String(body.instance || "");
    const items = Array.isArray(body.data) ? body.data : [body.data];

    for (const data of items) {
      if (!data?.key) continue;
      if (data.key.fromMe) continue;
      const remoteJid = String(data.key.remoteJid || "");
      if (!remoteJid.endsWith("@g.us")) continue; // so grupos

      const senderJid = String(data.key.participant || remoteJid);
      const senderPhone = onlyDigits(senderJid.split("@")[0]);
      const senderName = String(data.pushName || "");
      if (!senderPhone) continue;

      const { type: messageType, text: textContent } = extractMessage(data);

      const { data: events } = await admin
        .from("whatsapp_activity_events")
        .select("*")
        .eq("evolution_instance", instanceName)
        .eq("group_jid", remoteJid)
        .eq("is_active", true)
        .eq("status", "active");

      for (const ev of events || []) {
        await admin.from("whatsapp_activity_messages").insert({
          event_id: ev.id,
          sender_phone: senderPhone,
          sender_name: senderName,
          message_type: messageType,
          text_content: textContent,
        });

        // Tenta casar com um cadastro existente pelo telefone.
        let wheelUser: { id: string; account_id: string; user_name: string; user_email: string; pix_key: string; pix_key_type: string } | null = null;
        const { data: candidates } = await admin
          .from("wheel_users")
          .select("id, account_id, name, email, pix_key, pix_key_type, phone")
          .eq("owner_id", ev.owner_id)
          .not("phone", "is", null);
        const match = (candidates || []).find((u: any) => phoneMatches(u.phone, senderPhone));
        if (match) {
          wheelUser = {
            id: match.id, account_id: match.account_id, user_name: match.name,
            user_email: match.email, pix_key: match.pix_key, pix_key_type: match.pix_key_type,
          };
        }

        const scopesToUpdate: { scope: string; phone: string; name: string }[] = [];
        if (ev.scope === "individual" || ev.scope === "both") {
          scopesToUpdate.push({ scope: "individual", phone: senderPhone, name: senderName });
        }
        if (ev.scope === "group" || ev.scope === "both") {
          scopesToUpdate.push({ scope: "group", phone: "", name: ev.group_name || "" });
        }

        for (const s of scopesToUpdate) {
          const { data: prog } = await admin
            .from("whatsapp_activity_progress")
            .select("*")
            .eq("event_id", ev.id).eq("scope", s.scope).eq("sender_phone", s.phone)
            .maybeSingle();

          const newCount = (prog?.message_count || 0) + 1;
          await admin.from("whatsapp_activity_progress").upsert({
            event_id: ev.id, scope: s.scope, sender_phone: s.phone, sender_name: s.name,
            wheel_user_id: s.scope === "individual" ? wheelUser?.id || null : null,
            message_count: newCount, updated_at: new Date().toISOString(),
          }, { onConflict: "event_id,scope,sender_phone" });

          const { data: tiers } = await admin
            .from("whatsapp_activity_tiers")
            .select("*")
            .eq("event_id", ev.id).eq("scope", s.scope)
            .lte("threshold_messages", newCount)
            .order("threshold_messages", { ascending: true });

          for (const tier of tiers || []) {
            const { data: inserted } = await admin
              .from("whatsapp_activity_unlocks")
              .insert({
                event_id: ev.id, tier_id: tier.id, scope: s.scope, sender_phone: s.phone, sender_name: s.name,
                wheel_user_id: s.scope === "individual" ? wheelUser?.id || null : null,
                reward_type: tier.reward_type, reward_amount: tier.reward_amount,
                status: "pending",
              })
              .select("id")
              .maybeSingle();
            if (!inserted) continue; // ja existia (idempotencia via UNIQUE), nao repete recompensa

            if (s.scope === "group") {
              // Meta coletiva: sem destinatario unico automatico, fica para acao manual do operador.
              await admin.from("whatsapp_activity_unlocks").update({ status: "pending_manual" }).eq("id", inserted.id);
              continue;
            }

            if (!wheelUser) {
              await admin.from("whatsapp_activity_unlocks").update({ status: "unmatched" }).eq("id", inserted.id);
              continue;
            }

            if (tier.reward_type === "spin") {
              const { data: wu } = await admin.from("wheel_users").select("spins_available").eq("id", wheelUser.id).maybeSingle();
              await admin.from("wheel_users").update({
                spins_available: (wu?.spins_available || 0) + Number(tier.reward_amount || 1),
              }).eq("id", wheelUser.id);
              await admin.from("whatsapp_activity_unlocks").update({ status: "granted" }).eq("id", inserted.id);
            } else if (tier.reward_type === "cash") {
              const { data: payment } = await admin.from("prize_payments").insert({
                owner_id: ev.owner_id,
                wheel_user_id: wheelUser.id,
                account_id: wheelUser.account_id,
                user_name: wheelUser.user_name,
                user_email: wheelUser.user_email,
                prize: tier.reward_label || `Atividade WhatsApp - ${ev.name}`,
                amount: Number(tier.reward_amount || 0),
                status: "pending",
                pix_key: wheelUser.pix_key,
                pix_key_type: wheelUser.pix_key_type,
                auto_payment: false,
                notes: `Gerado por meta de atividade no WhatsApp (evento ${ev.name}). Checar historico de mensagens antes de aprovar.`,
              }).select("id").maybeSingle();
              await admin.from("whatsapp_activity_unlocks").update({
                status: "pending_approval", payment_id: payment?.id || null,
              }).eq("id", inserted.id);
            } else if (tier.reward_type === "box" && tier.reward_case_id) {
              const { data: caseRow } = await admin
                .from("luckybox_cases").select("id, name").eq("id", tier.reward_case_id).maybeSingle();
              const code = Array.from({ length: 8 }, () =>
                "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 33)]).join("");
              const { data: grant } = await admin.from("luckybox_grants").insert({
                owner_id: ev.owner_id,
                case_id: tier.reward_case_id,
                case_name: caseRow?.name || "",
                wheel_user_id: wheelUser.id,
                recipient_name: wheelUser.user_name,
                recipient_phone: senderPhone,
                recipient_email: wheelUser.user_email,
                recipient_account_id: wheelUser.account_id,
                code,
                quantity: Math.max(1, Number(tier.reward_amount || 1)),
                status: "pending",
              }).select("id").maybeSingle();
              if (grant?.id) {
                try {
                  await admin.rpc("auto_credit_luckybox_grant", { p_grant_id: grant.id });
                } catch (err) {
                  console.error("whatsapp-activity-webhook: falha ao creditar luckybox", err);
                }
              }
              await admin.from("whatsapp_activity_unlocks").update({ status: "granted" }).eq("id", inserted.id);
            } else {
              // box sem caixa selecionada, ou coin: ainda sem integracao automatica de credito.
              await admin.from("whatsapp_activity_unlocks").update({ status: "pending_manual" }).eq("id", inserted.id);
            }
          }
        }
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error("whatsapp-activity-webhook error", err);
    return json({ error: err instanceof Error ? err.message : "erro desconhecido" }, 500);
  }
});
