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
        } else {
          // ── WhatsApp via Evolution API ──
          const evolutionApiUrl = ds.evolutionApiUrl;
          const evolutionApiKey = ds.evolutionApiKey;
          const evolutionInstance = ds.evolutionInstance;

          if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
            await supabase.from("scheduled_messages").update({ status: "failed", updated_at: now }).eq("id", msg.id);
            results.push({ id: msg.id, ok: false, error: "Evolution API not configured" });
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

          if (msg.media_url && msg.media_type === 'ptt') {
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

          await supabase.from("whatsapp_message_log").insert({
            owner_id: msg.owner_id,
            recipient_phone: msg.recipient_value,
            recipient_name: msg.recipient_label || "",
            message: msg.message,
            status: ok ? "sent" : "failed",
            error_message: ok ? null : "API error",
          });
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
