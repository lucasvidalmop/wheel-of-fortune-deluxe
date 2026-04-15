import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SmsBodySchema = z.object({
  recipientPhone: z.string().trim().min(1),
  message: z.string().trim().min(1).max(1600),
  twilioAccountSid: z.string().trim().min(1),
  twilioAuthToken: z.string().trim().min(1),
  twilioPhoneNumber: z.string().trim().min(1),
});

const normalizeBrazilianMobile = (value: string) => {
  let digits = value.replace(/\D/g, "");

  while (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0800")) {
    return { ok: false as const, error: "Número 0800 não pode receber SMS" };
  }

  if (digits.length === 10) {
    digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  }

  if (digits.length !== 11) {
    return {
      ok: false as const,
      error: `Número inválido: formato inesperado (${digits.length} dígitos)`,
    };
  }

  const ddd = digits.slice(0, 2);
  const subscriber = digits.slice(2);

  if (!/^[1-9][0-9]$/.test(ddd)) {
    return { ok: false as const, error: "DDD inválido para SMS" };
  }

  if (!/^9\d{8}$/.test(subscriber)) {
    return { ok: false as const, error: "O número precisa ser um celular brasileiro válido" };
  }

  return {
    ok: true as const,
    national: digits,
    e164: `+55${digits}`,
  };
};

const normalizeE164 = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = SmsBodySchema.safeParse(await req.json());

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { recipientPhone, message, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = parsed.data;

    const normalizedRecipient = normalizeBrazilianMobile(recipientPhone);
    if (!normalizedRecipient.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          reason: "invalid_phone",
          error: normalizedRecipient.error,
          originalPhone: recipientPhone,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fromPhone = normalizeE164(twilioPhoneNumber);
    if (!fromPhone) {
      return new Response(
        JSON.stringify({ error: "Número remetente inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizedRecipient.e164,
        From: fromPhone,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);

      const providerMessage = String(data?.message || "Erro ao enviar SMS");
      const providerCode = Number(data?.code);
      const isInvalidRecipient = [21211, 21614].includes(providerCode) ||
        /invalid 'to' phone number|not a valid mobile number|cannot be a landline/i.test(providerMessage);

      if (isInvalidRecipient) {
        return new Response(
          JSON.stringify({
            success: false,
            skipped: true,
            reason: "invalid_phone",
            error: providerMessage,
            normalizedPhone: normalizedRecipient.e164,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: providerMessage }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, sid: data.sid, normalizedPhone: normalizedRecipient.e164 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("SMS error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});