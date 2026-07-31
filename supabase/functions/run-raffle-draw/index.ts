import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, secureRandomInt, maskName } from "../_shared/raffle.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
  const userId = claimsData.claims.sub as string;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { eventId, redrawReason } = await req.json();
    if (!eventId) return json({ error: "eventId required" }, 400);

    const { data: ev } = await admin.from("raffle_events").select("*").eq("id", eventId).maybeSingle();
    if (!ev) return json({ error: "Evento não encontrado" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (ev.owner_id !== userId && !isAdmin) return json({ error: "Forbidden" }, 403);

    const { data: prevDraw } = await admin
      .from("raffle_draws").select("id, round").eq("event_id", eventId)
      .eq("superseded", false).order("round", { ascending: false }).limit(1).maybeSingle();

    if (prevDraw && !String(redrawReason || "").trim()) {
      return json({ error: "Informe a justificativa para refazer o sorteio." }, 400);
    }

    const { data: pool } = await admin
      .from("raffle_participants")
      .select("id, display_name, public_code, account_id")
      .eq("event_id", eventId).eq("status", "approved");

    const list = pool || [];
    if (list.length < Math.max(1, ev.min_participants || 0)) {
      return json({ error: `Participantes válidos insuficientes (${list.length}/${ev.min_participants}).` }, 409);
    }

    const winnersCount = Math.min(Math.max(1, ev.winners_count || 1), list.length);
    const remaining = [...list];
    const winners: Record<string, unknown>[] = [];
    for (let i = 0; i < winnersCount; i++) {
      const idx = secureRandomInt(remaining.length);
      const w = remaining.splice(idx, 1)[0];
      winners.push({
        participantId: w.id,
        name: w.display_name,
        maskedName: maskName(w.display_name),
        code: w.public_code,
        position: i + 1,
      });
    }

    if (prevDraw) {
      await admin.from("raffle_draws").update({ superseded: true }).eq("event_id", eventId).eq("superseded", false);
    }

    const { data: draw, error: drawErr } = await admin.from("raffle_draws").insert({
      event_id: eventId,
      owner_id: ev.owner_id,
      round: (prevDraw?.round || 0) + 1,
      participants_snapshot_count: list.length,
      winners,
      executed_by: userId,
      redraw_reason: String(redrawReason || "").trim(),
    }).select("*").maybeSingle();
    if (drawErr) throw drawErr;

    await admin.from("raffle_events").update({
      status: "finished",
      locked_at: ev.locked_at || new Date().toISOString(),
      locked_count: ev.locked_count || list.length,
    }).eq("id", eventId);

    return json({
      ok: true,
      draw: {
        round: draw!.round,
        executedAt: draw!.executed_at,
        totalValid: list.length,
        winners: winners.map((w) => ({ name: w.maskedName, code: w.code, position: w.position })),
      },
    });
  } catch (err) {
    console.error("run-raffle-draw error", err);
    return json({ error: "Falha ao executar o sorteio." }, 500);
  }
});
