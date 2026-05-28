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
    const { tag, detailEventId } = await req.json();
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

    let normalizedDetailEventId: string | null = null;
    if (detailEventId && typeof detailEventId === "string") {
      normalizedDetailEventId = detailEventId.trim();
      if (normalizedDetailEventId.length < 36) {
        const { data: matchingEvents, error: matchErr } = await supabase
          .from("bet_events")
          .select("id")
          .eq("bets_config_id", cfg.id)
          .in("status", ["scheduled", "open", "closed", "resolved"]);
        if (matchErr) throw matchErr;
        normalizedDetailEventId = (matchingEvents || [])
          .find((event: any) => String(event.id).startsWith(normalizedDetailEventId!))?.id || normalizedDetailEventId;
      }
    }

    let evQuery = supabase
      .from("bet_events")
      .select("id,title,subtitle,category,category_id,image_url,home_image_url,away_image_url,starts_at,closes_at,status,payout_mode,payout_case_id,payout_case_qty_per_unit,min_bet,max_bet,max_bets_per_user,position,winning_outcome_id,is_hot,competition_id,competition_name,competition_slug,competition_country")
      .eq("bets_config_id", cfg.id)
      .in("status", ["scheduled", "open", "closed", "resolved"])
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (normalizedDetailEventId) {
      evQuery = evQuery.eq("id", normalizedDetailEventId);
    }
    const { data: events, error: evErr } = await evQuery;
    if (evErr) throw evErr;

    const eventIds = (events || []).map((e: any) => e.id);
    const isDetailLoad = !!(detailEventId && typeof detailEventId === "string");
    let outcomes: any[] = [];
    let markets: any[] = [];
    if (eventIds.length) {
      const PAGE = 1000;
      const normTitle = (title = "") => title.trim().toLowerCase();
      // Strict main-market match: full title equality with known principals.
      // Avoids matching variants like "1x2 - 60 minutes" or "Goals Over/Under - Second Half".
      const MAIN_TITLES = new Set([
        "match winner",
        "full time result",
        "home/away",
        "1x2",
        "vencedor",
        "vencedor do jogo",
        "resultado final",
        "resultado",
      ]);
      const mainTitleRank = (title = "") => {
        const t = normTitle(title);
        if (t === "match winner" || t === "full time result" || t === "resultado final") return 0;
        if (t === "1x2" || t === "vencedor" || t === "vencedor do jogo" || t === "resultado") return 1;
        if (t === "home/away") return 2;
        return 9;
      };
      const isMainMarket = (title = "") => MAIN_TITLES.has(normTitle(title));
      const isOpen = (m: any) => m?.status === "open";
      const marketRank = (m: any) => {
        if (isOpen(m) && isMainMarket(m.title)) return mainTitleRank(m.title);
        if (isOpen(m)) return 10;
        if (isMainMarket(m.title)) return 20 + mainTitleRank(m.title);
        if (m?.status === "closed") return 30;
        if (m?.status === "resolved") return 40;
        if (m?.status === "cancelled") return 50;
        return 60;
      };
      // Paginate markets first so the initial page can return only the principal odds per event.
      let mFrom = 0;
      while (true) {
        const { data: mks, error: mkErr } = await supabase
          .from("bet_markets")
          .select("id, event_id, title, position, status, closes_at, winning_outcome_id, min_bet, max_bet, max_bets_per_user, payout_mode, payout_case_id, payout_case_qty_per_unit, resolved_at")
          .in("event_id", eventIds)
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(mFrom, mFrom + PAGE - 1);
        if (mkErr) throw mkErr;
        const batch = mks || [];
        markets.push(...batch);
        if (batch.length < PAGE) break;
        mFrom += PAGE;
        if (mFrom > 50000) break;
      }
      // Hide half-time corner markets (e.g. "Total Corners (1st Half)", "Corners 2nd Half")
      const isHalfCornerMarket = (title = "") => {
        const t = String(title).toLowerCase();
        const hasCorner = /\bcorner|escanteio/.test(t);
        const hasHalf = /(1st|2nd|first|second)\s*[- ]?\s*half|\bht\b|1º\s*tempo|2º\s*tempo|1o\s*tempo|2o\s*tempo|primeiro\s*tempo|segundo\s*tempo/.test(t);
        return hasCorner && hasHalf;
      };
      markets = markets.filter((m) => !isHalfCornerMarket(m?.title));
      markets.sort((a, b) =>
        String(a.event_id).localeCompare(String(b.event_id)) ||
        marketRank(a) - marketRank(b) ||
        (Number(a.position) || 0) - (Number(b.position) || 0) ||
        String(a.id).localeCompare(String(b.id))
      );

      let outcomeQueryIds: string[] | null = null;
      if (!isDetailLoad) {
        const byEvent = new Map<string, any[]>();
        for (const mk of markets) byEvent.set(mk.event_id, [...(byEvent.get(mk.event_id) || []), mk]);
        outcomeQueryIds = [];
        for (const mks of byEvent.values()) {
          // Priority: open main → first open → any main → first market
          const main =
            mks.find((m) => isMainMarket(m.title) && isOpen(m)) ||
            mks.find((m) => isOpen(m)) ||
            mks.find((m) => isMainMarket(m.title)) ||
            mks[0];
          if (main?.id) outcomeQueryIds.push(main.id);
        }
        const keep = new Set(outcomeQueryIds);
        markets = markets.filter((m) => keep.has(m.id));
      }

      let from = 0;
      while (true) {
        let outQuery = supabase
          .from("bet_outcomes")
          .select("id, event_id, market_id, label, odd, position, is_winner")
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        outQuery = outcomeQueryIds?.length ? outQuery.in("market_id", outcomeQueryIds) : outQuery.in("event_id", eventIds);
        if (!isDetailLoad && !outcomeQueryIds?.length) outQuery = outQuery.lte("position", 3);
        const { data: outs, error: outErr } = await outQuery;
        if (outErr) throw outErr;
        const batch = outs || [];
        outcomes.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
        if (from > 100000) break; // safety
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


    // active lobby tag for this operator (for the "Back to lobby" button on product pages)
    const { data: lobbyCfg } = await supabase
      .from("lobby_configs")
      .select("tag, is_active")
      .eq("owner_id", cfg.owner_id)
      .maybeSingle();
    const lobbyTag = lobbyCfg?.is_active ? (lobbyCfg.tag || "") : "";

    return new Response(JSON.stringify({
      found: true,
      ownerId: cfg.owner_id,
      tag: cfg.tag,
      isActive: cfg.is_active,
      pageConfig: cfg.page_config || {},
      coinName: cfg.coin_name || "Coins",
      coinIconUrl: cfg.coin_icon_url || "",
      lobbyTag,
      events: events || [],
      outcomes: Array.from(new Map(outcomes.map((o: any) => [o.id, o])).values()),
      markets: Array.from(new Map(markets.map((m: any) => [m.id, m])).values()),
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
