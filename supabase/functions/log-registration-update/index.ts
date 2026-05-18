import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseUserAgent(ua: string) {
  let browser = "Desconhecido", os = "Desconhecido", deviceType = "Desktop";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  if (ua.includes("Mobile") || (ua.includes("Android") && !ua.includes("Tablet"))) deviceType = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) deviceType = "Tablet";
  return { browser, os, deviceType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const {
      owner_id, wheel_user_id, user_email, user_name, account_id,
      changed_fields, before_data, after_data, referrer, page_url, session_id,
    } = body || {};

    if (!owner_id || !user_email) {
      return new Response(JSON.stringify({ error: "owner_id and user_email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
    const ua = req.headers.get("user-agent") || "";
    const { browser, os, deviceType } = parseUserAgent(ua);

    let city = null, region = null, country = null;
    try {
      if (ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
        const r = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) { const g = await r.json(); city = g.city || null; region = g.regionName || null; country = g.country || null; }
      }
    } catch { /* best effort */ }

    const { error } = await supabase.from("registration_update_logs").insert({
      owner_id,
      wheel_user_id: wheel_user_id || null,
      user_email: String(user_email || ""),
      user_name: String(user_name || ""),
      account_id: String(account_id || ""),
      changed_fields: Array.isArray(changed_fields) ? changed_fields : [],
      before_data: before_data || {},
      after_data: after_data || {},
      ip_address: ip,
      user_agent: ua,
      device_type: deviceType,
      os, browser, city, region, country,
      referrer: referrer || null,
      page_url: page_url || null,
      session_id: session_id || null,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
