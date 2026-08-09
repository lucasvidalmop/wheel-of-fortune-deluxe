import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json } from "../_shared/raffle.ts";

// Roda a cada minuto (cron). Processa NO MAXIMO 1 pagamento automatico por
// execucao, garantindo pelo menos 1 minuto de intervalo entre cada auto pay
// disparado por sorteios de evento ao vivo. Usa update condicional
// (status='pending' -> 'processing') para travar a linha antes de disparar
// o PIX, evitando que duas execucoes concorrentes paguem o mesmo premio.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const now = new Date().toISOString();
  const { data: due, error } = await admin
    .from("auto_payout_queue")
    .select("id, payment_id")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("process-auto-payout-queue: erro ao buscar fila", error);
    return json({ error: error.message }, 500);
  }
  if (!due || due.length === 0) return json({ processed: 0 });

  const row = due[0];

  // Trava atomica: so segue se conseguirmos marcar como "processing" a
  // partir de "pending". Se outra execucao ja pegou essa linha, aborta.
  const { data: locked } = await admin
    .from("auto_payout_queue")
    .update({ status: "processing" })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!locked) return json({ processed: 0, skipped: "already locked" });

  try {
    await admin.functions.invoke("edpay-pix-transfer", {
      body: { paymentId: row.payment_id, autoPayment: true },
    });
    await admin.from("auto_payout_queue")
      .update({ status: "sent", processed_at: new Date().toISOString() })
      .eq("id", row.id);
    return json({ processed: 1, paymentId: row.payment_id });
  } catch (err) {
    console.error(`process-auto-payout-queue: falha ao pagar ${row.payment_id}`, err);
    await admin.from("auto_payout_queue")
      .update({
        status: "failed",
        processed_at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "erro desconhecido",
      })
      .eq("id", row.id);
    return json({ processed: 0, error: "falha ao disparar pix" }, 500);
  }
});
