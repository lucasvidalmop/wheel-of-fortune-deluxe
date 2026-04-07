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
    const { action, evolutionApiUrl, evolutionApiKey, evolutionInstance, body } = await req.json();

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(
        JSON.stringify({ ok: false, error: "Credenciais da Evolution API não configuradas." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = evolutionApiUrl.replace(/\/+$/, "");
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
        url = `${apiUrl}/instance/connect/${evolutionInstance}`;
        break;
      case "status":
        url = `${apiUrl}/instance/connectionState/${evolutionInstance}`;
        break;
      case "logout":
        url = `${apiUrl}/instance/logout/${evolutionInstance}`;
        method = "DELETE";
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
      response = await fetch(url, { method, headers, body: fetchBody, signal: controller.signal });
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
