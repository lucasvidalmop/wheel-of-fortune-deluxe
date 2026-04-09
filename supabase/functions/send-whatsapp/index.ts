import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
        JSON.stringify({ error: "Credenciais da Evolution API não configuradas." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - if it's a group JID (@g.us), use as-is
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

    const apiUrl = evolutionApiUrl.replace(/\/+$/, "").replace(/\/manager$/i, "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let url: string;
    let body: Record<string, any>;

    if (media && media.url) {
      // Send media message (image, video, audio, document)
      url = `${apiUrl}/message/sendMedia/${evolutionInstance}`;
      body = {
        number: cleanPhone,
        mediatype: media.mediatype || "image", // image, video, audio, document
        mimetype: media.mimetype || "image/jpeg",
        caption: message || "",
        media: media.url,
        fileName: media.fileName || "file",
      };
      if (mentionsEveryOne && cleanPhone.includes("@g.us")) {
        body.mentionsEveryOne = true;
      }
    } else {
      // Send text message
      url = `${apiUrl}/message/sendText/${evolutionInstance}`;
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
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const isTimeout = fetchError.name === "AbortError";
      return new Response(
        JSON.stringify({ 
          error: isTimeout 
            ? "Tempo limite excedido ao enviar mensagem. Verifique a Evolution API."
            : `Erro de conexão: ${fetchError.message}`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeoutId);

    let data;
    try { data = await response.json(); } catch { data = null; }

    if (!response.ok) {
      console.error("Evolution API error:", data);
      return new Response(
        JSON.stringify({ error: data?.message || data?.error || "Erro ao enviar WhatsApp" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
