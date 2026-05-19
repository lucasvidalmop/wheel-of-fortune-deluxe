import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { tag } = await req.json();
    if (!tag) {
      return new Response(JSON.stringify({ error: "tag required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: cfg } = await supabase
      .from("bets_configs").select("owner_id").eq("tag", tag).maybeSingle();
    if (!cfg) {
      return new Response(JSON.stringify({ wagerCounts: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: wc } = await supabase
      .from("bet_wagers")
      .select("event_id")
      .eq("owner_id", cfg.owner_id)
      .neq("status", "cancelled");
    const wagerCounts: Record<string, number> = {};
    (wc || []).forEach((r: any) => {
      wagerCounts[r.event_id] = (wagerCounts[r.event_id] || 0) + 1;
    });
    return new Response(JSON.stringify({ wagerCounts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-bets-counts error", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
