import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
  }
  if (h === "::1" || h === "[::1]") return true;
  if (h.startsWith("fe80:") || h.startsWith("[fe80:")) return true;
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("[fc") || h.startsWith("[fd")) return true;
  return false;
}

function validateApiUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return { ok: false, error: "URL inválida" }; }
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipientPhone, message, evolutionApiUrl, evolutionApiKey, evolutionInstance, media, mentionsEveryOne } = await req.json();

    if (!recipientPhone) {
      return new Response(
        JSON.stringify({ error: "recipientPhone é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!media && !message) {
      return new Response(
        JSON.stringify({ error: "message ou media são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(
        JSON.stringify({ error: "Credenciais da Evolution API (instância 2) não configuradas." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validated = validateApiUrl(evolutionApiUrl);
    if (!validated.ok) {
      return new Response(
        JSON.stringify({ error: validated.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cleanPhone = recipientPhone;
    if (!recipientPhone.includes('@g.us')) {
      cleanPhone = recipientPhone.replace(/\D/g, "");
      if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) {
        cleanPhone = cleanPhone.slice(1);
      }
      if (!cleanPhone.startsWith("55")) {
        cleanPhone = "55" + cleanPhone;
      }
    }

    const normalizedPath = validated.url.pathname.replace(/\/+$/, "").replace(/\/manager$/i, "");
    const apiUrl = `${validated.url.origin}${normalizedPath}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let url: string;
    let body: Record<string, any>;

    if (media && media.url && media.ptt) {
      url = `${apiUrl}/message/sendWhatsAppAudio/${encodeURIComponent(evolutionInstance)}`;
      body = {
        number: cleanPhone,
        audio: media.url,
        encoding: true,
      };
      if (mentionsEveryOne && cleanPhone.includes("@g.us")) {
        body.mentionsEveryOne = true;
      }
    } else if (media && media.url) {
      url = `${apiUrl}/message/sendMedia/${encodeURIComponent(evolutionInstance)}`;
      body = {
        number: cleanPhone,
        mediatype: media.mediatype || "image",
        mimetype: media.mimetype || "image/jpeg",
        caption: message || "",
        media: media.url,
        fileName: media.fileName || "file",
      };
      if (mentionsEveryOne && cleanPhone.includes("@g.us")) {
        body.mentionsEveryOne = true;
      }
    } else {
      url = `${apiUrl}/message/sendText/${encodeURIComponent(evolutionInstance)}`;
      body = {
        number: cleanPhone,
        text: message,
      };
      if (mentionsEveryOne && cleanPhone.includes("@g.us")) {
        body.mentionsEveryOne = true;
      }
    }

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": evolutionApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: "manual",
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const isTimeout = fetchError.name === "AbortError";
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? "Tempo limite excedido ao enviar mensagem. Verifique a Evolution API (instância 2)."
            : `Erro de conexão: ${fetchError.message}`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeoutId);

    let data;
    try { data = await response.json(); } catch { data = null; }

    if (!response.ok) {
      console.error("Evolution API (instance 2) error:", data);
      return new Response(
        JSON.stringify({ error: data?.message || data?.error || "Erro ao enviar WhatsApp (instância 2)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp 2 error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
