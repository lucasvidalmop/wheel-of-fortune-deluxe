import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, clientIp, parseUA, publicCode } from "../_shared/raffle.ts";

const NEUTRAL_REVIEW = "Sua inscrição foi recebida e está em análise. Você será avisado se for aprovada.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let eventId: string | null = null;
  let ownerId: string | null = null;
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";
  let email = "";
  let accountId = "";

  const logAttempt = async (outcome: string, detail = "") => {
    try {
      await supabase.from("raffle_attempts").insert({
        event_id: eventId, owner_id: ownerId, email, account_id: accountId,
        ip_address: ip || null, outcome, detail,
      });
    } catch { /* audit only */ }
  };

  try {
    const body = await req.json();
    const tag = String(body?.tag || "").trim();
    email = String(body?.email || "").trim().toLowerCase();
    accountId = String(body?.accountId || "").trim();
    const displayName = String(body?.displayName || "").trim().slice(0, 60);
    const fingerprint = String(body?.fingerprint || "").trim().slice(0, 120);
    const accepted = body?.accepted === true;

    if (!tag) return json({ ok: false, error: "Evento não informado." }, 400);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: "Informe um e-mail válido." }, 400);
    }
    if (!accountId || accountId.length > 40) {
      return json({ ok: false, error: "Informe o seu ID da conta." }, 400);
    }
    if (!accepted) return json({ ok: false, error: "É necessário aceitar o regulamento." }, 400);

    const { data: ev } = await supabase
      .from("raffle_events").select("*").ilike("tag", tag).maybeSingle();
    if (!ev || !ev.is_active) return json({ ok: false, error: "Evento não encontrado." }, 404);
    eventId = ev.id; ownerId = ev.owner_id;

    const now = Date.now();
    if (ev.status !== "open") {
      await logAttempt("closed", ev.status);
      return json({ ok: false, error: "As inscrições não estão abertas no momento." }, 409);
    }
    if (ev.opens_at && now < new Date(ev.opens_at).getTime()) {
      return json({ ok: false, error: "As inscrições ainda não começaram." }, 409);
    }
    if (ev.closes_at && now > new Date(ev.closes_at).getTime()) {
      return json({ ok: false, error: "As inscrições já foram encerradas." }, 409);
    }

    // ---- Account must exist on this operator's Gorjeta base ----
    const { data: user } = await supabase
      .from("wheel_users")
      .select("id, name, email, account_id, blacklisted")
      .eq("owner_id", ev.owner_id)
      .ilike("email", email)
      .maybeSingle();

    if (!user || String(user.account_id).trim() !== accountId) {
      await logAttempt("no_account");
      return json({
        ok: false,
        needsAccount: true,
        signupUrl: ev.signup_url || "",
        error: "Não encontramos uma conta com esse e-mail e ID. Crie sua conta para participar.",
      }, 404);
    }

    // ---- Hard duplicate ----
    const { data: existing } = await supabase
      .from("raffle_participants")
      .select("public_code, status")
      .eq("event_id", ev.id)
      .or(`email.ilike.${email},account_id.ilike.${accountId}`)
      .maybeSingle();
    if (existing) {
      await logAttempt("duplicate");
      return json({
        ok: true, alreadyIn: true,
        publicCode: existing.public_code,
        status: existing.status === "blocked" ? "approved" : existing.status,
        message: "Você já está participando deste sorteio.",
      });
    }

    // ---- Capacity ----
    const { count: approvedCount } = await supabase
      .from("raffle_participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id).eq("status", "approved");
    if (ev.max_participants && (approvedCount || 0) >= ev.max_participants) {
      await logAttempt("full");
      return json({ ok: false, error: "As vagas para este sorteio já foram preenchidas." }, 409);
    }

    // ---- Security signals ----
    const flags: string[] = [];
    let hardBlock = false;
    let score = 0;

    const { data: restrictions } = await supabase
      .from("raffle_restrictions")
      .select("kind, value")
      .eq("owner_id", ev.owner_id)
      .or(`event_id.eq.${ev.id},event_id.is.null`);
    for (const r of restrictions || []) {
      const v = String(r.value || "").trim().toLowerCase();
      if (!v) continue;
      if (r.kind === "email" && v === email) { flags.push("restricted_email"); hardBlock = true; }
      if (r.kind === "account_id" && v === accountId.toLowerCase()) { flags.push("restricted_account"); hardBlock = true; }
      if (r.kind === "ip" && ip && v === ip.toLowerCase()) { flags.push("restricted_ip"); hardBlock = true; }
    }

    if (user.blacklisted) { flags.push("blacklisted_account"); hardBlock = true; }

    if (ip) {
      const { count: sameIp } = await supabase
        .from("raffle_participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ev.id).eq("ip_address", ip);
      if ((sameIp || 0) >= 3) { flags.push("ip_reused_heavy"); score += 2; }
      else if ((sameIp || 0) >= 1) { flags.push("ip_reused"); score += 1; }

      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count: recent } = await supabase
        .from("raffle_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip).gte("created_at", since);
      if ((recent || 0) >= 8) { flags.push("rate_burst"); score += 2; }
      else if ((recent || 0) >= 4) { flags.push("many_attempts"); score += 1; }
    }

    if (fingerprint) {
      const { count: sameFp } = await supabase
        .from("raffle_participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ev.id).eq("session_fingerprint", fingerprint);
      if ((sameFp || 0) >= 1) { flags.push("device_reused"); score += 2; }
    }

    if (!ua) { flags.push("no_user_agent"); score += 1; }
    if (displayName && displayName.length < 2) { flags.push("invalid_name"); score += 1; }

    const status = hardBlock ? "blocked" : score >= 2 ? "review" : "approved";

    const { device_type, os, browser } = parseUA(ua);
    const insertRow = {
      event_id: ev.id,
      owner_id: ev.owner_id,
      wheel_user_id: user.id,
      account_id: accountId,
      email,
      display_name: displayName || user.name || "",
      public_code: publicCode(),
      status,
      flags,
      ip_address: ip || null,
      user_agent: ua.slice(0, 400),
      device_type, os, browser,
      session_fingerprint: fingerprint || null,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("raffle_participants").insert(insertRow)
      .select("public_code, status").maybeSingle();
    if (insErr) {
      // Unique index race -> treat as already participating.
      if ((insErr as any).code === "23505") {
        await logAttempt("duplicate_race");
        return json({ ok: true, alreadyIn: true, message: "Você já está participando deste sorteio." });
      }
      throw insErr;
    }

    await logAttempt(status, flags.join(","));

    return json({
      ok: true,
      publicCode: inserted?.public_code,
      // Blocked entries look identical to approved for the participant.
      status: status === "blocked" ? "approved" : status,
      message: status === "review" ? NEUTRAL_REVIEW : "Inscrição confirmada! Boa sorte.",
    });
  } catch (err) {
    console.error("join-raffle error", err);
    await logAttempt("error", String(err).slice(0, 200));
    return json({ ok: false, error: "Não foi possível concluir a inscrição." }, 500);
  }
});
