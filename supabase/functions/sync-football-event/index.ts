import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  /** API-Football fixture.status.short (NS, 1H, HT, 2H, ET, P, BT, LIVE, FT, AET, PEN, PST, CANC, ABD, AWD, WO, SUSP, INT) */
  fixture_status?: string | null;
  category?: string;
  category_id?: string | null;
  home_team?: string;
  away_team?: string;
  home_logo?: string;
  away_logo?: string;
  image_url?: string;
  is_hot?: boolean;
  // Competição / liga
  competition_id?: string | number | null;
  competition_name?: string | null;
  competition_slug?: string | null;
  competition_country?: string | null;
}

/**
 * Mapeia o status curto da API-Football para o status interno do bet_events.
 * - NS => open (não começou, aceita apostas)
 * - 1H/HT/2H/ET/P/BT/LIVE => live (em andamento, fecha apostas)
 * - FT/AET/PEN => closed (encerrado, aguardando resolução/pagamento)
 * - PST/SUSP/INT => closed (sem novas apostas, mas ainda monitorado)
 * - CANC/ABD/AWD/WO => cancelled
 */
function mapFixtureStatusToEventStatus(short: string | null | undefined): string | null {
  if (!short) return null;
  const s = String(short).toUpperCase().trim();
  if (s === "NS" || s === "TBD") return "open";
  if (["1H", "2H", "HT", "ET", "P", "BT", "LIVE"].includes(s)) return "live";
  if (["FT", "AET", "PEN"].includes(s)) return "closed";
  if (["PST", "SUSP", "INT"].includes(s)) return "closed";
  if (["CANC", "ABD", "AWD", "WO"].includes(s)) return "cancelled";
  return null;
}
interface Body {
  event: EventPayload;
  markets: MarketPayload[];
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Normalização de nomes de seleções ----
const TEAM_NAME_MAP: Record<string, string> = {
  "congo dr": "República Democrática do Congo",
  "dr congo": "República Democrática do Congo",
  "korea republic": "Coreia do Sul",
  "republic of korea": "Coreia do Sul",
  "south korea": "Coreia do Sul",
  "korea dpr": "Coreia do Norte",
  "dpr korea": "Coreia do Norte",
  "north korea": "Coreia do Norte",
  "usa": "Estados Unidos",
  "united states": "Estados Unidos",
  "united states of america": "Estados Unidos",
  "uae": "Emirados Árabes Unidos",
  "united arab emirates": "Emirados Árabes Unidos",
  "ir iran": "Irã",
  "iran": "Irã",
  "ivory coast": "Costa do Marfim",
  "cote d'ivoire": "Costa do Marfim",
  "côte d'ivoire": "Costa do Marfim",
  "cape verde": "Cabo Verde",
  "cape verde islands": "Cabo Verde",
  "saudi arabia": "Arábia Saudita",
};

function normalizeTeamName(name: string | null | undefined): string {
  if (!name) return name ?? "";
  const key = name.trim().toLowerCase();
  return TEAM_NAME_MAP[key] ?? name;
}

function normalizeInTitle(title: string | null | undefined): string {
  if (!title) return title ?? "";
  // Replace " x " / " vs " separators preserving them
  const sepMatch = title.match(/^(.*?)(\s+(?:x|vs|×|@|-)\s+)(.*)$/i);
  if (sepMatch) {
    const home = normalizeTeamName(sepMatch[1]);
    const away = normalizeTeamName(sepMatch[3]);
    return `${home}${sepMatch[2]}${away}`;
  }
  return normalizeTeamName(title);
}

async function syncForOwner(
  supabase: SupabaseClient,
  ownerId: string,
  betsConfigId: string,
  ev: EventPayload,
  markets: MarketPayload[],
) {
  // ---- Resolve category_id if a category name was provided ----
  let categoryId: string | null = ev.category_id ?? null;
  if (!categoryId && ev.category) {
    const { data: cat } = await supabase
      .from("bet_categories")
      .select("id")
      .eq("bets_config_id", betsConfigId)
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

  // Deriva status interno a partir do fixture.status.short da API-Football quando enviado.
  // Aceita o short code tanto em `fixture_status` quanto em `status` (compat. VPS antigo).
  const fixtureShort = ev.fixture_status ?? ev.status ?? null;
  const mappedFromShort = mapFixtureStatusToEventStatus(fixtureShort);
  const derivedStatus =
    mappedFromShort ??
    (ev.status && ["open", "live", "closed", "resolved", "cancelled"].includes(ev.status)
      ? ev.status
      : "open");


  // Detecta automaticamente fase eliminatória (Final, Semi Final, Quarter Finals, Final - 1, etc.)
  const phaseText = `${ev.subtitle ?? ""} ${ev.category ?? ""}`.toLowerCase();
  const isFinalsPhase = /\bfinal/.test(phaseText) || /semi[\s-]?final/.test(phaseText) || /quarter[\s-]?final/.test(phaseText);

  const evPayload: Record<string, unknown> = {
    owner_id: ownerId,
    bets_config_id: betsConfigId,
    title: ev.title,
    subtitle: ev.subtitle ?? "",
    category: ev.category ?? "",
    category_id: categoryId,
    starts_at: ev.starts_at ?? null,
    closes_at: ev.closes_at ?? null,
    status: derivedStatus,
    home_image_url: ev.home_logo ?? null,
    away_image_url: ev.away_logo ?? null,
    image_url: ev.image_url ?? "",
    external_fixture_id: ev.external_fixture_id,
    // is_hot só é aplicado na CRIAÇÃO (removido em updates abaixo).
    // Fase de mata-mata força true; caso contrário usa payload ou false.
    is_hot: isFinalsPhase ? true : Boolean(ev.is_hot ?? false),
    competition_id: ev.competition_id != null ? String(ev.competition_id) : null,
    competition_name: ev.competition_name ?? null,
    competition_slug: ev.competition_slug ?? null,
    competition_country: ev.competition_country ?? null,
    updated_at: new Date().toISOString(),
  };

  let eventId: string;
  if (existingEv) {
    eventId = existingEv.id;
    // Nunca regredir status terminais
    if (existingEv.status === "resolved" || existingEv.status === "cancelled") {
      delete evPayload.status;
    }
    // Não sobrescreve starts_at com null se o payload não trouxer
    if (ev.starts_at == null) {
      delete evPayload.starts_at;
    }
    if (ev.closes_at == null) {
      delete evPayload.closes_at;
    }
    // NUNCA sobrescreve is_hot em eventos já existentes — o admin é a fonte da verdade.
    // Auto-marcação por "Final" e flag do payload só valem na criação.
    delete evPayload.is_hot;
    const { error: updErr } = await supabase
      .from("bet_events")
      .update(evPayload)
      .eq("id", eventId);
    if (updErr) throw updErr;
    console.log("[sync-football-event] updated existing event", {
      event_id: eventId,
      external_fixture_id: ev.external_fixture_id,
      previous_status: existingEv.status,
      new_status: evPayload.status ?? existingEv.status,
      fixture_short: fixtureShort,
    });
  } else {

    const { data: inserted, error: insErr } = await supabase
      .from("bet_events")
      .insert(evPayload)
      .select("id")
      .single();
    if (insErr) throw insErr;
    eventId = inserted.id;
  }

  // ---- Existing markets ----
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
      if (mkInsErr) {
        // Race / unique violation on (event_id, lower(trim(title))) — refetch existing
        const { data: existing } = await supabase
          .from("bet_markets")
          .select("id, title")
          .eq("event_id", eventId);
        const match = (existing || []).find(
          (em: any) => (em.title || "").trim().toLowerCase() === title.toLowerCase(),
        );
        if (!match) throw mkInsErr;
        marketId = match.id;
      } else {
        marketId = newMk.id;
      }
    }


    // ---- Outcomes ----
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
        // Snapshots em bet_wagers.odd_snapshot / bet_ticket_selections.odd não são tocados.
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
        if (ocInsErr) {
          // Race / unique violation on (market_id, lower(trim(label))) — update existing
          const { data: existingOc } = await supabase
            .from("bet_outcomes")
            .select("id, label, is_winner")
            .eq("market_id", marketId);
          const match = (existingOc || []).find(
            (eo: any) => (eo.label || "").trim().toLowerCase() === label.toLowerCase(),
          );
          if (!match) throw ocInsErr;
          if (!match.is_winner) {
            await supabase
              .from("bet_outcomes")
              .update({ odd, position: pos })
              .eq("id", match.id);
          }
        }
      }
    }

    marketsResult.push({ id: marketId, title, outcomes: (mk.outcomes || []).length });
  }

  // Mercados que sumiram do feed: marcar como closed (nunca apagar)
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

  return {
    event_id: eventId,
    created: !existingEv,
    markets: marketsResult,
    closed_missing_markets: vanished.map((v: any) => v.id),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const provided = req.headers.get("x-vps-token") || "";
  const expected = Deno.env.get("VPS_SYNC_SECRET") || "";
  if (!expected) return json(500, { error: "VPS_SYNC_SECRET not configured" });
  if (!provided || provided !== expected) return json(401, { error: "Unauthorized" });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const ev = body?.event;
  const markets = Array.isArray(body?.markets) ? body.markets : [];
  if (!ev?.external_fixture_id || !ev?.title) {
    return json(400, { error: "event.external_fixture_id and event.title are required" });
  }

  // ---- Normalização de nomes de seleções ----
  ev.title = normalizeInTitle(ev.title);
  if (ev.subtitle) ev.subtitle = normalizeInTitle(ev.subtitle);
  if (ev.home_team) ev.home_team = normalizeTeamName(ev.home_team);
  if (ev.away_team) ev.away_team = normalizeTeamName(ev.away_team);
  for (const mk of markets) {
    if (Array.isArray(mk.outcomes)) {
      for (const oc of mk.outcomes) {
        if (oc?.label) oc.label = normalizeTeamName(oc.label);
      }
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // Carrega operadores ativos; se a coluna não existir ou nenhum estiver ativo, usa TODOS
    let configs: Array<{ id: string; owner_id: string }> | null = null;
    const activeRes = await supabase
      .from("bets_configs")
      .select("id, owner_id, is_active")
      .eq("is_active", true);
    if (activeRes.error) {
      console.warn("is_active filter failed, falling back to all operators", activeRes.error?.message);
    } else {
      configs = activeRes.data as any;
    }
    if (!configs || configs.length === 0) {
      const allRes = await supabase.from("bets_configs").select("id, owner_id");
      if (allRes.error) throw allRes.error;
      configs = (allRes.data as any) || [];
    }

    if (!configs || configs.length === 0) {
      return json(200, { success: true, operators: 0, results: [] });
    }

    const derivedLog = mapFixtureStatusToEventStatus(ev.fixture_status);
    console.log("[sync-football-event] fixture", {
      external_fixture_id: ev.external_fixture_id,
      fixture_status: ev.fixture_status ?? null,
      derived_status: derivedLog,
      operators: configs.length,
    });

    const results: Array<{ owner_id: string; ok: boolean; error?: string; data?: unknown }> = [];

    for (const cfg of configs) {
      try {
        const r = await syncForOwner(supabase, cfg.owner_id, cfg.id, ev, markets);
        results.push({ owner_id: cfg.owner_id, ok: true, data: r });
      } catch (e: any) {
        console.error("sync-football-event owner failed", cfg.owner_id, e);
        results.push({ owner_id: cfg.owner_id, ok: false, error: e?.message || String(e) });
      }
    }

    return json(200, {
      success: true,
      operators: configs.length,
      synced: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err: any) {
    console.error("sync-football-event error", err);
    return json(500, { error: err?.message || "Failed to sync event" });
  }
});
