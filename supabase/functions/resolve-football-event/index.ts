// Resolve a football fixture: marks event/markets/outcomes as resolved,
// settles single bet_wagers and multiple bet_tickets, credits coins.
//
// Source of truth: the FINAL SCORE.
// Each market is resolved from the score by its title + outcome labels.
// Unknown markets stay pending (we never blindly mark them lost).
//
// Idempotent: if the event is already resolved, winners are NOT re-written —
// we trust bet_outcomes.is_winner and only settle leftover pending wagers/tickets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WinnerHint {
  market_id?: string | null;
  market_title?: string | null;
  label?: string | null;
  outcome_id?: string | null;
}

interface FixtureStatsSide {
  corners?: number | null;
  yellow?: number | null;
  red?: number | null;
  cards?: number | null; // yellow + red
}
interface FixtureStats {
  home: FixtureStatsSide;
  away: FixtureStatsSide;
}

interface Payload {
  external_fixture_id: string;
  status?: string;
  score?: { home?: number; away?: number } | null;
  winner?: "home" | "away" | "draw" | string | null;
  winning_outcome_ids?: string[];
  winners?: WinnerHint[];
  stats?: FixtureStats | null;
}

interface Score { home: number; away: number }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("RESOLVE_FOOTBALL_SECRET");
  const got = req.headers.get("x-webhook-secret") || "";
  if (!expected || got !== expected) return json({ error: "unauthorized" }, 401);

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const fixtureId = String(body?.external_fixture_id || "").trim();
  if (!fixtureId) return json({ error: "missing_external_fixture_id" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: events, error: evErr } = await supabase
    .from("bet_events")
    .select("id, owner_id, status, winning_outcome_id, title")
    .eq("external_fixture_id", fixtureId);
  if (evErr) return json({ error: "db_error", detail: evErr.message }, 500);
  if (!events || events.length === 0) return json({ ok: true, events_found: 0 });

  const score: Score | null =
    body.score &&
    Number.isFinite(Number(body.score.home)) &&
    Number.isFinite(Number(body.score.away))
      ? { home: Number(body.score.home), away: Number(body.score.away) }
      : null;

  console.log(`[resolve] fixture=${fixtureId} score=${score ? `${score.home}-${score.away}` : "n/a"} winner_hint=${body.winner || "n/a"} events=${events.length}`);

  const results: any[] = [];
  for (const ev of events) {
    try {
      const r = await resolveEvent(supabase, ev, body, score, fixtureId);
      results.push({ event_id: ev.id, title: ev.title, ...r });
    } catch (e) {
      console.error(`[resolve] fixture=${fixtureId} event=${ev.id} ERROR`, e);
      results.push({ event_id: ev.id, error: String((e as Error).message || e) });
    }
  }

  return json({ ok: true, fixture: fixtureId, score, events: results });
});

