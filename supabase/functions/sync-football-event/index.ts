import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OutcomePayload {
  label: string;
  odd: number;
  position?: number;
}
interface MarketPayload {
  name: string;
  status?: string;
  closes_at?: string | null;
  outcomes: OutcomePayload[];
}
interface EventPayload {
  external_fixture_id: string;
  title: string;
  subtitle?: string;
  starts_at?: string | null;
  closes_at?: string | null;
  status?: string;
  category?: string;
  category_id?: string | null;
  home_team?: string;
  away_team?: string;
  home_logo?: string;
  away_logo?: string;
  image_url?: string;
  is_hot?: boolean;
}
interface Body {
  owner_id: string;
  event: EventPayload;
  markets: MarketPayload[];
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // ---- Auth via shared secret ----
  const provided = req.headers.get("x-vps-token") || "";
  const expected = Deno.env.get("VPS_SYNC_SECRET") || "";
  if (!expected) return json(500, { error: "VPS_SYNC_SECRET not configured" });
  if (!provided || provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const ownerId = body?.owner_id;
  const ev = body?.event;
  const markets = Array.isArray(body?.markets) ? body.markets : [];
  if (!ownerId || !ev?.external_fixture_id || !ev?.title) {
    return json(400, { error: "owner_id, event.external_fixture_id and event.title are required" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // ---- Resolve bets_config_id for this owner (required NOT NULL on bet_events) ----
    const { data: cfg, error: cfgErr } = await supabase
      .from("bets_configs")
      .select("id, owner_id")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) return json(404, { error: "No bets_configs found for this owner_id" });

    // ---- Resolve category_id if a category name was provided ----
    let categoryId: string | null = ev.category_id ?? null;
    if (!categoryId && ev.category) {
      const { data: cat } = await supabase
        .from("bet_categories")
        .select("id")
        .eq("bets_config_id", cfg.id)
        .ilike("name", ev.category)
        .maybeSingle();
      if (cat?.id) categoryId = cat.id;
    }

    // ---- Upsert bet_events by (owner_id, external_fixture_id) ----
    const { data: existingEv, error: findErr } = await supabase
      .from("bet_events")
      .select("id, status")
      .eq("owner_id", ownerId)
      .eq("external_fixture_id", ev.external_fixture_id)
      .maybeSingle();
    if (findErr) throw findErr;

    const evPayload: Record<string, unknown> = {
      owner_id: ownerId,
      bets_config_id: cfg.id,
      title: ev.title,
      subtitle: ev.subtitle ?? "",
      category: ev.category ?? "",
      category_id: categoryId,
      starts_at: ev.starts_at ?? null,
      closes_at: ev.closes_at ?? null,
      status: ev.status ?? "open",
      home_image_url: ev.home_logo ?? null,
      away_image_url: ev.away_logo ?? null,
      image_url: ev.image_url ?? "",
      external_fixture_id: ev.external_fixture_id,
      is_hot: Boolean(ev.is_hot ?? false),
      updated_at: new Date().toISOString(),
    };

    let eventId: string;
    if (existingEv) {
      eventId = existingEv.id;
      // Do not downgrade a resolved/cancelled event back to "open"
      if (existingEv.status === "resolved" || existingEv.status === "cancelled") {
        delete evPayload.status;
      }
      const { error: updErr } = await supabase
        .from("bet_events")
        .update(evPayload)
        .eq("id", eventId);
      if (updErr) throw updErr;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("bet_events")
        .insert(evPayload)
        .select("id")
        .single();
      if (insErr) throw insErr;
      eventId = inserted.id;
    }

    // ---- Existing markets for this event ----
    const { data: existingMarkets, error: mkListErr } = await supabase
      .from("bet_markets")
      .select("id, title, status")
      .eq("event_id", eventId);
    if (mkListErr) throw mkListErr;

    const incomingNames = new Set(markets.map((m) => (m.name || "").trim().toLowerCase()));
    const marketsResult: Array<{ id: string; title: string; outcomes: number }> = [];

    for (let i = 0; i < markets.length; i++) {
      const mk = markets[i];
      const title = (mk.name || "").trim();
      if (!title) continue;
      const found = (existingMarkets || []).find(
        (em: any) => (em.title || "").trim().toLowerCase() === title.toLowerCase(),
      );

      let marketId: string;
      if (found) {
        marketId = found.id;
        const upd: Record<string, unknown> = {
          status: mk.status ?? found.status ?? "open",
          closes_at: mk.closes_at ?? null,
          updated_at: new Date().toISOString(),
        };
        // do not reopen a resolved/cancelled market
        if (found.status === "resolved" || found.status === "cancelled") {
          delete upd.status;
        }
        const { error: mkUpdErr } = await supabase
          .from("bet_markets")
          .update(upd)
          .eq("id", marketId);
        if (mkUpdErr) throw mkUpdErr;
      } else {
        const { data: newMk, error: mkInsErr } = await supabase
          .from("bet_markets")
          .insert({
            owner_id: ownerId,
            event_id: eventId,
            title,
            status: mk.status ?? "open",
            position: i,
            closes_at: mk.closes_at ?? null,
          })
          .select("id")
          .single();
        if (mkInsErr) throw mkInsErr;
        marketId = newMk.id;
      }

      // ---- Outcomes for this market ----
      const { data: existingOutcomes, error: ocListErr } = await supabase
        .from("bet_outcomes")
        .select("id, label, odd, is_winner")
        .eq("market_id", marketId);
      if (ocListErr) throw ocListErr;

      for (let j = 0; j < (mk.outcomes || []).length; j++) {
        const oc = mk.outcomes[j];
        const label = (oc.label || "").trim();
        if (!label) continue;
        const odd = Number(oc.odd);
        if (!Number.isFinite(odd) || odd <= 0) continue;
        const pos = Number.isFinite(oc.position) ? Number(oc.position) : j;

        const foundOc = (existingOutcomes || []).find(
          (eo: any) => (eo.label || "").trim().toLowerCase() === label.toLowerCase(),
        );

        if (foundOc) {
          // Only update odds while outcome is not yet resolved.
          // Snapshots already taken in bet_wagers.odd_snapshot / bet_ticket_selections.odd are NOT touched.
          if (!foundOc.is_winner) {
            const { error: ocUpdErr } = await supabase
              .from("bet_outcomes")
              .update({ odd, position: pos })
              .eq("id", foundOc.id);
            if (ocUpdErr) throw ocUpdErr;
          }
        } else {
          const { error: ocInsErr } = await supabase
            .from("bet_outcomes")
            .insert({
              owner_id: ownerId,
              event_id: eventId,
              market_id: marketId,
              label,
              odd,
              position: pos,
            });
          if (ocInsErr) throw ocInsErr;
        }
      }

      marketsResult.push({ id: marketId, title, outcomes: (mk.outcomes || []).length });
    }

    // ---- Markets that disappeared from the feed: mark as closed (we never auto-delete) ----
    const vanished = (existingMarkets || []).filter(
      (em: any) =>
        !incomingNames.has((em.title || "").trim().toLowerCase()) &&
        em.status !== "resolved" &&
        em.status !== "cancelled" &&
        em.status !== "closed",
    );
    for (const v of vanished) {
      await supabase
        .from("bet_markets")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", v.id);
    }

    return json(200, {
      success: true,
      event_id: eventId,
      created: !existingEv,
      markets: marketsResult,
      closed_missing_markets: vanished.map((v: any) => v.id),
    });
  } catch (err: any) {
    console.error("sync-football-event error", err);
    return json(500, { error: err?.message || "Failed to sync event" });
  }
});
