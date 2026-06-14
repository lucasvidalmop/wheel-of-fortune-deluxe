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
  is_national_team?: boolean;
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

// ---- Normalização de nomes (times, competições, mercados) para PT-BR ----
const TEAM_NAME_MAP: Record<string, string> = {
  "south africa": "África do Sul",
  "czech republic": "República Tcheca",
  "czechia": "República Tcheca",
  "united states": "Estados Unidos",
  "united states of america": "Estados Unidos",
  "usa": "Estados Unidos",
  "south korea": "Coreia do Sul",
  "korea republic": "Coreia do Sul",
  "republic of korea": "Coreia do Sul",
  "north korea": "Coreia do Norte",
  "korea dpr": "Coreia do Norte",
  "dpr korea": "Coreia do Norte",
  "ivory coast": "Costa do Marfim",
  "cote d'ivoire": "Costa do Marfim",
  "côte d'ivoire": "Costa do Marfim",
  "netherlands": "Holanda",
  "holland": "Holanda",
  "germany": "Alemanha",
  "spain": "Espanha",
  "england": "Inglaterra",
  "switzerland": "Suíça",
  "france": "França",
  "italy": "Itália",
  "belgium": "Bélgica",
  "portugal": "Portugal",
  "croatia": "Croácia",
  "serbia": "Sérvia",
  "poland": "Polônia",
  "denmark": "Dinamarca",
  "sweden": "Suécia",
  "norway": "Noruega",
  "finland": "Finlândia",
  "ireland": "Irlanda",
  "scotland": "Escócia",
  "wales": "País de Gales",
  "northern ireland": "Irlanda do Norte",
  "iceland": "Islândia",
  "austria": "Áustria",
  "hungary": "Hungria",
  "greece": "Grécia",
  "turkey": "Turquia",
  "türkiye": "Turquia",
  "russia": "Rússia",
  "ukraine": "Ucrânia",
  "romania": "Romênia",
  "bulgaria": "Bulgária",
  "slovakia": "Eslováquia",
  "slovenia": "Eslovênia",
  "albania": "Albânia",
  "bosnia and herzegovina": "Bósnia e Herzegovina",
  "north macedonia": "Macedônia do Norte",
  "cyprus": "Chipre",
  "luxembourg": "Luxemburgo",
  "estonia": "Estônia",
  "latvia": "Letônia",
  "lithuania": "Lituânia",
  "belarus": "Bielorrússia",
  "moldova": "Moldávia",
  "georgia": "Geórgia",
  "armenia": "Armênia",
  "azerbaijan": "Azerbaijão",
  "kazakhstan": "Cazaquistão",
  "uzbekistan": "Uzbequistão",
  "china": "China",
  "china pr": "China",
  "japan": "Japão",
  "australia": "Austrália",
  "new zealand": "Nova Zelândia",
  "india": "Índia",
  "indonesia": "Indonésia",
  "thailand": "Tailândia",
  "vietnam": "Vietnã",
  "philippines": "Filipinas",
  "singapore": "Singapura",
  "malaysia": "Malásia",
  "saudi arabia": "Arábia Saudita",
  "united arab emirates": "Emirados Árabes Unidos",
  "uae": "Emirados Árabes Unidos",
  "qatar": "Catar",
  "kuwait": "Kuwait",
  "bahrain": "Bahrein",
  "oman": "Omã",
  "jordan": "Jordânia",
  "lebanon": "Líbano",
  "syria": "Síria",
  "iraq": "Iraque",
  "iran": "Irã",
  "ir iran": "Irã",
  "israel": "Israel",
  "palestine": "Palestina",
  "egypt": "Egito",
  "morocco": "Marrocos",
  "algeria": "Argélia",
  "tunisia": "Tunísia",
  "libya": "Líbia",
  "senegal": "Senegal",
  "nigeria": "Nigéria",
  "ghana": "Gana",
  "cameroon": "Camarões",
  "kenya": "Quênia",
  "ethiopia": "Etiópia",
  "mali": "Mali",
  "cape verde": "Cabo Verde",
  "cape verde islands": "Cabo Verde",
  "congo": "Congo",
  "congo dr": "República Democrática do Congo",
  "dr congo": "República Democrática do Congo",
  "gabon": "Gabão",
  "angola": "Angola",
  "mozambique": "Moçambique",
  "zimbabwe": "Zimbábue",
  "zambia": "Zâmbia",
  "sudan": "Sudão",
  "brazil": "Brasil",
  "argentina": "Argentina",
  "chile": "Chile",
  "uruguay": "Uruguai",
  "paraguay": "Paraguai",
  "peru": "Peru",
  "colombia": "Colômbia",
  "ecuador": "Equador",
  "bolivia": "Bolívia",
  "venezuela": "Venezuela",
  "mexico": "México",
  "canada": "Canadá",
  "panama": "Panamá",
  "costa rica": "Costa Rica",
  "honduras": "Honduras",
  "guatemala": "Guatemala",
  "el salvador": "El Salvador",
  "nicaragua": "Nicarágua",
  "jamaica": "Jamaica",
  "haiti": "Haiti",
  "dominican republic": "República Dominicana",
  "cuba": "Cuba",
  "trinidad and tobago": "Trinidad e Tobago",
};