async function resolveEvent(supabase: any, ev: any, body: Payload, score: Score | null, fixtureId: string) {
  const alreadyResolved = ev.status === "resolved";

  const [{ data: outcomes, error: outErr }, { data: markets }] = await Promise.all([
    supabase.from("bet_outcomes")
      .select("id, event_id, market_id, label, odd, is_winner")
      .eq("event_id", ev.id),
    supabase.from("bet_markets")
      .select("id, title, status")
      .eq("event_id", ev.id),
  ]);
  if (outErr) throw outErr;
  if (!outcomes || outcomes.length === 0) return { skipped: "no_outcomes" };

  const marketsById = new Map<string, any>((markets || []).map((m: any) => [m.id, m]));
  const outcomesByMarket = new Map<string, any[]>();
  for (const o of outcomes) {
    const k = o.market_id || "_none_";
    if (!outcomesByMarket.has(k)) outcomesByMarket.set(k, []);
    outcomesByMarket.get(k)!.push(o);
  }

  // winningIds = set of outcome_ids that win in this event (across markets)
  // resolvedMarketIds = markets that are considered settled in this call;
  //   wagers/selections on outcomes belonging to OTHER markets stay pending.
  const winningIds = new Set<string>();
  const resolvedMarketIds = new Set<string>();
  const perMarketLog: string[] = [];

  // Lazy fixture stats (corners/cards). Fetched only once if any
  // corners/cards market shows up; provided stats in payload short-circuit.
  let stats: FixtureStats | null = body.stats ?? null;
  let statsFetchTried = false;
  const ensureStats = async (): Promise<FixtureStats | null> => {
    if (stats || statsFetchTried) return stats;
    statsFetchTried = true;
    stats = await fetchFixtureStats(fixtureId);
    return stats;
  };

  if (alreadyResolved) {
    // Safety: never re-write winners. Trust what's persisted in the DB.
    for (const o of outcomes) if (o.is_winner) winningIds.add(o.id);
    for (const m of markets || []) if (m.status === "resolved") resolvedMarketIds.add(m.id);

    // BUT: still attempt corners/cards resolution for markets that are still open
    // (these markets were added after the score-based resolution ran).
    for (const m of (markets || [])) {
      if (m.status === "resolved") continue;
      const kind = cornersCardsKind(m.title);
      if (!kind) continue;
      const outs = outcomesByMarket.get(m.id) || [];
      const s = await ensureStats();
      const tag = kind === "corners" ? "[resolve-corners]" : "[resolve-cards]";
      if (!s) {
        console.log(`${tag} fixture=${fixtureId} market="${m.title}" stats_unavailable -> pending`);
        continue;
      }
      const res = deriveCornersCardsMarket(m.title, outs, s, kind);
      if (!res) {
        console.log(`${tag} fixture=${fixtureId} market="${m.title}" unrecognized -> pending`);
        continue;
      }
      console.log(`${tag} fixture=${fixtureId} market="${m.title}" winners=[${res.winnerLabels.join(", ") || "(push/no-pay)"}]`);
      resolvedMarketIds.add(m.id);
      for (const id of res.winnerIds) winningIds.add(id);
      perMarketLog.push(`market="${m.title}" winners=[${res.winnerLabels.join(", ") || "(none — push/no-pay)"}]`);
    }
  } else {
    // 1) Explicit winners from caller (preferred when given)
    if (Array.isArray(body.winning_outcome_ids)) {
      for (const id of body.winning_outcome_ids) {
        const o = outcomes.find((x: any) => x.id === id);
        if (o) {
          winningIds.add(id);
          if (o.market_id) resolvedMarketIds.add(o.market_id);
        }
      }
    }
    if (Array.isArray(body.winners)) {
      for (const w of body.winners) {
        if (w.outcome_id && outcomes.some((o: any) => o.id === w.outcome_id)) {
          const o = outcomes.find((x: any) => x.id === w.outcome_id)!;
          winningIds.add(w.outcome_id);
          if (o.market_id) resolvedMarketIds.add(o.market_id);
          continue;
        }
        const wantLabel = norm(w.label);
        const wantMarket = w.market_id || null;
        const wantMarketTitle = norm(w.market_title);
        if (!wantLabel) continue;
        const match = outcomes.find((o: any) => {
          if (norm(o.label) !== wantLabel) return false;
          if (wantMarket) return o.market_id === wantMarket;
          if (wantMarketTitle) {
            const mk = marketsById.get(o.market_id);
            return norm(mk?.title) === wantMarketTitle;
          }
          return true;
        });
        if (match) {
          winningIds.add(match.id);
          if (match.market_id) resolvedMarketIds.add(match.market_id);
        }
      }
    }

    // 2) Score-derived resolution PER MARKET (the real source of truth).
    for (const m of (markets || [])) {
      const outs = outcomesByMarket.get(m.id) || [];
      let res: { winnerIds: string[]; winnerLabels: string[] } | null = null;

      if (score) res = deriveMarketWinners(m.title, outs, score);

      if (!res) {
        const kind = cornersCardsKind(m.title);
        if (kind) {
          const s = await ensureStats();
          const tag = kind === "corners" ? "[resolve-corners]" : "[resolve-cards]";
          if (!s) {
            console.log(`${tag} fixture=${fixtureId} market="${m.title}" stats_unavailable -> pending`);
            continue;
          }
          res = deriveCornersCardsMarket(m.title, outs, s, kind);
          if (!res) {
            console.log(`${tag} fixture=${fixtureId} market="${m.title}" unrecognized -> pending`);
            continue;
          }
          console.log(`${tag} fixture=${fixtureId} market="${m.title}" winners=[${res.winnerLabels.join(", ") || "(push/no-pay)"}]`);
        }
      }

      if (!res) continue;
      resolvedMarketIds.add(m.id);
      for (const id of res.winnerIds) winningIds.add(id);
      perMarketLog.push(`market="${m.title}" winners=[${res.winnerLabels.join(", ") || "(none — push/no-pay)"}]`);
    }

    // 3) Convenience fallback: winner=home/away/draw, only when no score is given.
    if (!score && body.winner && winningIds.size === 0) {
      const w = String(body.winner).toLowerCase();
      const wantLabels = w === "home" ? ["home", "1", "casa"]
        : w === "away" ? ["away", "2", "fora"]
        : w === "draw" ? ["draw", "x", "empate"]
        : [];
      if (wantLabels.length) {
        const match = outcomes.find((o: any) => {
          if (!wantLabels.includes(norm(o.label))) return false;
          const mk = marketsById.get(o.market_id);
          return isPrincipalMatchWinner(mk?.title);
        }) || outcomes.find((o: any) => wantLabels.includes(norm(o.label)));
        if (match) {
          winningIds.add(match.id);
          if (match.market_id) resolvedMarketIds.add(match.market_id);
        }
      }
    }
  }



  if (winningIds.size === 0 && resolvedMarketIds.size === 0 && !alreadyResolved) {
    console.log(`[resolve] fixture=${fixtureId} event=${ev.id} skipped=no_winners_declared`);
    return { skipped: "no_winners_declared" };
  }

  // ── Mark winners/losers per resolved market (first-time resolutions only) ──
  if (!alreadyResolved) {
    if (winningIds.size > 0) {
      await supabase.from("bet_outcomes")
        .update({ is_winner: true })
        .in("id", Array.from(winningIds));
    }
    // Losers = every outcome in a resolved market that isn't a winner.
    // Markets resolved with no winner (e.g. Home/Away on a draw) get ALL outcomes flagged false.
    const loserIds: string[] = [];
    for (const mid of resolvedMarketIds) {
      const outs = outcomesByMarket.get(mid) || [];
      for (const o of outs) if (!winningIds.has(o.id)) loserIds.push(o.id);
    }
    if (loserIds.length) {
      await supabase.from("bet_outcomes")
        .update({ is_winner: false })
        .in("id", loserIds);
    }
    for (const mid of resolvedMarketIds) {
      const winnerOutcome = (outcomesByMarket.get(mid) || []).find((o: any) => winningIds.has(o.id));
      await supabase.from("bet_markets")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          winning_outcome_id: winnerOutcome?.id ?? null,
        })
        .eq("id", mid)
        .neq("status", "resolved");
    }
  }

  // Pick the principal winning outcome for the event row (Match Winner preferred).
  let principalWinningId: string | null = ev.winning_outcome_id || null;
  if (!principalWinningId) {
    for (const m of markets || []) {
      if (!isPrincipalMatchWinner(m.title)) continue;
      const w = (outcomesByMarket.get(m.id) || []).find((o: any) => winningIds.has(o.id));
      if (w) { principalWinningId = w.id; break; }
    }
    if (!principalWinningId) {
      principalWinningId = outcomes.find((o: any) => winningIds.has(o.id))?.id ?? null;
    }
  }

  if (!alreadyResolved) {
    await supabase.from("bet_events")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        winning_outcome_id: principalWinningId,
      })
      .eq("id", ev.id)
      .neq("status", "resolved");
  }

  // ── Settle SINGLE wagers — only pending, only for outcomes whose market we resolved ──
  const settleOutcomeIds = new Set<string>();
  for (const mid of resolvedMarketIds) {
    for (const o of (outcomesByMarket.get(mid) || [])) settleOutcomeIds.add(o.id);
  }

  const { data: wagers } = await supabase
    .from("bet_wagers")
    .select("id, owner_id, wheel_user_id, account_id, user_email, outcome_id, amount_coins, odd_snapshot, status, payout_mode")
    .eq("event_id", ev.id)
    .eq("status", "pending");

  let wagersWon = 0, wagersLost = 0, coinsPaid = 0;
  const userCredits: Record<string, number> = {};
  const winnersByOutcome: Record<string, Array<{
    userName: string; userEmail: string; accountId: string;
    amountTokens: number; payoutTokens: number; odd: number; wheel_user_id?: string | null;
  }>> = {};

  for (const w of (wagers || [])) {
    if (!settleOutcomeIds.has(w.outcome_id)) continue; // market not resolved here — leave pending
    const isWinner = winningIds.has(w.outcome_id);
    if (isWinner) {
      const payout = Math.floor(Number(w.amount_coins || 0) * Number(w.odd_snapshot || 1));
      const { error } = await supabase.from("bet_wagers")
        .update({ status: "won", payout_coins: payout, resolved_at: new Date().toISOString() })
        .eq("id", w.id)
        .eq("status", "pending");
      if (!error) {
        wagersWon++;
        if (payout > 0 && (w.payout_mode || "coins") === "coins") {
          coinsPaid += payout;
          if (w.wheel_user_id) {
            userCredits[w.wheel_user_id] = (userCredits[w.wheel_user_id] || 0) + payout;
          } else {
            await creditByAccount(supabase, w.owner_id, w.account_id, w.user_email, payout);
          }
        }
        (winnersByOutcome[w.outcome_id] ||= []).push({
          userName: "",
          userEmail: w.user_email || "",
          accountId: w.account_id || "",
          amountTokens: Number(w.amount_coins || 0),
          payoutTokens: payout,
          odd: Number(w.odd_snapshot || 0),
          wheel_user_id: w.wheel_user_id || null,
        });
      }
    } else {
      const { error } = await supabase.from("bet_wagers")
        .update({ status: "lost", payout_coins: 0, resolved_at: new Date().toISOString() })
        .eq("id", w.id)
        .eq("status", "pending");
      if (!error) wagersLost++;
    }
  }

  // Send grouped notifications per outcome (1 message per outcome, listing all winners)
  try {
    const outcomeIds = Object.keys(winnersByOutcome);
    if (outcomeIds.length > 0) {
      const [{ data: evRow }, { data: outRows }] = await Promise.all([
        supabase.from("bet_events").select("title").eq("id", ev.id).maybeSingle(),
        supabase.from("bet_outcomes").select("id, label, market_id, odd").in("id", outcomeIds),
      ]);
      const marketIds = Array.from(new Set((outRows || []).map((o: any) => o.market_id).filter(Boolean)));
      const marketTitles: Record<string, string> = {};
      if (marketIds.length) {
        const { data: mks } = await supabase.from("bet_markets").select("id, title").in("id", marketIds);
        for (const m of (mks || [])) marketTitles[m.id] = m.title || "";
      }
      const userIds = Array.from(new Set(Object.values(winnersByOutcome).flat().map((w) => w.wheel_user_id).filter(Boolean))) as string[];
      const nameById: Record<string, string> = {};
      if (userIds.length) {
        const { data: usrs } = await supabase.from("wheel_users").select("id, name").in("id", userIds);
        for (const u of (usrs || [])) nameById[u.id] = u.name || "";
      }
      for (const outcomeId of outcomeIds) {
        const winners = winnersByOutcome[outcomeId];
        const outRow = (outRows || []).find((o: any) => o.id === outcomeId);
        const mkTitle = outRow?.market_id ? (marketTitles[outRow.market_id] || "") : "";
        const enrichedWinners = winners.map((w) => ({
          userName: w.wheel_user_id ? (nameById[w.wheel_user_id] || "") : "",
          userEmail: w.userEmail,
          accountId: w.accountId,
          amountTokens: w.amountTokens,
          payoutTokens: w.payoutTokens,
        }));
        const totalPayout = winners.reduce((s, w) => s + w.payoutTokens, 0);
        notifyOwner(ev.owner_id, "ticket_won", {
          mode: "single",
          grouped: winners.length > 1,
          count: winners.length,
          eventTitle: evRow?.title || "",
          marketTitle: mkTitle,
          selectionLabel: outRow?.label || "",
          odd: Number(outRow?.odd || winners[0]?.odd || 0),
          totalPayoutTokens: totalPayout,
          winners: enrichedWinners,
          userName: enrichedWinners[0]?.userName || "",
          userEmail: enrichedWinners[0]?.userEmail || "",
          accountId: enrichedWinners[0]?.accountId || "",
          amountTokens: enrichedWinners[0]?.amountTokens || 0,
          payoutTokens: enrichedWinners[0]?.payoutTokens || 0,
          totalOdd: Number(outRow?.odd || winners[0]?.odd || 0),
          selections: [{
            eventTitle: evRow?.title || "",
            marketTitle: mkTitle,
            selectionLabel: outRow?.label || "",
            odd: Number(outRow?.odd || winners[0]?.odd || 0),
          }],
        });
      }
    }
  } catch (e) { console.error("notify grouped wagers_won failed", e); }

  // ── Settle MULTIPLE tickets — selections in resolved markets only ──
  const { data: selections } = await supabase
    .from("bet_ticket_selections")
    .select("id, ticket_id, outcome_id, status")
    .eq("event_id", ev.id)
    .eq("status", "pending");

  const touchedTickets = new Set<string>();
  for (const s of (selections || [])) {
    if (!settleOutcomeIds.has(s.outcome_id)) continue; // leave pending; other market resolves later
    const won = winningIds.has(s.outcome_id);
    await supabase.from("bet_ticket_selections")
      .update({ status: won ? "won" : "lost" })
      .eq("id", s.id)
      .eq("status", "pending");
    touchedTickets.add(s.ticket_id);
  }

  let ticketsWon = 0, ticketsLost = 0;
  for (const tid of touchedTickets) {
    const { data: ticket } = await supabase
      .from("bet_tickets")
      .select("id, owner_id, wheel_user_id, account_id, user_email, user_name, public_code, stake, total_odd, status")
      .eq("id", tid)
      .maybeSingle();
    if (!ticket || ticket.status !== "pending") continue;

    const { data: allSels } = await supabase
      .from("bet_ticket_selections")
      .select("status")
      .eq("ticket_id", tid);

    const sels = allSels || [];
    if (sels.some((s: any) => s.status === "lost")) {
      const { error } = await supabase.from("bet_tickets")
        .update({ status: "lost", payout_coins: 0, resolved_at: new Date().toISOString() })
        .eq("id", tid)
        .eq("status", "pending");
      if (!error) ticketsLost++;
    } else if (sels.length > 0 && sels.every((s: any) => s.status === "won")) {
      const payout = Math.floor(Number(ticket.stake || 0) * Number(ticket.total_odd || 1));
      const { error } = await supabase.from("bet_tickets")
        .update({ status: "won", payout_coins: payout, resolved_at: new Date().toISOString() })
        .eq("id", tid)
        .eq("status", "pending");
      if (!error) {
        ticketsWon++;
        coinsPaid += payout;
        if (ticket.wheel_user_id) {
          userCredits[ticket.wheel_user_id] = (userCredits[ticket.wheel_user_id] || 0) + payout;
        } else {
          await creditByAccount(supabase, ticket.owner_id, ticket.account_id, ticket.user_email, payout);
        }
        try {
          const { data: allSelDetails } = await supabase
            .from("bet_ticket_selections")
            .select("event_title, market_title, selection_label, odd")
            .eq("ticket_id", tid);
          notifyOwner(ticket.owner_id, "ticket_won", {
            mode: "multiple",
            userName: ticket.user_name || "",
            userEmail: ticket.user_email || "",
            accountId: ticket.account_id || "",
            publicCode: ticket.public_code || null,
            amountTokens: Number(ticket.stake || 0),
            totalOdd: Number(ticket.total_odd || 0),
            payoutTokens: payout,
            selections: (allSelDetails || []).map((s: any) => ({
              eventTitle: s.event_title || "",
              marketTitle: s.market_title || "",
              selectionLabel: s.selection_label || "",
              odd: Number(s.odd || 0),
            })),
          });
        } catch (e) { console.error("notify ticket_won failed", e); }
      }
    }
  }

  // ── Credit users (batched per user) ──
  for (const [uid, amount] of Object.entries(userCredits)) {
    if (amount <= 0) continue;
    const { data: user } = await supabase
      .from("wheel_users").select("tokens_balance").eq("id", uid).maybeSingle();
    const current = Number(user?.tokens_balance || 0);
    await supabase.from("wheel_users")
      .update({ tokens_balance: current + amount, updated_at: new Date().toISOString() })
      .eq("id", uid);
  }

  console.log(
    `[resolve] fixture=${fixtureId} event=${ev.id} title="${ev.title}" already_resolved=${alreadyResolved} ` +
    `score=${score ? `${score.home}-${score.away}` : "n/a"} markets_resolved=${resolvedMarketIds.size} ` +
    `wagers_won=${wagersWon} wagers_lost=${wagersLost} tickets_won=${ticketsWon} tickets_lost=${ticketsLost} ` +
    `coins_paid=${coinsPaid}` + (perMarketLog.length ? ` | ${perMarketLog.join(" | ")}` : "")
  );

  return {
    already_resolved: alreadyResolved,
    markets_resolved: resolvedMarketIds.size,
    winning_outcomes: Array.from(winningIds),
    wagers_won: wagersWon,
    wagers_lost: wagersLost,
    tickets_won: ticketsWon,
    tickets_lost: ticketsLost,
    coins_paid: coinsPaid,
  };
}

