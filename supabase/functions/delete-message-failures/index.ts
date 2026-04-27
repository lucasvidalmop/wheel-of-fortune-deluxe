import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Channel = 'all' | 'sms' | 'whatsapp' | 'email';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: claims, error: claimsErr } = await anon.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: 'Não autenticado' }, 401);

    const callerId = claims.claims.sub as string;

    const { date, channel } = await req.json() as { date?: string; channel?: Channel };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: 'Data inválida' }, 400);
    }

    const selectedChannel: Channel = channel && ['all', 'sms', 'whatsapp', 'email'].includes(channel)
      ? channel
      : 'all';

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    let deletedCount = 0;

    if (selectedChannel === 'all' || selectedChannel === 'sms') {
      for (const table of ['sms_message_log', 'sms_mb_message_log', 'sms_cs_message_log']) {
        const { data, error } = await admin
          .from(table)
          .delete()
          .eq('owner_id', callerId)
          .neq('status', 'sent')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .select('id');

        if (error) return json({ error: error.message }, 400);
        deletedCount += data?.length || 0;
      }
    }

    if (selectedChannel === 'all' || selectedChannel === 'whatsapp') {
      for (const table of ['whatsapp_message_log', 'whatsapp2_message_log']) {
        const { data, error } = await admin
          .from(table)
          .delete()
          .eq('owner_id', callerId)
          .neq('status', 'sent')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .select('id');

        if (error) return json({ error: error.message }, 400);
        deletedCount += data?.length || 0;
      }
    }

    if (selectedChannel === 'all' || selectedChannel === 'email') {
      const { data, error } = await admin
        .from('email_send_log')
        .delete()
        .eq('metadata->>owner_id', callerId)
        .neq('status', 'sent')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .select('id');

      if (error) return json({ error: error.message }, 400);
      deletedCount += data?.length || 0;
    }

    return json({ success: true, deleted_count: deletedCount });
  } catch (err: any) {
    return json({ error: err?.message || 'erro interno' }, 500);
  }
});