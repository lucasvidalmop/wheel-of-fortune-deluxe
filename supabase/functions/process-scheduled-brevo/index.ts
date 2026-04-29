// Processa fila de emails Brevo agendados.
// Roda via pg_cron a cada minuto.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Recipient = { email: string; name?: string }

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const CHUNK_SIZE = 100
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function sanitizeEmail(raw: string): string | null {
  if (!raw) return null
  const cleaned = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s"',;<>]/g, '')
    .trim()
    .toLowerCase()
  if (!cleaned || cleaned.length > 254 || !EMAIL_RE.test(cleaned)) return null
  return cleaned
}

function computeNextRun(recurrence: string, base: string): string | null {
  const d = new Date(base)
  switch (recurrence) {
    case 'daily': d.setDate(d.getDate() + 1); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    default: return null
  }
  return d.toISOString()
}

async function resolveRecipients(
  supabase: any,
  job: any,
): Promise<Recipient[]> {
  const source = job.source as string
  const ownerId = job.owner_id as string

  if (source === 'csv') {
    return Array.isArray(job.csv_recipients) ? job.csv_recipients : []
  }

  const selected = new Set<string>(
    (Array.isArray(job.selected_emails) ? job.selected_emails : []).map((e: string) =>
      String(e).toLowerCase(),
    ),
  )

  if (source === 'wheel_users') {
    const { data } = await supabase
      .from('wheel_users')
      .select('email, name')
      .eq('owner_id', ownerId)
      .eq('archived', false)
      .limit(20000)
    const all = (data ?? [])
      .filter((r: any) => r.email)
      .map((r: any) => ({ email: r.email, name: r.name }))
    if (selected.size === 0) return all
    return all.filter((r: any) => selected.has(String(r.email).toLowerCase()))
  }

  if (source === 'contacts') {
    const { data } = await supabase
      .from('imported_contacts')
      .select('numero, lead')
      .eq('owner_id', ownerId)
      .limit(20000)
    const all = (data ?? [])
      .filter((r: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.numero || ''))
      .map((r: any) => ({ email: r.numero, name: r.lead }))
    if (selected.size === 0) return all
    return all.filter((r: any) => selected.has(String(r.email).toLowerCase()))
  }

  return []
}

