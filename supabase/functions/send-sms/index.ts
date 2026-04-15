import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { recipientPhone, message, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = await req.json();

    if (!recipientPhone || !message) {
      return new Response(
        JSON.stringify({ error: "recipientPhone e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({ error: "Credenciais do Twilio não configuradas. Acesse as configurações de SMS." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - ensure E.164 format for Brazil
    let cleanPhone = recipientPhone.replace(/\D/g, "");
    // Remove leading country code if already present
    if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
      cleanPhone = cleanPhone.slice(2);
    }
    // Remove leading zero
    if (cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.slice(1);
    }
    // Brazilian mobile: DDD (2 digits) + 9 + 8 digits = 11 digits
    // If we have 10 digits (DDD + 8 digits), insert the "9" after DDD
    if (cleanPhone.length === 10) {
      cleanPhone = cleanPhone.slice(0, 2) + "9" + cleanPhone.slice(2);
    }
    // Skip numbers that are clearly invalid (too short/long or landline prefixes like 0800)
    if (cleanPhone.length !== 11) {
      return new Response(
        JSON.stringify({ error: `Número inválido: formato inesperado (${cleanPhone.length} dígitos)` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    cleanPhone = "+55" + cleanPhone;

    // Call Twilio API directly
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: cleanPhone,
        From: twilioPhoneNumber,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Erro ao enviar SMS" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sid: data.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMS error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
