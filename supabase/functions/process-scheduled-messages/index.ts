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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    // Fetch due messages
    const { data: messages, error } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("next_run_at", now)
      .order("next_run_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching scheduled messages:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const msg of messages) {
      try {
        // Get owner's config
        const { data: configData } = await supabase
          .from("wheel_configs")
          .select("config")
          .eq("user_id", msg.owner_id)
          .maybeSingle();

        const cfg = typeof configData?.config === "string" ? JSON.parse(configData.config) : configData?.config;
        const ds = cfg?.dashboardSettings || {};

        const channel = msg.channel || "whatsapp";
        let ok = false;

        if (channel === "sms") {
          // ── SMS via Twilio ──
          const twilioAccountSid = ds.twilioAccountSid;
          const twilioAuthToken = ds.twilioAuthToken;
          const twilioPhoneNumber = ds.twilioPhoneNumber;

          if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
            await supabase.from("scheduled_messages").update({ status: "failed", updated_at: now }).eq("id", msg.id);
            results.push({ id: msg.id, ok: false, error: "Twilio not configured" });
            continue;
          }

          let cleanPhone = msg.recipient_value.replace(/\D/g, "");
          if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
          if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;
          cleanPhone = "+" + cleanPhone;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

          const response = await fetch(twilioUrl, {
            method: "POST",
            headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ To: cleanPhone, From: twilioPhoneNumber, Body: msg.message }),
          });

          ok = response.ok;

          await supabase.from("sms_message_log").insert({
            owner_id: msg.owner_id,
            recipient_phone: msg.recipient_value,
            recipient_name: msg.recipient_label || "",
            message: msg.message,
            status: ok ? "sent" : "failed",
            error_message: ok ? null : "Twilio API error",
          });
        } else if (channel === "sms_mb") {
          const mobizonApiKey = Deno.env.get("MOBIZON_BR_API_KEY");

          if (!mobizonApiKey) {
            await supabase.from("scheduled_messages").update({ status: "failed", updated_at: now }).eq("id", msg.id);
            results.push({ id: msg.id, ok: false, error: "Mobizon API key not configured" });
            continue;
          }

          let cleanPhone = msg.recipient_value.replace(/\D/g, "");
          while (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
          if (cleanPhone.startsWith("55") && cleanPhone.length > 11) cleanPhone = cleanPhone.slice(2);
          if (cleanPhone.length === 10) cleanPhone = `${cleanPhone.slice(0, 2)}9${cleanPhone.slice(2)}`;
          if (!cleanPhone.startsWith("55")) cleanPhone = `55${cleanPhone}`;

          const mobizonUrl = new URL("https://api.mobizon.com.br/service/message/sendSMSMessage");
          mobizonUrl.searchParams.set("apiKey", mobizonApiKey);
          mobizonUrl.searchParams.set("recipient", cleanPhone);
          mobizonUrl.searchParams.set("text", msg.message);
          mobizonUrl.searchParams.set("sender", String(ds.mobizonSender || "MobizonBR"));

          const response = await fetch(mobizonUrl.toString(), {
            method: "GET",
            headers: { "Accept": "application/json" },
          });

          const payload = await response.json().catch(() => null);
          ok = response.ok && Number(payload?.code ?? -1) === 0;

          await supabase.from("sms_message_log").insert({
            owner_id: msg.owner_id,
            recipient_phone: msg.recipient_value,
            recipient_name: msg.recipient_label || "",
            message: msg.message,
            status: ok ? "sent" : "failed",
            error_message: ok ? null : String(payload?.message || "Mobizon API error"),
          });
        } else if (channel === "whatsapp" || channel === "whatsapp2") {
          // ── WhatsApp via Evolution API (instância 1 ou 2) ──
          const isInstance2 = channel === "whatsapp2";
          const evolutionApiUrl = isInstance2 ? ds.evolutionApiUrl2 : ds.evolutionApiUrl;
          const evolutionApiKey = isInstance2 ? ds.evolutionApiKey2 : ds.evolutionApiKey;
          const evolutionInstance = isInstance2 ? ds.evolutionInstance2 : ds.evolutionInstance;
          const logTable = isInstance2 ? "whatsapp2_message_log" : "whatsapp_message_log";
          const errorLabel = isInstance2 ? "Evolution API (instância 2) not configured" : "Evolution API not configured";

          if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
            await supabase.from("scheduled_messages").update({ status: "failed", updated_at: now }).eq("id", msg.id);
            results.push({ id: msg.id, ok: false, error: errorLabel });
            continue;
          }

          const baseUrl = String(evolutionApiUrl).replace(/\/+$/, "").replace(/\/manager$/i, "");

          let number = msg.recipient_value;
          if (!number.includes("@g.us")) {
            number = number.replace(/\D/g, "");
            if (!number.startsWith("55")) number = "55" + number;
          }

          let url: string;
          let body: Record<string, any>;

          const poll = (msg as any).poll;
          if (poll && poll.name && Array.isArray(poll.values) && poll.values.length >= 2) {
            const opts = (poll.values as string[]).map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
            const selectableCount = Number(poll.selectableCount);
            url = `${baseUrl}/message/sendPoll/${evolutionInstance}`;
            body = {
              number,
              name: String(poll.name).trim(),
              selectableCount: Number.isFinite(selectableCount) && selectableCount >= 1 ? Math.min(selectableCount, opts.length) : 1,
              values: opts,
            };
          } else if (msg.media_url && msg.media_type === 'ptt') {
            url = `${baseUrl}/message/sendWhatsAppAudio/${evolutionInstance}`;
            body = { number, audio: msg.media_url, encoding: true };
          } else if (msg.media_url) {
            url = `${baseUrl}/message/sendMedia/${evolutionInstance}`;
            body = { number, mediatype: msg.media_type || "image", mimetype: msg.media_mimetype || "image/jpeg", caption: msg.message || "", media: msg.media_url, fileName: msg.media_filename || "file" };
          } else {
            url = `${baseUrl}/message/sendText/${evolutionInstance}`;
            body = { number, text: msg.message };
          }

          if (msg.mention_all && number.includes("@g.us")) {
            body.mentionsEveryOne = true;
          }

          const response = await fetch(url, {
            method: "POST",
            headers: { "apikey": evolutionApiKey, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          ok = response.ok;

          await supabase.from(logTable).insert({
            owner_id: msg.owner_id,
            recipient_phone: msg.recipient_value,
            recipient_name: msg.recipient_label || "",
            message: msg.message,
            status: ok ? "sent" : "failed",
            error_message: ok ? null : "API error",
          });
        } else {
          // canal desconhecido
          await supabase.from("scheduled_messages").update({ status: "failed", updated_at: now }).eq("id", msg.id);
          results.push({ id: msg.id, ok: false, error: `Unknown channel: ${channel}` });
          continue;
        }

        // Calculate next_run_at for recurrent messages
        if (msg.recurrence !== "none" && ok) {
          const nextRun = computeNextRun(msg.recurrence, msg.scheduled_at);
          await supabase.from("scheduled_messages").update({
            last_sent_at: now,
            next_run_at: nextRun,
            scheduled_at: nextRun,
            updated_at: now,
          }).eq("id", msg.id);
        } else {
          await supabase.from("scheduled_messages").update({
            status: ok ? "sent" : "failed",
            last_sent_at: ok ? now : undefined,
            updated_at: now,
          }).eq("id", msg.id);
        }

        results.push({ id: msg.id, ok });
      } catch (e) {
        console.error(`Error processing msg ${msg.id}:`, e);
        await supabase.from("scheduled_messages").update({ status: "failed", updated_at: now }).eq("id", msg.id);
        results.push({ id: msg.id, ok: false, error: e instanceof Error ? e.message : "Unknown" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Process scheduled messages error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function computeNextRun(recurrence: string, scheduledAt: string): string {
  const d = new Date(scheduledAt);
  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      break;
  }
  return d.toISOString();
}
