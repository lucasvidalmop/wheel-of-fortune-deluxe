import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DEFAULT_MULTIPLIERS = [10, 5, 2, 1, 0.5, 0, 0.5, 1, 2, 5, 10];

/** Sorteia um slot respeitando pesos e devolve o caminho da bolinha até ele. */
function plinkoOutcome(rows: number, multipliers: number[], weights?: number[]) {
  const slots = multipliers.length;
  let slot: number;

  if (weights && weights.length === slots && weights.some((w) => w > 0)) {
    const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
    let r = Math.random() * total;
    slot = 0;
    for (let i = 0; i < slots; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) { slot = i; break; }
      slot = i;
    }
  } else {
    // distribuição binomial natural do plinko
    let rights = 0;
    for (let i = 0; i < rows; i++) if (Math.random() < 0.5) rights++;
    slot = Math.round((rights / rows) * (slots - 1));
  }

  // caminho com exatamente `rights` passos à direita, embaralhado
  const rights = Math.round((slot / (slots - 1)) * rows);
  const path = Array.from({ length: rows }, (_, i) => (i < rights ? 1 : 0));
  for (let i = path.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [path[i], path[j]] = [path[j], path[i]];
  }

  return { slot, path, multiplier: multipliers[slot] ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autorizado." }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData } = await anon.auth.getUser();
    const ownerId = userData?.user?.id;
    if (!ownerId) return json({ error: "Não autorizado." }, 401);

    const body = await req.json();
    const eventId = typeof body?.event_id === "string" ? body.event_id : "";
    const game = ["plinko", "roleta", "raspadinha", "slot"].includes(body?.game) ? body.game : "plinko";
    const prizeType = ["pix", "spins", "coins"].includes(body?.prize_type) ? body.prize_type : "pix";
    const baseAmount = Number(body?.base_amount) > 0 ? Number(body.base_amount) : 0;
    const participantId = typeof body?.participant_id === "string" ? body.participant_id : "";
    const gameConfig = body?.game_config && typeof body.game_config === "object" ? body.game_config : {};

    if (!eventId) return json({ error: "Evento inválido." }, 400);
    if (baseAmount <= 0) return json({ error: "Defina o valor base do prêmio." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: ev } = await admin
      .from("gorjeta_events")
      .select("id, owner_id, name")
      .eq("id", eventId)
      .maybeSingle();
    if (!ev || ev.owner_id !== ownerId) return json({ error: "Evento não encontrado." }, 404);

    // Participante: escolhido ou sorteado entre quem ainda não ganhou
    let participant: any = null;
    if (participantId) {
      const { data } = await admin
        .from("gorjeta_event_participants")
        .select("*")
        .eq("id", participantId)
        .eq("event_id", eventId)
        .maybeSingle();
      participant = data;
    } else {
      const { data: pool } = await admin
        .from("gorjeta_event_participants")
        .select("*")
        .eq("event_id", eventId)
        .eq("has_won", false);
      if (!pool || pool.length === 0) return json({ error: "Nenhum participante disponível." }, 404);
      participant = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!participant) return json({ error: "Participante não encontrado." }, 404);

    // Resultado do jogo (calculado no servidor)
    const rows = Number(gameConfig.rows) > 0 ? Math.min(16, Number(gameConfig.rows)) : 12;
    const multipliers: number[] = Array.isArray(gameConfig.multipliers) && gameConfig.multipliers.length > 1
      ? gameConfig.multipliers.map((m: unknown) => Number(m) || 0)
      : DEFAULT_MULTIPLIERS;
    const weights: number[] | undefined = Array.isArray(gameConfig.weights)
      ? gameConfig.weights.map((w: unknown) => Number(w) || 0)
      : undefined;

    const outcome = plinkoOutcome(rows, multipliers, weights);
    const isWinner = outcome.multiplier > 0;
    const prizeAmount = isWinner ? Math.round(baseAmount * outcome.multiplier * 100) / 100 : 0;
    const prizeLabel = !isWinner
      ? "Não premiado"
      : prizeType === "pix"
        ? `R$ ${prizeAmount.toFixed(2).replace(".", ",")}`
        : prizeType === "spins"
          ? `${Math.round(prizeAmount)} giros`
          : `${Math.round(prizeAmount)} coins`;

    // Registra a rodada
    const { data: round } = await admin
      .from("gorjeta_event_rounds")
      .insert({
        event_id: eventId,
        owner_id: ownerId,
        game,
        title: `${game} · ${prizeLabel}`,
        game_config: { rows, multipliers, weights: weights ?? null, base_amount: baseAmount },
        prize_type: prizeType,
        prize_config: { base_amount: baseAmount, multiplier: outcome.multiplier },
        status: "finished",
      })
      .select("id")
      .single();

    // Entrega do prêmio
    let paymentId: string | null = null;
    if (isWinner) {
      if (prizeType === "pix") {
        const { data: pay } = await admin.rpc("create_prize_payment", {
          p_owner_id: ownerId,
          p_account_id: participant.account_id,
          p_user_name: participant.user_name,
          p_user_email: participant.user_email,
          p_prize: prizeLabel,
          p_amount: prizeAmount,
          p_spin_result_id: null,
          p_force_auto: false,
        });
        paymentId = (pay as any)?.payment_id ?? (pay as any)?.id ?? null;
      } else if (participant.wheel_user_id) {
        if (prizeType === "spins") {
          const { data: wu } = await admin
            .from("wheel_users").select("spins_available").eq("id", participant.wheel_user_id).maybeSingle();
          await admin.from("wheel_users")
            .update({ spins_available: (wu?.spins_available ?? 0) + Math.round(prizeAmount) })
            .eq("id", participant.wheel_user_id);
        } else {
          await admin.rpc("adjust_luckybox_tokens", {
            p_owner_id: ownerId,
            p_wheel_user_id: participant.wheel_user_id,
            p_delta: Math.round(prizeAmount),
          });
        }
      }

      await admin.from("gorjeta_event_participants")
        .update({ has_won: true })
        .eq("id", participant.id);
    }

    const { data: result } = await admin
      .from("gorjeta_event_results")
      .insert({
        event_id: eventId,
        round_id: round?.id ?? null,
        owner_id: ownerId,
        participant_id: participant.id,
        wheel_user_id: participant.wheel_user_id,
        user_name: participant.user_name,
        user_email: participant.user_email,
        account_id: participant.account_id,
        game,
        outcome: { slot: outcome.slot, path: outcome.path, multiplier: outcome.multiplier, rows },
        is_winner: isWinner,
        prize_type: prizeType,
        prize_label: prizeLabel,
        prize_amount: prizeAmount,
        prize_payment_id: paymentId,
        is_ghost: participant.is_ghost,
      })
      .select("*")
      .single();

    return json({
      ok: true,
      participant: {
        id: participant.id,
        name: participant.user_name,
        account_id: participant.account_id,
        entry_number: participant.entry_number,
      },
      outcome,
      is_winner: isWinner,
      prize_label: prizeLabel,
      prize_amount: prizeAmount,
      result_id: result?.id ?? null,
    });
  } catch (err) {
    console.error("play-event-round error", err);
    return json({ error: "Falha ao rodar a jogada." }, 500);
  }
});
