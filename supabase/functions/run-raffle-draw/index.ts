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
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  const userId = userData.user?.id;
  if (userErr || !userId) return json({ error: "Sessão inválida ou expirada." }, 401);

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
      .select("id, display_name, public_code, account_id, wheel_user_id")
      .eq("event_id", eventId).eq("status", "approved");

    // Fantasmas: mesma lista global do operador, liberados por evento
    // (quantidade + atraso configurados em raffle_events).
    const ghostCount = Number(ev.ghost_count || 0);
    const ghostDelayMinutes = Number(ev.ghost_delay_minutes || 0);
    let ghostEntries: { id: string; display_name: string; public_code: string; account_id: string; wheel_user_id?: string | null }[] = [];
    if (ghostCount > 0) {
      const elapsedMin = (Date.now() - new Date(ev.created_at).getTime()) / 60000;
      if (elapsedMin >= ghostDelayMinutes) {
        const { data: ownerConfig } = await admin
          .from("wheel_configs").select("config").eq("user_id", ev.owner_id).maybeSingle();
        const ghostNames: string[] = (ownerConfig?.config as any)?.ghostUsers || [];
        ghostEntries = ghostNames.slice(0, ghostCount).map((name, i) => ({
          id: `ghost_${i}`,
          display_name: name,
          public_code: `GST-${String(i + 1).padStart(5, "0")}`,
          account_id: `ghost_${i}`,
        }));
      }
    }

    const list = [...(pool || []), ...ghostEntries];
    if (list.length < Math.max(1, ev.min_participants || 0)) {
      return json({ error: `Participantes válidos insuficientes (${list.length}/${ev.min_participants}).` }, 409);
    }

    const winnersCount = Math.min(Math.max(1, ev.winners_count || 1), list.length);

    // Quantos dos vencedores devem ser especificamente fantasmas (nao apenas
    // "podem entrar no pool"). Sorteamos QUAIS posicoes serao fantasma, para
    // nao ficar sempre nas mesmas colocacoes.
    const ghostWinnersWanted = Math.min(
      Number(ev.ghost_winners_count || 0), ghostEntries.length, winnersCount,
    );
    const positions = Array.from({ length: winnersCount }, (_, i) => i);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const ghostSlots = new Set(positions.slice(0, ghostWinnersWanted));

    const remainingReal = [...(pool || [])];
    const remainingGhost = [...ghostEntries];
    const winners: Record<string, unknown>[] = [];
    const realWinners: { wheelUserId: string; name: string; code: string }[] = [];
    for (let i = 0; i < winnersCount; i++) {
      let w: { id: string; display_name: string; public_code: string; account_id: string; wheel_user_id?: string | null } | undefined;
      if (ghostSlots.has(i) && remainingGhost.length > 0) {
        w = remainingGhost.splice(secureRandomInt(remainingGhost.length), 1)[0];
      } else if (remainingReal.length > 0) {
        w = remainingReal.splice(secureRandomInt(remainingReal.length), 1)[0];
      } else if (remainingGhost.length > 0) {
        w = remainingGhost.splice(secureRandomInt(remainingGhost.length), 1)[0];
      }
      if (!w) break;
      winners.push({
        participantId: w.id,
        name: w.display_name,
        maskedName: maskName(w.display_name),
        code: w.public_code,
        position: i + 1,
      });
      if (w.wheel_user_id) {
        realWinners.push({ wheelUserId: w.wheel_user_id, name: w.display_name, code: w.public_code });
      }
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
    if (!draw) throw new Error("O resultado do sorteio não foi retornado após a gravação.");

    await admin.from("raffle_events").update({
      status: "finished",
      locked_at: ev.locked_at || new Date().toISOString(),
      locked_count: ev.locked_count || list.length,
    }).eq("id", eventId);

    // Avisa cada ganhador real pelo WhatsApp (instancia de Notificacoes),
    // um por um com 90s de intervalo para nao levar o numero a bloqueio.
    // So dispara se o operador ligou a notificacao para este evento.
    if (ev.notify_winners && realWinners.length > 0) {
      const { data: wheelUsers } = await admin
        .from("wheel_users")
        .select("id, phone")
        .in("id", realWinners.map((r) => r.wheelUserId));
      const phoneById = new Map((wheelUsers || []).map((u) => [u.id, u.phone]));
      const now = Date.now();
      const rows = realWinners
        .filter((r) => phoneById.get(r.wheelUserId))
        .map((r, i) => {
          const message = `🎉 Parabéns, ${r.name}!\n\nVocê foi sorteado no evento *${ev.name}*! 🏆\n\n🎁 Prêmio: ${ev.prize_label || "a combinar"}\n🎫 Código: ${r.code}\n\nEm breve entraremos em contato pra combinar a entrega/pagamento do seu prêmio. Fica de olho no WhatsApp!\n\nQualquer dúvida, é só responder essa mensagem.`;
          const sendAt = new Date(now + i * 90_000).toISOString();
          return {
            owner_id: ev.owner_id,
            channel: "whatsapp_notify",
            recipient_type: "phone",
            recipient_value: phoneById.get(r.wheelUserId),
            recipient_label: r.name,
            message,
            recurrence: "none",
            status: "pending",
            scheduled_at: sendAt,
            next_run_at: sendAt,
          };
        });
      if (rows.length > 0) await admin.from("scheduled_messages").insert(rows);
    }

    return json({
      ok: true,
      draw: {
        round: draw.round,
        executedAt: draw.executed_at,
        totalValid: list.length,
        winners: winners.map((w) => ({ name: w.maskedName, code: w.code, position: w.position })),
      },
    });
  } catch (err) {
    console.error("run-raffle-draw error", err);
    const message = err instanceof Error ? err.message : "Falha ao executar o sorteio.";
    return json({ error: message }, 500);
  }
});
