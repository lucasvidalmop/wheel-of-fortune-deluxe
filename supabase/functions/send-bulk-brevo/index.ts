// Brevo bulk email sender
// Sends transactional emails in batches via Brevo API (https://api.brevo.com/v3/smtp/email).
// Brevo allows up to 1000 recipients per send when using `messageVersions` or `to` array.
// We chunk by 100 per request to stay safe and personalize per recipient.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Recipient {
  email: string
  name?: string
}

interface Payload {
  senderEmail: string
  senderName: string
  subject: string
  htmlContent?: string
  textContent?: string
  recipients: Recipient[]
  replyTo?: string
}

// Brevo permite até 1000 destinatários por chamada via messageVersions.
// Usamos 1000 para máxima eficiência em disparos em massa (>500).
const CHUNK_SIZE = 1000
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'BREVO_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    const userId = userData?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as Payload
    const { senderEmail, senderName, subject, htmlContent, recipients, replyTo } = body

    if (!senderEmail || !subject || !htmlContent || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Dedupe + basic email validation
    const seen = new Set<string>()
    const cleanRecipients: Recipient[] = []
    for (const r of recipients) {
      const e = (r.email || '').trim().toLowerCase()
      if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) continue
      if (seen.has(e)) continue
      seen.add(e)
      cleanRecipients.push({ email: e, name: r.name?.trim() || undefined })
    }

    if (cleanRecipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid recipients' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    let failed = 0
    const errors: { email: string; error: string }[] = []

    // Chunk the list
    for (let i = 0; i < cleanRecipients.length; i += CHUNK_SIZE) {
      const chunk = cleanRecipients.slice(i, i + CHUNK_SIZE)

      // Brevo: use `messageVersions` so each recipient receives an individual email
      // (not a multi-To). Each version targets one recipient.
      const messageVersions = chunk.map((r) => ({
        to: [{ email: r.email, name: r.name || r.email }],
      }))

      const payload = {
        sender: { email: senderEmail, name: senderName || senderEmail },
        subject,
        htmlContent,
        messageVersions,
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      }

      try {
        const resp = await fetch(BREVO_URL, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await resp.json().catch(() => ({}))

        if (!resp.ok) {
          // Whole chunk failed
          failed += chunk.length
          const errMsg = (data?.message || data?.code || `HTTP ${resp.status}`).toString().slice(0, 500)
          for (const r of chunk) {
            errors.push({ email: r.email, error: errMsg })
            await supabase.from('email_send_log').insert({
              template_name: 'brevo_bulk',
              recipient_email: r.email,
              status: 'failed',
              error_message: errMsg,
              metadata: { owner_id: userId, provider: 'brevo' },
            })
          }
        } else {
          sent += chunk.length
          // Log success per recipient
          const rows = chunk.map((r) => ({
            template_name: 'brevo_bulk',
            recipient_email: r.email,
            status: 'sent',
            metadata: { owner_id: userId, provider: 'brevo', messageId: data?.messageId },
          }))
          await supabase.from('email_send_log').insert(rows)
        }
      } catch (err) {
        failed += chunk.length
        const errMsg = err instanceof Error ? err.message : String(err)
        for (const r of chunk) {
          errors.push({ email: r.email, error: errMsg })
          await supabase.from('email_send_log').insert({
            template_name: 'brevo_bulk',
            recipient_email: r.email,
            status: 'failed',
            error_message: errMsg.slice(0, 500),
            metadata: { owner_id: userId, provider: 'brevo' },
          })
        }
      }

      // small pause between chunks
      if (i + CHUNK_SIZE < cleanRecipients.length) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    return new Response(
      JSON.stringify({ total: cleanRecipients.length, sent, failed, errors: errors.slice(0, 50) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('send-bulk-brevo error', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
