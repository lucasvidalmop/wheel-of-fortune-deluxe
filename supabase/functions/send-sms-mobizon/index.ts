import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SmsBodySchema = z.object({
  recipientPhone: z.string().trim().min(1),
  message: z.string().trim().min(1).max(1600),
  sender: z.string().trim().max(30).optional().default("MobizonBR"),
});

const normalizeBrazilianMobile = (value: string) => {
  let digits = value.replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith("0800")) return { ok: false as const, error: "Número 0800 não pode receber SMS" };
  if (digits.length === 10) digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  if (digits.length !== 11) return { ok: false as const, error: `Número inválido: formato inesperado (${digits.length} dígitos)` };

  const ddd = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  if (!/^[1-9][0-9]$/.test(ddd)) return { ok: false as const, error: "DDD inválido para SMS" };
  if (!/^9\d{8}$/.test(subscriber)) return { ok: false as const, error: "O número precisa ser um celular brasileiro válido" };

  return { ok: true as const, e164: `55${digits}` };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("MOBIZON_BR_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "MOBIZON_BR_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = SmsBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipientPhone, message, sender } = parsed.data;
    const normalized = normalizeBrazilianMobile(recipientPhone);
    if (!normalized.ok) {
      return new Response(JSON.stringify({
        success: false,
        skipped: true,
        reason: "invalid_phone",
        error: normalized.error,
        originalPhone: recipientPhone,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL("https://api.mobizon.com.br/service/message/sendSMSMessage");
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("recipient", normalized.e164);
    url.searchParams.set("text", message);
    if (sender) url.searchParams.set("sender", sender);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = await response.json().catch(() => null);
    const providerCode = Number(data?.code ?? -1);
    const providerMessage = String(data?.message || data?.data?.message || "Erro ao enviar SMS");

    if (!response.ok || providerCode !== 0) {
      console.error("Mobizon error:", data);
      const isInvalid = /invalid|phone|recipient|number|abonent|destinat/i.test(providerMessage);
      if (isInvalid) {
        return new Response(JSON.stringify({
          success: false,
          skipped: true,
          reason: "invalid_phone",
          error: providerMessage,
          normalizedPhone: normalized.e164,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: providerMessage, provider_code: providerCode }), {
        status: response.ok ? 400 : response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: data?.data?.messageId || data?.data?.campaignId || null,
      normalizedPhone: normalized.e164,
      provider: "mobizon_br",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mobizon SMS error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});