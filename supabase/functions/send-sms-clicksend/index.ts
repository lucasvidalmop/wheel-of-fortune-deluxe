import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SmsBodySchema = z.object({
  recipientPhone: z.string().trim().min(1),
  message: z.string().trim().min(1).max(1600),
  clicksendUsername: z.string().trim().min(1),
  clicksendApiKey: z.string().trim().min(1),
  clicksendSenderId: z.string().trim().min(1),
});

const normalizeBrazilianMobile = (value: string) => {
  let digits = value.replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith("0800")) {
    return { ok: false as const, error: "Número 0800 não pode receber SMS" };
  }
  if (digits.length === 10) digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  if (digits.length !== 11) {
    return { ok: false as const, error: `Número inválido: formato inesperado (${digits.length} dígitos)` };
  }
  const ddd = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  if (!/^[1-9][0-9]$/.test(ddd)) return { ok: false as const, error: "DDD inválido para SMS" };
  if (!/^9\d{8}$/.test(subscriber)) {
    return { ok: false as const, error: "O número precisa ser um celular brasileiro válido" };
  }
  return { ok: true as const, e164: `+55${digits}` };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = SmsBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipientPhone, message, clicksendUsername, clicksendApiKey, clicksendSenderId } = parsed.data;

    const normalized = normalizeBrazilianMobile(recipientPhone);
    if (!normalized.ok) {
      return new Response(JSON.stringify({
        success: false, skipped: true, reason: "invalid_phone",
        error: normalized.error, originalPhone: recipientPhone,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const auth = btoa(`${clicksendUsername}:${clicksendApiKey}`);
    const response = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{
          source: "lovable",
          from: clicksendSenderId,
          body: message,
          to: normalized.e164,
        }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ClickSend error:", data);
      return new Response(JSON.stringify({
        error: data?.response_msg || data?.message || "Erro ao enviar SMS",
      }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ClickSend returns per-message status under data.data.messages[]
    const msg = data?.data?.messages?.[0];
    const msgStatus = msg?.status as string | undefined;
    if (msgStatus && msgStatus !== "SUCCESS" && msgStatus !== "QUEUED") {
      const reason = msg?.error_text || msgStatus;
      const isInvalid = /invalid|landline|destination/i.test(reason);
      if (isInvalid) {
        return new Response(JSON.stringify({
          success: false, skipped: true, reason: "invalid_phone",
          error: reason, normalizedPhone: normalized.e164,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: reason }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true, sid: msg?.message_id, normalizedPhone: normalized.e164,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("ClickSend SMS error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro interno",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
