import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tag } = await req.json();
    if (!tag || typeof tag !== "string") {
      return new Response(JSON.stringify({ error: "tag required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: cfg, error: cfgErr } = await supabase
      .from("bets_configs")
      .select("id, owner_id, tag, is_active, page_config, coin_name, coin_icon_url")
      .eq("tag", tag)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: events, error: evErr } = await supabase
      .from("bet_events")
      .select("id, title, subtitle, category, category_id, image_url, starts_at, closes_at, status, payout_mode, payout_case_id, payout_case_qty_per_unit, min_bet, max_bet, max_bets_per_user, position, winning_outcome_id, is_hot")
      .eq("bets_config_id", cfg.id)
      .in("status", ["scheduled", "open", "closed", "resolved"])
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (evErr) throw evErr;

    const eventIds = (events || []).map((e: any) => e.id);
    let outcomes: any[] = [];
    if (eventIds.length) {
      const { data: outs, error: outErr } = await supabase
        .from("bet_outcomes")
        .select("id, event_id, label, odd, position, is_winner")
        .in("event_id", eventIds)
        .order("position", { ascending: true });
      if (outErr) throw outErr;
      outcomes = outs || [];
    }

    const { data: catz } = await supabase
      .from("bet_categories")
      .select("id, name, color, icon, position, background_url")
      .eq("bets_config_id", cfg.id)
      .order("position");

    // case images for case-payout events
    const caseIds = Array.from(new Set((events || []).map((e: any) => e.payout_case_id).filter(Boolean)));
    let cases: any[] = [];
    if (caseIds.length) {
      const { data: cs } = await supabase
        .from("luckybox_cases")
        .select("id, name, image_url, rarity")
        .in("id", caseIds as string[]);
      cases = cs || [];
    }

    return new Response(JSON.stringify({
      found: true,
      ownerId: cfg.owner_id,
      tag: cfg.tag,
      isActive: cfg.is_active,
      pageConfig: cfg.page_config || {},
      coinName: cfg.coin_name || "Coins",
      coinIconUrl: cfg.coin_icon_url || "",
      events: events || [],
      outcomes,
      categories: catz || [],
      cases,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("get-bets-page error", err);
    return new Response(JSON.stringify({ error: "Failed to load page" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