const COMPETITION_NAME_MAP: Record<string, string> = {
  "world cup": "Copa do Mundo",
  "fifa world cup": "Copa do Mundo",
  "world cup qualification": "Eliminatórias da Copa",
  "world cup - qualification": "Eliminatórias da Copa",
  "uefa champions league": "Liga dos Campeões",
  "champions league": "Liga dos Campeões",
  "uefa europa league": "Liga Europa",
  "europa league": "Liga Europa",
  "uefa europa conference league": "Liga Conferência",
  "uefa nations league": "Liga das Nações",
  "uefa euro": "Eurocopa",
  "european championship": "Eurocopa",
  "copa libertadores": "Libertadores",
  "conmebol libertadores": "Libertadores",
  "copa sudamericana": "Sul-Americana",
  "conmebol sudamericana": "Sul-Americana",
  "copa america": "Copa América",
  "copa américa": "Copa América",
  "brasileirao": "Brasileirão",
  "brasileirão": "Brasileirão",
  "serie a": "Brasileirão",
  "brasileirao serie a": "Brasileirão",
  "brasileirão série a": "Brasileirão",
  "brazilian serie a": "Brasileirão",
  "serie b": "Brasileirão Série B",
  "brasileirao serie b": "Brasileirão Série B",
  "copa do brasil": "Copa do Brasil",
  "fa cup": "Copa da Inglaterra",
  "efl cup": "Copa da Liga Inglesa",
  "carabao cup": "Copa da Liga Inglesa",
  "copa del rey": "Copa do Rei",
  "coppa italia": "Copa da Itália",
  "club world cup": "Mundial de Clubes",
  "fifa club world cup": "Mundial de Clubes",
  "africa cup of nations": "Copa Africana de Nações",
  "afc asian cup": "Copa Asiática",
  "gold cup": "Copa Ouro",
  "concacaf gold cup": "Copa Ouro",
};

