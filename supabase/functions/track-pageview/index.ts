import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseUserAgent(ua: string) {
  let browser = "Desconhecido";
  let os = "Desconhecido";
  let deviceType = "Desktop";

  // Browser detection
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("MSIE") || ua.includes("Trident/")) browser = "IE";

  // OS detection
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("CrOS")) os = "ChromeOS";

  // Device type
  if (ua.includes("Mobile") || ua.includes("Android") && !ua.includes("Tablet")) {
    deviceType = "Mobile";
  } else if (ua.includes("iPad") || ua.includes("Tablet")) {
    deviceType = "Tablet";
  }

  return { browser, os, deviceType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { session_id, slug, owner_id, referrer, page_url, duration_seconds, action, page_type } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update duration for existing session
    if (action === "update_duration" && duration_seconds !== undefined) {
      const { error } = await supabase
        .from("page_views")
        .update({ duration_seconds, updated_at: new Date().toISOString() })
        .eq("session_id", session_id);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get IP from request headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || "unknown";

    const userAgent = req.headers.get("user-agent") || "";
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // Try to get geolocation from ip-api (free, no key needed)
    let city = null;
    let region = null;
    let country = null;

    try {
      if (ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country`, {
          signal: AbortSignal.timeout(3000),
        });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          city = geo.city || null;
          region = geo.regionName || null;
          country = geo.country || null;
        }
      }
    } catch {
      // Geolocation is best-effort
    }

    const { error } = await supabase.from("page_views").insert({
      session_id,
      owner_id: owner_id || null,
      slug: slug || null,
      ip_address: ip,
      city,
      region,
      country,
      device_type: deviceType,
      os,
      browser,
      referrer: referrer || null,
      page_url: page_url || null,
      page_type: page_type || 'roleta',
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
