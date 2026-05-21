// Resolve a football fixture: marks event/markets/outcomes as resolved,
// settles single bet_wagers and multiple bet_tickets, credits coins.
// Idempotent: pending-only updates + once-resolved events are skipped.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WinnerHint {
  market_id?: string | null;
  market_title?: string | null;
  label?: string | null;        // winning outcome label
  outcome_id?: string | null;   // direct id (preferred)
}

interface Payload {
  external_fixture_id: string;
  status?: string;                 // raw final status from provider
  score?: { home?: number; away?: number } | null;
  winner?: "home" | "away" | "draw" | string | null;
  winning_outcome_ids?: string[];  // preferred: explicit outcome ids
  winners?: WinnerHint[];          // alternative: list by label/market
  // Whether to also force-lose unresolved markets without a declared winner.
  // Default false — only declared markets are resolved.
  resolve_all_markets?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Shared-secret auth (VPS -> function)
  const expected = Deno.env.get("RESOLVE_FOOTBALL_SECRET");
  const got = req.headers.get("x-webhook-secret") || "";
  if (!expected || got !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const fixtureId = String(body?.external_fixture_id || "").trim();
  if (!fixtureId) return json({ error: "missing_external_fixture_id" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1) Locate all bet_events with this fixture (multi-tenant safe).
  const { data: events, error: evErr } = await supabase
    .from("bet_events")
    .select("id, owner_id, status, winning_outcome_id")
    .eq("external_fixture_id", fixtureId);
  if (evErr) return json({ error: "db_error", detail: evErr.message }, 500);
  if (!events || events.length === 0) return json({ ok: true, events_found: 0 });

  const results: any[] = [];

  for (const ev of events) {
    try {
      const r = await resolveEvent(supabase, ev, body);
      results.push({ event_id: ev.id, ...r });
    } catch (e) {
      console.error("resolveEvent failed", ev.id, e);
      results.push({ event_id: ev.id, error: String((e as Error).message || e) });
    }
  }

  return json({ ok: true, fixture: fixtureId, events: results });
});

async function resolveEvent(supabase: any, ev: any, body: Payload) {
  // Skip if already resolved — no double payouts. Still safe to re-run, but exit fast.
  const alreadyResolved = ev.status === "resolved";

  // Load all outcomes for this event
  const { data: outcomes, error: outErr } = await supabase
    .from("bet_outcomes")
    .select("id, event_id, market_id, label, odd, is_winner")
    .eq("event_id", ev.id);
  if (outErr) throw outErr;
  if (!outcomes || outcomes.length === 0) return { skipped: "no_outcomes" };

  // Build winning set
  const winningIds = new Set<string>();
  if (Array.isArray(body.winning_outcome_ids)) {
    for (const id of body.winning_outcome_ids) {
      if (outcomes.some((o: any) => o.id === id)) winningIds.add(id);
    }
  }
  if (Array.isArray(body.winners)) {
    for (const w of body.winners) {
      if (w.outcome_id && outcomes.some((o: any) => o.id === w.outcome_id)) {
        winningIds.add(w.outcome_id);
        continue;
      }
      const wantLabel = norm(w.label);
      const wantMarket = w.market_id || null;
      const wantMarketTitle = norm(w.market_title);
      if (!wantLabel) continue;
      const match = outcomes.find((o: any) => {
        if (norm(o.label) !== wantLabel) return false;
        if (wantMarket) return o.market_id === wantMarket;
        if (wantMarketTitle) return true; // resolved via market lookup below if needed
        return true;
      });
      if (match) winningIds.add(match.id);
    }
  }
  // Convenience: winner = home/away/draw maps to standard 1X2 labels in principal market
  if (winningIds.size === 0 && body.winner) {
    const w = String(body.winner).toLowerCase();
    const wantLabels = w === "home" ? ["home", "1", "casa"]
      : w === "away" ? ["away", "2", "fora"]
      : w === "draw" ? ["draw", "x", "empate"]
      : [];
    if (wantLabels.length) {
      const match = outcomes.find((o: any) => wantLabels.includes(norm(o.label) || ""));
      if (match) winningIds.add(match.id);
    }
  }

  if (winningIds.size === 0 && !alreadyResolved) {
    return { skipped: "no_winners_declared" };
  }

  // 2) Mark winning outcomes
  if (winningIds.size > 0) {
    await supabase.from("bet_outcomes")
      .update({ is_winner: true })
      .in("id", Array.from(winningIds));
    // Mark losers in the SAME market(s) as the winners (don't touch other markets)
    const winnerMarketIds = new Set<string | null>(
      outcomes.filter((o: any) => winningIds.has(o.id)).map((o: any) => o.market_id ?? null),
    );
    const loserIds = outcomes
      .filter((o: any) => !winningIds.has(o.id) && winnerMarketIds.has(o.market_id ?? null))
      .map((o: any) => o.id);
    if (loserIds.length) {
      await supabase.from("bet_outcomes")
        .update({ is_winner: false })
        .in("id", loserIds);
    }

    // Resolve markets that have a declared winner
    for (const mid of winnerMarketIds) {
      if (!mid) continue;
      await supabase.from("bet_markets")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), winning_outcome_id: outcomes.find((o:any)=>o.market_id===mid && winningIds.has(o.id))?.id })
        .eq("id", mid)
        .neq("status", "resolved");
    }
  }

  // 3) Mark event resolved (idempotent: only if not yet)
  const principalWinningId = ev.winning_outcome_id
    ?? outcomes.find((o: any) => winningIds.has(o.id) && !o.market_id)?.id
    ?? outcomes.find((o: any) => winningIds.has(o.id))?.id
    ?? null;

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

  // 4) Settle SINGLE wagers — only pending ones (avoids double pay).
  // Uses odd_snapshot — never recomputed.
  const { data: wagers } = await supabase
    .from("bet_wagers")
    .select("id, owner_id, wheel_user_id, account_id, user_email, outcome_id, amount_coins, odd_snapshot, status, payout_mode")
    .eq("event_id", ev.id)
    .eq("status", "pending");

  let wagersWon = 0, wagersLost = 0, coinsPaid = 0;
  const userCredits: Record<string, number> = {}; // wheel_user_id -> coins

  for (const w of (wagers || [])) {
    const isWinner = winningIds.has(w.outcome_id);
    if (isWinner) {
      const payout = Math.floor(Number(w.amount_coins || 0) * Number(w.odd_snapshot || 1));
      const { error } = await supabase.from("bet_wagers")
        .update({ status: "won", payout_coins: payout, resolved_at: new Date().toISOString() })
        .eq("id", w.id)
        .eq("status", "pending"); // guard against races
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
        // Notify owner about winning single ticket
        try {
          const [{ data: evRow }, { data: outRow }, { data: usrRow }] = await Promise.all([
            supabase.from("bet_events").select("title").eq("id", ev.id).maybeSingle(),
            supabase.from("bet_outcomes").select("label, market_id, odd").eq("id", w.outcome_id).maybeSingle(),
            w.wheel_user_id
              ? supabase.from("wheel_users").select("name").eq("id", w.wheel_user_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          let mkTitle = "";
          if (outRow?.market_id) {
            const { data: mk } = await supabase.from("bet_markets").select("title").eq("id", outRow.market_id).maybeSingle();
            mkTitle = mk?.title || "";
          }
          notifyOwner(w.owner_id, "ticket_won", {
            mode: "single",
            userName: (usrRow as any)?.name || "",
            userEmail: w.user_email || "",
            accountId: w.account_id || "",
            publicCode: null,
            amountTokens: Number(w.amount_coins || 0),
            totalOdd: Number(w.odd_snapshot || outRow?.odd || 0),
            payoutTokens: payout,
            selections: [{
              eventTitle: evRow?.title || "",
              marketTitle: mkTitle,
              selectionLabel: outRow?.label || "",
              odd: Number(w.odd_snapshot || outRow?.odd || 0),
            }],
          });
        } catch (e) { console.error("notify wager_won failed", e); }
      }
    } else {
      const { error } = await supabase.from("bet_wagers")
        .update({ status: "lost", payout_coins: 0, resolved_at: new Date().toISOString() })
        .eq("id", w.id)
        .eq("status", "pending");
      if (!error) wagersLost++;
    }
  }

  // 5) Settle MULTIPLE tickets — resolve selections for THIS event first.
  const { data: selections } = await supabase
    .from("bet_ticket_selections")
    .select("id, ticket_id, outcome_id, status")
    .eq("event_id", ev.id)
    .eq("status", "pending");

  const touchedTickets = new Set<string>();
  for (const s of (selections || [])) {
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
      // total_odd is locked at placement — never recompute
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
        // Notify owner about winning multiple ticket
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
    // else: still pending (waiting on other fixtures)
  }

  // 6) Credit users (batched per user)
  for (const [uid, amount] of Object.entries(userCredits)) {
    if (amount <= 0) continue;
    const { data: user } = await supabase
      .from("wheel_users").select("tokens_balance").eq("id", uid).maybeSingle();
    const current = Number(user?.tokens_balance || 0);
    await supabase.from("wheel_users")
      .update({ tokens_balance: current + amount, updated_at: new Date().toISOString() })
      .eq("id", uid);
  }

  return {
    already_resolved: alreadyResolved,
    winning_outcomes: Array.from(winningIds),
    wagers_won: wagersWon,
    wagers_lost: wagersLost,
    tickets_won: ticketsWon,
    tickets_lost: ticketsLost,
    coins_paid: coinsPaid,
  };
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
