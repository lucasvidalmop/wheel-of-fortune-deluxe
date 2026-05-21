// Notifies the owner about winning wagers/tickets for a manually resolved event
// or market. Called from the admin UI after resolve_bet_event / resolve_bet_market
// RPCs (which credit balances but don't trigger notifications).
// Idempotent-ish: only notifies wagers/tickets resolved within the last 5 minutes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  event_id?: string;
  market_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Resolve eventId from marketId if needed
  let eventId = body.event_id || null;
  if (!eventId && body.market_id) {
    const { data: mk } = await supabase.from("bet_markets").select("event_id").eq("id", body.market_id).maybeSingle();
    eventId = mk?.event_id || null;
  }
  if (!eventId) return json({ error: "missing_event_id" }, 400);

  const { data: ev } = await supabase
    .from("bet_events")
    .select("id, owner_id, title")
    .eq("id", eventId).maybeSingle();
  if (!ev) return json({ error: "event_not_found" }, 404);

  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // --- 1) Singles: grouped per outcome ---
  const wagerQuery = supabase
    .from("bet_wagers")
    .select("id, wheel_user_id, account_id, user_email, user_name, outcome_id, amount_coins, odd_snapshot, payout_coins, resolved_at")
    .eq("status", "won")
    .gte("resolved_at", cutoff);
  if (body.market_id) wagerQuery.eq("market_id", body.market_id);
  else wagerQuery.eq("event_id", eventId);
  const { data: wagers } = await wagerQuery;

  const winnersByOutcome: Record<string, any[]> = {};
  for (const w of (wagers || [])) {
    (winnersByOutcome[w.outcome_id] ||= []).push(w);
  }

  const outcomeIds = Object.keys(winnersByOutcome);
  let outRows: any[] = [];
  if (outcomeIds.length) {
    const { data } = await supabase
      .from("bet_outcomes").select("id, label, market_id, odd").in("id", outcomeIds);
    outRows = data || [];
  }
  const marketIds = Array.from(new Set(outRows.map((o) => o.market_id).filter(Boolean)));
  const marketTitles: Record<string, string> = {};
  if (marketIds.length) {
    const { data: mks } = await supabase.from("bet_markets").select("id, title").in("id", marketIds);
    for (const m of (mks || [])) marketTitles[m.id] = m.title || "";
  }

  let singlesNotified = 0;
  for (const outcomeId of outcomeIds) {
    const ws = winnersByOutcome[outcomeId];
    const outRow = outRows.find((o) => o.id === outcomeId);
    const mkTitle = outRow?.market_id ? (marketTitles[outRow.market_id] || "") : "";
    const enriched = ws.map((w) => ({
      userName: w.user_name || "",
      userEmail: w.user_email || "",
      accountId: w.account_id || "",
      amountTokens: Number(w.amount_coins || 0),
      payoutTokens: Number(w.payout_coins || 0),
    }));
    const totalPayout = enriched.reduce((s, w) => s + w.payoutTokens, 0);
    await notifyOwner(ev.owner_id, "ticket_won", {
      mode: "single",
      grouped: enriched.length > 1,
      count: enriched.length,
      eventTitle: ev.title || "",
      marketTitle: mkTitle,
      selectionLabel: outRow?.label || "",
      odd: Number(outRow?.odd || ws[0]?.odd_snapshot || 0),
      totalPayoutTokens: totalPayout,
      winners: enriched,
      userName: enriched[0]?.userName || "",
      userEmail: enriched[0]?.userEmail || "",
      accountId: enriched[0]?.accountId || "",
      amountTokens: enriched[0]?.amountTokens || 0,
      payoutTokens: enriched[0]?.payoutTokens || 0,
      totalOdd: Number(outRow?.odd || ws[0]?.odd_snapshot || 0),
      selections: [{
        eventTitle: ev.title || "",
        marketTitle: mkTitle,
        selectionLabel: outRow?.label || "",
        odd: Number(outRow?.odd || ws[0]?.odd_snapshot || 0),
      }],
    });
    singlesNotified++;
  }

  // --- 2) Multiples: any ticket that has a selection in this event/market and was just resolved as 'won' ---
  const selQuery = supabase
    .from("bet_ticket_selections")
    .select("ticket_id");
  if (body.market_id) selQuery.eq("market_id", body.market_id);
  else selQuery.eq("event_id", eventId);
  const { data: selRows } = await selQuery;
  const ticketIds = Array.from(new Set((selRows || []).map((s: any) => s.ticket_id)));

  let multiplesNotified = 0;
  if (ticketIds.length) {
    const { data: tickets } = await supabase
      .from("bet_tickets")
      .select("id, user_name, user_email, account_id, public_code, stake, total_odd, payout_coins, resolved_at, status")
      .in("id", ticketIds)
      .eq("status", "won")
      .gte("resolved_at", cutoff);

    for (const t of (tickets || [])) {
      // Only multiples (>1 selection)
      const { data: allSels } = await supabase
        .from("bet_ticket_selections")
        .select("event_title, market_title, selection_label, odd")
        .eq("ticket_id", t.id);
      if (!allSels || allSels.length < 2) continue;
      await notifyOwner(ev.owner_id, "ticket_won", {
        mode: "multiple",
        userName: t.user_name || "",
        userEmail: t.user_email || "",
        accountId: t.account_id || "",
        publicCode: t.public_code || null,
        amountTokens: Number(t.stake || 0),
        totalOdd: Number(t.total_odd || 0),
        payoutTokens: Number(t.payout_coins || 0),
        selections: allSels.map((s: any) => ({
          eventTitle: s.event_title || "",
          marketTitle: s.market_title || "",
          selectionLabel: s.selection_label || "",
          odd: Number(s.odd || 0),
        })),
      });
      multiplesNotified++;
    }
  }

  return json({ ok: true, singlesNotified, multiplesNotified });
});

async function notifyOwner(ownerId: string, type: string, payload: Record<string, any>) {
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-owner-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ ownerId, type, payload }),
    });
    if (!res.ok) console.error("notifyOwner non-ok", res.status, await res.text().catch(() => ""));
  } catch (e) { console.error("notifyOwner failed", e); }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
