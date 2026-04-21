import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Block private/internal addresses to mitigate SSRF
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;
  // IPv4 literal checks
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast/reserved
  }
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h === "[::1]") return true;
  if (h.startsWith("fe80:") || h.startsWith("[fe80:")) return true;
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("[fc") || h.startsWith("[fd")) return true;
  return false;
}

function validateApiUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "URL inválida" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Protocolo inválido (use http/https)" };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, error: "Host bloqueado por política de segurança" };
  }
  return { ok: true, url: parsed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sessão inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, evolutionApiUrl, evolutionApiKey, evolutionInstance, body } = await req.json();

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(
        JSON.stringify({ ok: false, error: "Credenciais da Evolution API não configuradas." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validated = validateApiUrl(evolutionApiUrl);
    if (!validated.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: validated.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = `${validated.url.origin}${validated.url.pathname.replace(/\/+$/, "")}`;
    let url = "";
    let method = "GET";
    let fetchBody: string | undefined;

    switch (action) {
      case "create":
        url = `${apiUrl}/instance/create`;
        method = "POST";
        fetchBody = JSON.stringify({
          instanceName: evolutionInstance,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          ...body,
        });
        break;
      case "connect":
        url = `${apiUrl}/instance/connect/${encodeURIComponent(evolutionInstance)}`;
        break;
      case "status":
        url = `${apiUrl}/instance/connectionState/${encodeURIComponent(evolutionInstance)}`;
        break;
      case "logout":
        url = `${apiUrl}/instance/logout/${encodeURIComponent(evolutionInstance)}`;
        method = "DELETE";
        break;
      case "fetchGroups":
        url = `${apiUrl}/group/fetchAllGroups/${encodeURIComponent(evolutionInstance)}?getParticipants=false`;
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: "Ação inválida" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const headers: Record<string, string> = { "apikey": evolutionApiKey };
    if (method === "POST") headers["Content-Type"] = "application/json";

    // Add 15s timeout to avoid edge function hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(url, { method, headers, body: fetchBody, signal: controller.signal, redirect: "manual" });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const isTimeout = fetchError.name === "AbortError" ||
                        (fetchError.message && fetchError.message.includes("timed out"));
      return new Response(
        JSON.stringify({
          ok: false,
          error: isTimeout
            ? "Tempo limite excedido. Verifique se o servidor da Evolution API está acessível e se a porta está liberada no firewall."
            : `Erro de conexão: ${fetchError.message}. Verifique a URL e se o servidor está online.`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeoutId);

    let data;
    try { data = await response.json(); } catch { data = null; }

    return new Response(
      JSON.stringify({ ok: response.ok, status: response.status, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Evolution proxy error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
