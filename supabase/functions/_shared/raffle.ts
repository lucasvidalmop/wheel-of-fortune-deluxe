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
