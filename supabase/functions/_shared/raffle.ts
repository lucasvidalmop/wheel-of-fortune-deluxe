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
    .select("id, display_name, public_code, account_id, wheel_user_id")
    .eq("event_id", ev.id).eq("status", "approved");

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
    throw new Error(`Participantes válidos insuficientes (${list.length}/${ev.min_participants}).`);
  }

  const winnersCount = Math.min(Math.max(1, ev.winners_count || 1), list.length);
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

  return {
    round: draw.round,
    executedAt: draw.executed_at,
    totalValid: list.length,
    winners: winners.map((w: any) => ({ name: w.maskedName, code: w.code, position: w.position })),
  };
}