async function sendBrevoBulk(opts: {
  apiKey: string
  job: any
  recipients: Recipient[]
  supabase: any
}) {
  const { apiKey, job, recipients, supabase } = opts
  const seen = new Set<string>()
  const clean: Recipient[] = []
  for (const r of recipients) {
    const e = sanitizeEmail(r.email || '')
    if (!e || seen.has(e)) continue
    seen.add(e)
    clean.push({ email: e, name: r.name })
  }

  // suppression filter
  let suppressedSkipped = 0
  if (clean.length > 0) {
    const { data: rows } = await supabase
      .from('suppressed_emails')
      .select('email')
      .in('email', clean.map((r) => r.email))
    const sup = new Set((rows || []).map((s: any) => (s.email || '').toLowerCase()))
    if (sup.size > 0) {
      const before = clean.length
      for (let i = clean.length - 1; i >= 0; i--) {
        if (sup.has(clean[i].email)) clean.splice(i, 1)
      }
      suppressedSkipped = before - clean.length
    }
  }

  let sent = 0
  let failed = 0

  for (let i = 0; i < clean.length; i += CHUNK_SIZE) {
    const chunk = clean.slice(i, i + CHUNK_SIZE)
    const messageVersions = chunk.map((r) => ({
      to: [{ email: r.email, name: r.name || r.email }],
    }))
    const payload: any = {
      sender: { email: job.sender_email, name: job.sender_name || job.sender_email },
      subject: job.subject,
      messageVersions,
    }
    if (job.html_content) payload.htmlContent = job.html_content
    if (job.text_content) payload.textContent = job.text_content
    if (job.reply_to) payload.replyTo = { email: job.reply_to }

    try {
      const resp = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        // fallback per recipient
        for (const r of chunk) {
          const single: any = {
            sender: payload.sender,
            subject: payload.subject,
            to: [{ email: r.email, name: r.name || r.email }],
          }
          if (job.html_content) single.htmlContent = job.html_content
          if (job.text_content) single.textContent = job.text_content
          if (job.reply_to) single.replyTo = { email: job.reply_to }
          try {
            const sr = await fetch(BREVO_URL, {
              method: 'POST',
              headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
              body: JSON.stringify(single),
            })
            const sd = await sr.json().catch(() => ({}))
            if (!sr.ok) {
              failed++
              await supabase.from('email_send_log').insert({
                template_name: 'brevo_scheduled',
                recipient_email: r.email,
                status: 'failed',
                error_message: (sd?.message || sd?.code || `HTTP ${sr.status}`).toString().slice(0, 500),
                metadata: { owner_id: job.owner_id, provider: 'brevo', scheduled_id: job.id },
              })
            } else {
              sent++
              await supabase.from('email_send_log').insert({
                template_name: 'brevo_scheduled',
                recipient_email: r.email,
                status: 'sent',
                metadata: { owner_id: job.owner_id, provider: 'brevo', messageId: sd?.messageId, scheduled_id: job.id },
              })
            }
          } catch (e) {
            failed++
            await supabase.from('email_send_log').insert({
              template_name: 'brevo_scheduled',
              recipient_email: r.email,
              status: 'failed',
              error_message: (e instanceof Error ? e.message : String(e)).slice(0, 500),
              metadata: { owner_id: job.owner_id, provider: 'brevo', scheduled_id: job.id },
            })
          }
          await new Promise((res) => setTimeout(res, 50))
        }
      } else {
        sent += chunk.length
        const rows = chunk.map((r) => ({
          template_name: 'brevo_scheduled',
          recipient_email: r.email,
          status: 'sent',
          metadata: { owner_id: job.owner_id, provider: 'brevo', messageId: data?.messageId, scheduled_id: job.id },
        }))
        await supabase.from('email_send_log').insert(rows)
      }
    } catch (err) {
      failed += chunk.length
      const m = err instanceof Error ? err.message : String(err)
      for (const r of chunk) {
        await supabase.from('email_send_log').insert({
          template_name: 'brevo_scheduled',
          recipient_email: r.email,
          status: 'failed',
          error_message: m.slice(0, 500),
          metadata: { owner_id: job.owner_id, provider: 'brevo', scheduled_id: job.id },
        })
      }
    }
    if (i + CHUNK_SIZE < clean.length) await new Promise((r) => setTimeout(r, 300))
  }

  return { total: clean.length, sent, failed, suppressed_skipped: suppressedSkipped }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'BREVO_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()
    const { data: jobs, error } = await supabase
      .from('scheduled_brevo_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('next_run_at', now)
      .order('next_run_at', { ascending: true })
      .limit(20)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: any[] = []
    for (const job of jobs) {
      try {
        // mark processing
        await supabase.from('scheduled_brevo_emails')
          .update({ status: 'processing', updated_at: now })
          .eq('id', job.id)

        const recipients = await resolveRecipients(supabase, job)
        const result = await sendBrevoBulk({ apiKey, job, recipients, supabase })

        const next = computeNextRun(job.recurrence, job.scheduled_at)
        if (next && job.recurrence !== 'none') {
          await supabase.from('scheduled_brevo_emails').update({
            status: 'pending',
            scheduled_at: next,
            next_run_at: next,
            last_sent_at: now,
            last_result: result,
          }).eq('id', job.id)
        } else {
          await supabase.from('scheduled_brevo_emails').update({
            status: 'sent',
            last_sent_at: now,
            last_result: result,
          }).eq('id', job.id)
        }

        results.push({ id: job.id, ok: true, ...result })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await supabase.from('scheduled_brevo_emails').update({
          status: 'failed',
          last_result: { error: msg.slice(0, 500) },
        }).eq('id', job.id)
        results.push({ id: job.id, ok: false, error: msg })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
