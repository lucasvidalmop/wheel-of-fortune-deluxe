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
    const { action, evolutionApiUrl, evolutionApiKey, evolutionInstance, body } = await req.json();

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(
        JSON.stringify({ error: "Credenciais da Evolution API não configuradas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const headers: Record<string, string> = { "apikey": evolutionApiKey };
    if (method === "POST") headers["Content-Type"] = "application/json";

    const response = await fetch(url, { method, headers, body: fetchBody });
    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Evolution proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