// Mercados (exact match, lowercased)
const MARKET_NAME_MAP: Record<string, string> = {
  "match winner": "Vencedor da Partida",
  "full time result": "Vencedor da Partida",
  "1x2": "Vencedor da Partida",
  "home/away": "Casa/Fora",
  "double chance": "Dupla Chance",
  "both teams score": "Ambas Marcam",
  "both teams to score": "Ambas Marcam",
  "btts": "Ambas Marcam",
  "goals over/under": "Total de Gols",
  "goals over under": "Total de Gols",
  "total goals": "Total de Gols",
  "over/under": "Mais/Menos",
  "first half winner": "Vencedor do 1º Tempo",
  "second half winner": "Vencedor do 2º Tempo",
  "result of first half": "Resultado 1º Tempo",
  "result of second half": "Resultado 2º Tempo",
  "asian handicap": "Handicap Asiático",
  "handicap": "Handicap",
  "odd/even": "Ímpar/Par",
  "odd / even": "Ímpar/Par",
  "exact score": "Placar Exato",
  "correct score": "Placar Exato",
  "exact goals number": "Quantidade Exata de Gols",
  "home team total goals": "Total de Gols da Casa",
  "away team total goals": "Total de Gols do Fora",
  "corners over/under": "Total de Escanteios",
  "corners over under": "Total de Escanteios",
  "total corners": "Total de Escanteios",
  "total corners (3 way)": "Total de Escanteios",
  "corners 1x2": "Resultado em Escanteios",
  "corners asian handicap": "Handicap Asiático de Escanteios",
  "corners handicap": "Handicap de Escanteios",
  "corners odd/even": "Escanteios Ímpar/Par",
  "corners double chance": "Dupla Chance Escanteios",
  "home corners over/under": "Escanteios Casa Mais/Menos",
  "away corners over/under": "Escanteios Fora Mais/Menos",
  "cards over/under": "Total de Cartões",
  "cards over under": "Total de Cartões",
  "total cards": "Total de Cartões",
  "asian cards": "Handicap Asiático de Cartões",
  "cards handicap": "Handicap de Cartões",
  "cards asian handicap": "Handicap Asiático de Cartões",
  "yellow cards": "Cartões Amarelos",
  "red cards": "Cartões Vermelhos",
  "booking points": "Pontos de Cartões",
  "team cards": "Cartões por Time",
  "home team total cards": "Cartões Casa",
  "away team total cards": "Cartões Fora",
  "anytime goal scorer": "Jogador Marca a Qualquer Momento",
  "first goal scorer": "Primeiro Marcador",
  "last goal scorer": "Último Marcador",
  "player assists": "Assistências",
  "player shots on target": "Chutes no Gol",
  "player shots": "Finalizações do Jogador",
  "goalkeeper saves": "Defesas do Goleiro",
  "win to nil": "Vencer Sem Sofrer",
  "clean sheet": "Não Sofrer Gol",
  "to qualify": "Para Se Classificar",
  "half time/full time": "Intervalo/Final",
};

const normKey = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function normalizeTeamName(name: string | null | undefined): string {
  if (!name) return name ?? "";
  return TEAM_NAME_MAP[normKey(name)] ?? name;
}

function normalizeCompetitionName(name: string | null | undefined): string {
  if (!name) return name ?? "";
  const raw = String(name);
  const key = normKey(raw);
  if (COMPETITION_NAME_MAP[key]) return COMPETITION_NAME_MAP[key];
  for (const [k, v] of Object.entries(COMPETITION_NAME_MAP)) {
    if (key.includes(k)) return raw.replace(new RegExp(k, "i"), v);
  }
  return raw;
}

function normalizeMarketName(name: string | null | undefined): string {
  if (!name) return name ?? "";
  const raw = String(name);
  // Detect half-period suffix like "(1st Half)", "2nd Half"
  const re = /\s*\(?\s*(1st|first|2nd|second)\s+half\s*\)?\s*$/i;
  const m = raw.match(re);
  let base = raw;
  let suffix = "";
  if (m) {
    const which = m[1].toLowerCase();
    const isFirst = which === "1st" || which === "first";
    base = raw.slice(0, m.index).trim();
    suffix = isFirst ? " (1º Tempo)" : " (2º Tempo)";
  }
  const key = normKey(base);
  const mapped = MARKET_NAME_MAP[key];
  if (mapped) return mapped + suffix;
  return raw;
}

function normalizeInTitle(title: string | null | undefined): string {
  if (!title) return title ?? "";
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
  // ---- Detecta jogo de seleções (Copa do Mundo, Eliminatórias, Amistosos de seleção, etc.) ----
  const isNationalTeam =
    Boolean(ev.is_national_team) ||
    (ev.competition_slug ?? "").toLowerCase() === "selecoes";

  // Se for jogo de seleção e não veio categoria, força "Futebol"
  if (isNationalTeam && !ev.category) {
    ev.category = "Futebol";
  }

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
    // Mata-mata força true; jogos de seleção respeitam o is_hot do payload (sem auto-promoção).
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

  // ---- Normalização PT-BR (times, competição, mercados) ----
  ev.title = normalizeInTitle(ev.title);
  if (ev.subtitle) ev.subtitle = normalizeInTitle(ev.subtitle);
  if (ev.home_team) ev.home_team = normalizeTeamName(ev.home_team);
  if (ev.away_team) ev.away_team = normalizeTeamName(ev.away_team);
  if (ev.competition_name) ev.competition_name = normalizeCompetitionName(ev.competition_name);
  for (const mk of markets) {
    if (mk?.name) mk.name = normalizeMarketName(mk.name);
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
