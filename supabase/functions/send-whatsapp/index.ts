import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recipientPhone, message, evolutionApiUrl, evolutionApiKey, evolutionInstance } = await req.json();

    if (!recipientPhone || !message) {
      return new Response(
        JSON.stringify({ error: "recipientPhone e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(
        JSON.stringify({ error: "Credenciais da Evolution API não configuradas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - ensure format for Brazil
    let cleanPhone = recipientPhone.replace(/\D/g, "");
    if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.slice(1);
    }
    if (!cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
    }

    // Call Evolution API with timeout
    const apiUrl = evolutionApiUrl.replace(/\/+$/, "");
    const url = `${apiUrl}/message/sendText/${evolutionInstance}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": evolutionApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
        }),
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
