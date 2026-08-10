// Shared helpers for the live raffle module.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return (xff.split(",")[0] || req.headers.get("cf-connecting-ip") || "").trim();
}

export function parseUA(ua: string) {
  const u = (ua || "").toLowerCase();
  const device = /mobile|iphone|android|ipad|tablet/.test(u)
    ? (/ipad|tablet/.test(u) ? "tablet" : "mobile")
    : "desktop";
  const os = /windows/.test(u) ? "Windows"
    : /iphone|ipad|ios/.test(u) ? "iOS"
    : /android/.test(u) ? "Android"
    : /mac os/.test(u) ? "macOS"
    : /linux/.test(u) ? "Linux" : "";
  const browser = /edg\//.test(u) ? "Edge"
    : /opr\/|opera/.test(u) ? "Opera"
    : /chrome\//.test(u) ? "Chrome"
    : /firefox/.test(u) ? "Firefox"
    : /safari/.test(u) ? "Safari" : "";
  return { device_type: device, os, browser };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function publicCode(prefix = "SRT"): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${prefix}-${out.slice(0, 3)}${out.slice(3)}`;
}

/** Uniform random integer in [0, max) using rejection sampling. */
export function secureRandomInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

/** "Joao Silva" -> "Jo*** S." ; keeps the live screen free of PII. */
export function maskName(name: string): string {
  const clean = (name || "").trim();
  if (!clean) return "Participante";
  const parts = clean.split(/\s+/);
  const first = parts[0];
  const head = first.slice(0, 2);
  const masked = `${head}${"*".repeat(Math.max(2, first.length - 2))}`;
  return parts.length > 1 ? `${masked} ${parts[parts.length - 1][0].toUpperCase()}.` : masked;
}

/** Descreve em texto o premio de um item da pool (ou o premio legado em dinheiro). */
export function prizeDisplayLabel(
  prize: { type: string; amount: number; caseName?: string; label?: string } | undefined,
  fallbackCashAmount: number,
): string {
  if (!prize) return `R$ ${fallbackCashAmount.toFixed(2).replace(".", ",")}`;
  if (prize.label) return prize.label;
  if (prize.type === "spin") return `${Math.max(1, Number(prize.amount || 1))} giro(s) grátis`;
  if (prize.type === "coin") return `${Math.max(1, Number(prize.amount || 1))} coins`;
  if (prize.type === "box") return prize.caseName || "Caixa surpresa";
  return `R$ ${Number(prize.amount || 0).toFixed(2).replace(".", ",")}`;
}

/** Monta a mensagem de aviso de ganho, com o premio real (dinheiro, giro, coin ou caixa). */
export function winnerNotifyMessage(
  winnerName: string, eventName: string, prizeLabel: string, code: string, autoPayment: boolean, isCash: boolean,
): string {
  const closing = !isCash
    ? "Seu prêmio já foi creditado na sua conta. Fica de olho no WhatsApp!"
    : autoPayment
      ? "Seu pagamento será feito automaticamente em até alguns minutos via PIX. Fica de olho no WhatsApp e no seu extrato!"
      : "Em breve entraremos em contato pra combinar o pagamento do seu prêmio. Fica de olho no WhatsApp!";
  return `🎉 Parabéns, ${winnerName}!\n\nVocê foi sorteado no evento *${eventName}*! 🏆\n\n🎁 Prêmio: ${prizeLabel}\n🎫 Código: ${code}\n\n${closing}\n\nQualquer dúvida, é só responder essa mensagem.`;
}

export function maskAccount(accountId: string): string {
  const a = (accountId || "").trim();
  if (a.length <= 4) return "****";
  return `${a.slice(0, 4)}${"*".repeat(Math.min(4, a.length - 4))}`;
}

/**
 * Executa o sorteio de um evento (fantasmas, selecao de ganhadores, gravacao
 * do draw e aviso de WhatsApp). Usado tanto pelo botao manual quanto pelo
 * disparo automatico agendado (draw_at + auto_draw).
 */
export async function runRaffleDraw(
  // deno-lint-ignore no-explicit-any
  admin: any,
  ev: Record<string, any>,
  executedBy: string,
  redrawReason: string,
) {
  const { data: prevDraw } = await admin
    .from("raffle_draws").select("id, round").eq("event_id", ev.id)
    .eq("superseded", false).order("round", { ascending: false }).limit(1).maybeSingle();

  const { data: pool } = await admin
    .from("raffle_participants")
    .select("id, display_name, public_code, account_id, email, wheel_user_id")
    .eq("event_id", ev.id).eq("status", "approved");

  const ghostCount = Number(ev.ghost_count || 0);
  const ghostDelayMinutes = Number(ev.ghost_delay_minutes || 0);
  let ghostEntries: { id: string; display_name: string; public_code: string; account_id: string; email?: string; wheel_user_id?: string | null }[] = [];
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
    throw new Error(`Participantes válidos insuficientes (${list.length}/${ev.min_participants}).`);
  }

  const winnersCount = Math.min(Math.max(1, ev.winners_count || 1), list.length);

  // Pool de premios pre-definida (giro/coin/caixa/dinheiro) configurada
  // pelo operador. Consome um item por posicao sorteada, de forma atomica
  // (lock de linha no banco), para nao correr risco de repetir premio numa
  // corrida com outro sorteio simultaneo. Se a pool estiver vazia (nenhum
  // plano configurado), cai no comportamento legado de premio unico em
  // dinheiro (ev.prize_amount) para todos os ganhadores reais.
  type PoolPrize = { type: string; amount: number; caseId?: string; caseName?: string; label?: string };
  let poolPrizes: PoolPrize[] = [];
  try {
    const { data: popped } = await admin.rpc("pop_raffle_prize_pool", {
      p_event_id: ev.id, p_count: winnersCount,
    });
    poolPrizes = Array.isArray(popped) ? popped : [];
  } catch (err) {
    console.error("runRaffleDraw: falha ao consumir pool de premios", err);
  }
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
  const realWinners: {
    wheelUserId: string; accountId: string; email: string; name: string; code: string; prize?: PoolPrize;
  }[] = [];
  for (let i = 0; i < winnersCount; i++) {
    let w: { id: string; display_name: string; public_code: string; account_id: string; email?: string; wheel_user_id?: string | null } | undefined;
    if (ghostSlots.has(i) && remainingGhost.length > 0) {
      w = remainingGhost.splice(secureRandomInt(remainingGhost.length), 1)[0];
    } else if (remainingReal.length > 0) {
      w = remainingReal.splice(secureRandomInt(remainingReal.length), 1)[0];
    } else if (remainingGhost.length > 0) {
      w = remainingGhost.splice(secureRandomInt(remainingGhost.length), 1)[0];
    }
    if (!w) break;
    const prize = poolPrizes[i];
    winners.push({
      participantId: w.id,
      name: w.display_name,
      maskedName: maskName(w.display_name),
      code: w.public_code,
      position: i + 1,
      ...(prize ? { prizeType: prize.type, prizeAmount: prize.amount, prizeLabel: prize.label, prizeCaseName: prize.caseName } : {}),
    });
    if (w.wheel_user_id) {
      realWinners.push({
        wheelUserId: w.wheel_user_id, accountId: w.account_id, email: w.email || "",
        name: w.display_name, code: w.public_code, prize,
      });
    }
  }

  if (prevDraw) {
    await admin.from("raffle_draws").update({ superseded: true }).eq("event_id", ev.id).eq("superseded", false);
  }

  const { data: draw, error: drawErr } = await admin.from("raffle_draws").insert({
    event_id: ev.id,
    owner_id: ev.owner_id,
    round: (prevDraw?.round || 0) + 1,
    participants_snapshot_count: list.length,
    winners,
    executed_by: executedBy,
    redraw_reason: String(redrawReason || "").trim(),
  }).select("*").maybeSingle();
  if (drawErr) throw drawErr;
  if (!draw) throw new Error("O resultado do sorteio não foi retornado após a gravação.");

  await admin.from("raffle_events").update({
    status: "finished",
    locked_at: ev.locked_at || new Date().toISOString(),
    locked_count: ev.locked_count || list.length,
  }).eq("id", ev.id);

  // Concede o premio de cada ganhador real. Quem recebeu um item da pool
  // pre-definida (giro/coin/caixa/dinheiro) tem o tipo dele respeitado; quem
  // nao recebeu (pool vazia/esgotada) cai no comportamento legado de premio
  // unico em dinheiro (ev.prize_amount) para manter compatibilidade com
  // eventos ja configurados antes dessa pool existir. O disparo do auto pay
  // em si NAO acontece aqui: vai para uma fila (auto_payout_queue)
  // processada com 1 minuto de intervalo entre cada pagamento, evitando
  // pagamento duplicado/em rajada no PIX.
  const legacyPrizeAmount = Number(ev.prize_amount || 0);
  const queueRows: Record<string, unknown>[] = [];
  let payoutDelay = 0;
  for (const r of realWinners) {
    const prize = r.prize;
    try {
      if (prize && prize.type === "spin") {
        const { data: wu } = await admin.from("wheel_users").select("spins_available").eq("id", r.wheelUserId).maybeSingle();
        await admin.from("wheel_users").update({
          spins_available: (wu?.spins_available || 0) + Math.max(1, Number(prize.amount || 1)),
        }).eq("id", r.wheelUserId);
      } else if (prize && prize.type === "coin") {
        const { data: wu } = await admin.from("wheel_users").select("tokens_balance").eq("id", r.wheelUserId).maybeSingle();
        await admin.from("wheel_users").update({
          tokens_balance: (wu?.tokens_balance || 0) + Math.max(1, Number(prize.amount || 1)),
        }).eq("id", r.wheelUserId);
      } else if (prize && prize.type === "box" && prize.caseId) {
        const code = Array.from({ length: 8 }, () =>
          "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 33)]).join("");
        const { data: grant } = await admin.from("luckybox_grants").insert({
          owner_id: ev.owner_id,
          case_id: prize.caseId,
          case_name: prize.caseName || "",
          wheel_user_id: r.wheelUserId,
          recipient_name: r.name,
          recipient_email: r.email,
          recipient_account_id: r.accountId,
          code,
          quantity: 1,
          status: "pending",
        }).select("id").maybeSingle();
        if (grant?.id) {
          try {
            await admin.rpc("auto_credit_luckybox_grant", { p_grant_id: grant.id });
          } catch (err) {
            console.error(`runRaffleDraw: falha ao creditar luckybox para ${r.wheelUserId}`, err);
          }
        }
      } else {
        // dinheiro: seja um item "cash" da pool, seja o premio legado unico.
        const amount = prize && prize.type === "cash" ? Number(prize.amount || 0) : legacyPrizeAmount;
        if (amount <= 0) continue;
        const { data: payment } = await admin.rpc("create_prize_payment", {
          p_owner_id: ev.owner_id,
          p_account_id: r.accountId,
          p_user_name: r.name,
          p_user_email: r.email,
          p_prize: prize?.label || ev.prize_label || `Sorteio ${ev.name}`,
          p_amount: amount,
          p_force_auto: !!ev.auto_payment,
        });
        if (payment?.id && (payment?.auto_payment || ev.auto_payment)) {
          queueRows.push({
            payment_id: payment.id,
            owner_id: ev.owner_id,
            event_id: ev.id,
            scheduled_at: new Date(Date.now() + payoutDelay * 60_000).toISOString(),
          });
          payoutDelay++;
        }
      }
    } catch (err) {
      console.error(`runRaffleDraw: falha ao conceder premio para ${r.wheelUserId}`, err);
    }
  }
  if (queueRows.length > 0) await admin.from("auto_payout_queue").insert(queueRows);

  if (ev.notify_winners && realWinners.length > 0) {
    const { data: wheelUsers } = await admin
      .from("wheel_users")
      .select("id, phone")
      .in("id", realWinners.map((r) => r.wheelUserId));
    const phoneById = new Map((wheelUsers || []).map((u: any) => [u.id, u.phone]));
    const now = Date.now();
    const rows = realWinners
      .filter((r) => phoneById.get(r.wheelUserId))
      .map((r, i) => {
        const isCash = !r.prize || r.prize.type === "cash";
        const prizeLabel = prizeDisplayLabel(r.prize, legacyPrizeAmount);
        const message = winnerNotifyMessage(r.name, ev.name, prizeLabel, r.code, !!ev.auto_payment, isCash);
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

  return {
    round: draw.round,
    executedAt: draw.executed_at,
    totalValid: list.length,
    winners: winners.map((w: any) => ({ name: w.maskedName, code: w.code, position: w.position })),
  };
}
