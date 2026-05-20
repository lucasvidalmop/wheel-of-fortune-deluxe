import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API_FOOTBALL_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const resource: string = body.resource || "fixtures";

    // Build query params
    const params = new URLSearchParams();
    if (resource === "fixtures") {
      if (body.league) params.set("league", String(body.league));
      if (body.season) params.set("season", String(body.season));
      if (body.date) params.set("date", String(body.date)); // YYYY-MM-DD
      if (body.team) params.set("team", String(body.team));
      if (body.id) params.set("id", String(body.id));
      if (!params.toString()) {
        // default: today
        const today = new Date().toISOString().slice(0, 10);
        params.set("date", today);
      }
    } else if (resource === "leagues") {
      if (body.search) params.set("search", String(body.search));
      if (body.country) params.set("country", String(body.country));
      if (body.current) params.set("current", "true");
    } else if (resource === "teams") {
      if (body.search) params.set("search", String(body.search));
      if (body.league) params.set("league", String(body.league));
      if (body.season) params.set("season", String(body.season));
    } else {
      return new Response(JSON.stringify({ error: "invalid resource" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://v3.football.api-sports.io/${resource}?${params.toString()}`;
    const r = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    const json = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "api-football error", detail: json }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ response: json.response || [], errors: json.errors || null, results: json.results ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-football-search error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
