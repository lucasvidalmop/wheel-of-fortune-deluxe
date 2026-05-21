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
      .select("id,title,subtitle,category,category_id,image_url,home_image_url,away_image_url,starts_at,closes_at,status,payout_mode,payout_case_id,payout_case_qty_per_unit,min_bet,max_bet,max_bets_per_user,position,winning_outcome_id,is_hot,competition_id,competition_name,competition_slug,competition_country")
      .eq("bets_config_id", cfg.id)
      .in("status", ["scheduled", "open", "closed", "resolved"])
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (evErr) throw evErr;

    const eventIds = (events || []).map((e: any) => e.id);
    let outcomes: any[] = [];
    let markets: any[] = [];
    if (eventIds.length) {
      // Paginate outcomes (Supabase default limit is 1000 per query)
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data: outs, error: outErr } = await supabase
          .from("bet_outcomes")
          .select("id, event_id, market_id, label, odd, position, is_winner")
          .in("event_id", eventIds)
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (outErr) throw outErr;
        const batch = outs || [];
        outcomes.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
        if (from > 100000) break; // safety
      }

      // Paginate markets as well
      let mFrom = 0;
      while (true) {
        const { data: mks } = await supabase
          .from("bet_markets")
          .select("id, event_id, title, position, status, closes_at, winning_outcome_id, min_bet, max_bet, max_bets_per_user, payout_mode, payout_case_id, payout_case_qty_per_unit, resolved_at")
          .in("event_id", eventIds)
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(mFrom, mFrom + PAGE - 1);
        const batch = mks || [];
        markets.push(...batch);
        if (batch.length < PAGE) break;
        mFrom += PAGE;
        if (mFrom > 50000) break;
      }
    }

    const { data: catz } = await supabase
      .from("bet_categories")
      .select("id, name, color, icon, position, background_url")
      .eq("bets_config_id", cfg.id)
      .order("position");

    // case images for case-payout events + markets
    const caseIds = Array.from(new Set([
      ...(events || []).map((e: any) => e.payout_case_id).filter(Boolean),
      ...markets.map((m: any) => m.payout_case_id).filter(Boolean),
    ]));
    let cases: any[] = [];
    if (caseIds.length) {
      const { data: cs } = await supabase
        .from("luckybox_cases")
        .select("id, name, image_url, rarity")
        .in("id", caseIds as string[]);
      cases = cs || [];
    }

    // wager counts per event + per outcome (non-cancelled)
    const wagerCounts: Record<string, number> = {};
    const outcomeStats: Record<string, { count: number; total: number }> = {};
    if (eventIds.length) {
      const { data: wc } = await supabase
        .from("bet_wagers")
        .select("event_id, outcome_id, amount_coins")
        .eq("owner_id", cfg.owner_id)
        .in("event_id", eventIds)
        .neq("status", "cancelled");
      (wc || []).forEach((r: any) => {
        wagerCounts[r.event_id] = (wagerCounts[r.event_id] || 0) + 1;
        const s = outcomeStats[r.outcome_id] || { count: 0, total: 0 };
        s.count += 1;
        s.total += Number(r.amount_coins) || 0;
        outcomeStats[r.outcome_id] = s;
      });
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
      markets,
      categories: catz || [],
      cases,
      wagerCounts,
      outcomeStats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("get-bets-page error", err);
    return new Response(JSON.stringify({ error: "Failed to load page" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