// ─────────────────────────────────────────────────────────────
// Score-based market resolution. Returns null for unknown markets.
// `winnerIds` may be empty when a market is resolved but pays no one
// (e.g. Home/Away on a draw — everyone loses, no payouts).
// ─────────────────────────────────────────────────────────────
function deriveMarketWinners(
  title: string | null | undefined,
  outcomes: any[],
  score: Score,
): { winnerIds: string[]; winnerLabels: string[] } | null {
  const t = norm(title);
  const find = (labels: string[]) => outcomes.find((o: any) => labels.includes(norm(o.label)));
  const isDraw = score.home === score.away;
  const homeWon = score.home > score.away;
  const awayWon = score.away > score.home;

  // Match Winner / 1X2 / Resultado Final / Vencedor
  if ([
    "match winner", "full time result", "resultado final", "1x2",
    "vencedor", "vencedor da partida", "vencedor do jogo", "resultado",
  ].includes(t)) {
    const w = homeWon ? find(["home", "1", "casa"])
      : awayWon ? find(["away", "2", "fora"])
      : find(["draw", "x", "empate"]);
    if (!w) return null;
    return { winnerIds: [w.id], winnerLabels: [w.label] };
  }

  // Home/Away — DRAW MUST NEVER PAY. Market resolves with no winner.
  if (t === "home/away") {
    if (isDraw) return { winnerIds: [], winnerLabels: [] };
    const w = homeWon ? find(["home", "1", "casa"]) : find(["away", "2", "fora"]);
    if (!w) return null;
    return { winnerIds: [w.id], winnerLabels: [w.label] };
  }

  // Double Chance / Dupla Chance
  if (t === "double chance" || t === "dupla chance" || t === "chance dupla") {
    const winners: any[] = [];
    if (homeWon || isDraw) { const w = find(["home/draw", "1x", "casa/empate"]); if (w) winners.push(w); }
    if (awayWon || isDraw) { const w = find(["draw/away", "x2", "empate/fora"]); if (w) winners.push(w); }
    if (homeWon || awayWon) { const w = find(["home/away", "12", "casa/fora"]); if (w) winners.push(w); }
    if (winners.length === 0) return null;
    return { winnerIds: winners.map((w) => w.id), winnerLabels: winners.map((w) => w.label) };
  }

  // Both Teams To Score
  if (
    t === "both teams score" || t === "both teams to score" ||
    t === "ambas equipes marcam" || t === "ambas marcam" ||
    t === "ambos os times marcam" || t === "btts"
  ) {
    const yes = score.home > 0 && score.away > 0;
    const w = yes ? find(["yes", "sim"]) : find(["no", "não", "nao"]);
    if (!w) return null;
    return { winnerIds: [w.id], winnerLabels: [w.label] };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Corners / Cards markets
// ─────────────────────────────────────────────────────────────
function cornersCardsKind(title: string | null | undefined): "corners" | "cards" | null {
  const t = norm(title);
  if (!t) return null;
  if (t.includes("corner") || t.includes("escanteio")) return "corners";
  if (t.includes("card") || t.includes("cartao") || t.includes("cartão") || t.includes("cartões") || t.includes("cartoes")) return "cards";
  return null;
}

// Returns side-scoped value depending on title keywords (home/away/total).
function pickMetric(
  title: string,
  stats: FixtureStats,
  kind: "corners" | "cards",
): { home: number | null; away: number | null; total: number | null; scope: "home" | "away" | "total" } {
  const t = norm(title);
  const scope: "home" | "away" | "total" =
    /\b(home|casa|mandante)\b/.test(t) ? "home" :
    /\b(away|fora|visitante)\b/.test(t) ? "away" :
    "total";

  let metricKey: "corners" | "yellow" | "red" | "cards" = kind;
  if (kind === "cards") {
    if (t.includes("yellow") || t.includes("amarelo")) metricKey = "yellow";
    else if (t.includes("red") || t.includes("vermelho")) metricKey = "red";
    else metricKey = "cards";
  }

  const h = stats.home?.[metricKey] ?? null;
  const a = stats.away?.[metricKey] ?? null;
  const total = h == null || a == null ? null : Number(h) + Number(a);
  return { home: h == null ? null : Number(h), away: a == null ? null : Number(a), total, scope };
}

function parseOverUnder(label: string): { side: "over" | "under"; line: number } | null {
  const l = norm(label);
  const m = l.match(/^(over|under|acima|abaixo|mais de|menos de|mais|menos|\+|\-)\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!m) {
    const m2 = l.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(over|under|acima|abaixo|\+|\-)$/);
    if (!m2) return null;
    const line = parseFloat(m2[1].replace(",", "."));
    const sideRaw = m2[2];
    return { side: /over|acima|\+/.test(sideRaw) ? "over" : "under", line };
  }
  const sideRaw = m[1];
  const line = parseFloat(m[2].replace(",", "."));
  const side: "over" | "under" =
    /over|acima|mais de|mais|\+/.test(sideRaw) ? "over" : "under";
  return { side, line };
}

// "home -1.5", "+2.5 away", "casa -1", "away +0"
function parseHandicap(label: string): { team: "home" | "away"; line: number } | null {
  const l = norm(label);
  const m = l.match(/(home|away|casa|fora|mandante|visitante)\s*([+\-]?\s*[0-9]+(?:[.,][0-9]+)?)/);
  if (!m) {
    const m2 = l.match(/([+\-]?\s*[0-9]+(?:[.,][0-9]+)?)\s*(home|away|casa|fora|mandante|visitante)/);
    if (!m2) return null;
    const team: "home" | "away" = /home|casa|mandante/.test(m2[2]) ? "home" : "away";
    const line = parseFloat(m2[1].replace(/\s+/g, "").replace(",", "."));
    return { team, line };
  }
  const team: "home" | "away" = /home|casa|mandante/.test(m[1]) ? "home" : "away";
  const line = parseFloat(m[2].replace(/\s+/g, "").replace(",", "."));
  return { team, line };
}

function deriveCornersCardsMarket(
  title: string | null | undefined,
  outcomes: any[],
  stats: FixtureStats,
  kind: "corners" | "cards",
): { winnerIds: string[]; winnerLabels: string[] } | null {
  const t = norm(title);
  const metric = pickMetric(String(title || ""), stats, kind);
  const scopedValue =
    metric.scope === "home" ? metric.home :
    metric.scope === "away" ? metric.away :
    metric.total;

  // Over/Under (any scope)
  if (t.includes("over") || t.includes("under") || t.includes("acima") || t.includes("abaixo")) {
    if (scopedValue == null) return null;
    const winners: any[] = [];
    for (const o of outcomes) {
      const p = parseOverUnder(o.label);
      if (!p) continue;
      if (p.side === "over" && scopedValue > p.line) winners.push(o);
      else if (p.side === "under" && scopedValue < p.line) winners.push(o);
      // equality => push, no winner
    }
    if (winners.length === 0 && !outcomes.some((o) => parseOverUnder(o.label))) return null;
    return { winnerIds: winners.map((w) => w.id), winnerLabels: winners.map((w) => w.label) };
  }

  // Asian Handicap / Handicap
  if (t.includes("handicap") || t.includes("asian")) {
    if (metric.home == null || metric.away == null) return null;
    const winners: any[] = [];
    for (const o of outcomes) {
      const p = parseHandicap(o.label);
      if (!p) continue;
      const adjusted = p.team === "home"
        ? (metric.home + p.line) - metric.away
        : (metric.away + p.line) - metric.home;
      if (adjusted > 0) winners.push(o);
    }
    if (winners.length === 0 && !outcomes.some((o) => parseHandicap(o.label))) return null;
    return { winnerIds: winners.map((w) => w.id), winnerLabels: winners.map((w) => w.label) };
  }

  // 1x2 style (home / draw / away) — compare home vs away stat
  const find = (labels: string[]) => outcomes.find((o: any) => labels.includes(norm(o.label)));
  const has1x2 =
    find(["home", "1", "casa", "mandante"]) ||
    find(["away", "2", "fora", "visitante"]) ||
    find(["draw", "x", "empate"]);
  if (has1x2) {
    if (metric.home == null || metric.away == null) return null;
    const homeWon = metric.home > metric.away;
    const awayWon = metric.away > metric.home;
    const w = homeWon ? find(["home", "1", "casa", "mandante"])
      : awayWon ? find(["away", "2", "fora", "visitante"])
      : find(["draw", "x", "empate"]);
    if (!w) return null;
    return { winnerIds: [w.id], winnerLabels: [w.label] };
  }

  return null;
}

async function fetchFixtureStats(fixtureId: string): Promise<FixtureStats | null> {
  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) {
    console.log(`[resolve-stats] API_FOOTBALL_KEY missing; cannot fetch fixture stats`);
    return null;
  }
  try {
    const [statsRes, fxRes] = await Promise.all([
      fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${encodeURIComponent(fixtureId)}`, {
        headers: { "x-apisports-key": apiKey },
      }),
      fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(fixtureId)}`, {
        headers: { "x-apisports-key": apiKey },
      }),
    ]);
    if (!statsRes.ok || !fxRes.ok) {
      console.log(`[resolve-stats] fetch failed stats=${statsRes.status} fx=${fxRes.status}`);
      return null;
    }
    const statsJson = await statsRes.json();
    const fxJson = await fxRes.json();
    const fx = fxJson?.response?.[0];
    const homeId = fx?.teams?.home?.id;
    const awayId = fx?.teams?.away?.id;
    const rows: any[] = statsJson?.response || [];
    if (!homeId || !awayId || rows.length === 0) {
      console.log(`[resolve-stats] fixture=${fixtureId} stats_empty`);
      return null;
    }
    const sideOf = (teamId: number): FixtureStatsSide => {
      const r = rows.find((x: any) => x?.team?.id === teamId);
      const list: any[] = r?.statistics || [];
      const pick = (names: string[]) => {
        for (const n of names) {
          const found = list.find((s: any) => norm(s?.type) === norm(n));
          if (found && found.value != null) {
            const v = Number(String(found.value).replace("%", ""));
            if (Number.isFinite(v)) return v;
          }
        }
        return null;
      };
      const yellow = pick(["Yellow Cards"]);
      const red = pick(["Red Cards"]);
      const cards = yellow == null && red == null ? null : (Number(yellow || 0) + Number(red || 0));
      return {
        corners: pick(["Corner Kicks", "Corners"]),
        yellow,
        red,
        cards,
      };
    };
    const out: FixtureStats = { home: sideOf(homeId), away: sideOf(awayId) };
    console.log(`[resolve-stats] fixture=${fixtureId} home=${JSON.stringify(out.home)} away=${JSON.stringify(out.away)}`);
    return out;
  } catch (e) {
    console.error(`[resolve-stats] fixture=${fixtureId} error`, e);
    return null;
  }
}

function isPrincipalMatchWinner(title: string | null | undefined) {
  return [
    "match winner", "full time result", "resultado final", "1x2",
    "vencedor", "vencedor da partida", "vencedor do jogo", "resultado",
  ].includes(norm(title));
}

async function creditByAccount(supabase: any, ownerId: string, accountId: string, email: string, amount: number) {
  if (!ownerId || amount <= 0) return;
  let q = supabase.from("wheel_users").select("id, tokens_balance").eq("owner_id", ownerId).limit(1);
  if (accountId) q = q.eq("account_id", accountId);
  else if (email) q = q.eq("email", email);
  else return;
  const { data: user } = await q.maybeSingle();
  if (!user) return;
  const current = Number(user.tokens_balance || 0);
  await supabase.from("wheel_users")
    .update({ tokens_balance: current + amount, updated_at: new Date().toISOString() })
    .eq("id", user.id);
}

function notifyOwner(ownerId: string, type: string, payload: Record<string, any>) {
  try {
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-owner-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ ownerId, type, payload }),
    }).catch((e) => console.error("notifyOwner fetch failed", e));
  } catch (e) { console.error("notifyOwner failed", e); }
}

function norm(s: string | null | undefined): string {
  return (s || "").toString().trim().toLowerCase();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
