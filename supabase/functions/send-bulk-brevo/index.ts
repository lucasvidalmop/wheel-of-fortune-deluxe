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

// Brevo aceita até 1000 destinatários via messageVersions, mas se UM email
// for inválido, o batch INTEIRO falha. Usamos 100 para isolar melhor falhas.
const CHUNK_SIZE = 100
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

// Validação estrita de email (mais rigorosa que a do Brevo)
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
function sanitizeEmail(raw: string): string | null {
  if (!raw) return null
  // remove zero-width, espaços, quebras de linha, aspas e vírgulas residuais
  const cleaned = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s"',;<>]/g, '')
    .trim()
    .toLowerCase()
  if (!cleaned) return null
  if (cleaned.length > 254) return null
  if (!EMAIL_RE.test(cleaned)) return null
  return cleaned
}

function sanitizeName(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\r\n\t]/g, ' ').trim()
  return cleaned || undefined
}

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
    const adminSupabase = createClient(supabaseUrl, serviceKey)
    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    const userId = userData?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as Payload
    const { senderEmail, senderName, subject, htmlContent, textContent, recipients, replyTo } = body

    if (!senderEmail || !subject || (!htmlContent && !textContent) || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields (need htmlContent or textContent)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Helper: detecta erros do Brevo que indicam email rejeitado por formato/inválido
    // (não erros transitórios). Esses devem entrar na suppression list.
    const isInvalidEmailError = (data: any, status: number): boolean => {
      if (status === 400) {
        const code = (data?.code || '').toString().toLowerCase()
        const msg = (data?.message || '').toString().toLowerCase()
        return (
          code.includes('invalid_parameter') ||
          msg.includes('email is not valid') ||
          msg.includes('invalid email') ||
          msg.includes('not valid in to') ||
          msg.includes('blacklisted')
        )
      }
      return false
    }

    // Helper: adiciona email à suppression list (idempotente)
    const suppressEmail = async (email: string, reason: string, meta: Record<string, unknown> = {}) => {
      try {
        await adminSupabase.from('suppressed_emails').insert({
          email,
          reason,
          metadata: { ...meta, source: 'send-bulk-brevo', owner_id: userId, suppressed_at: new Date().toISOString() },
        })
      } catch (e) {
        // ignora duplicatas (unique constraint) ou erros de insert
        console.log('[send-bulk-brevo] suppress skipped for', email, e instanceof Error ? e.message : e)
      }
    }

    // Dedupe + sanitização rigorosa
    const seen = new Set<string>()
    const cleanRecipients: Recipient[] = []
    const invalidRecipients: { email: string; error: string }[] = []
    for (const r of recipients) {
      const e = sanitizeEmail(r.email || '')
      if (!e) {
        const orig = (r.email || '(vazio)').toString().slice(0, 254)
        invalidRecipients.push({ email: orig, error: 'Email inválido (formato)' })
        // auto-suprime emails malformados detectados localmente
        if (orig && orig !== '(vazio)') {
          await suppressEmail(orig.toLowerCase(), 'invalid_format')
        }
        continue
      }
      if (seen.has(e)) continue
      seen.add(e)
      cleanRecipients.push({ email: e, name: sanitizeName(r.name) })
    }

    // Filtra emails já suprimidos antes de enviar
    let suppressedSkipped = 0
    if (cleanRecipients.length > 0) {
      const emailsToCheck = cleanRecipients.map((r) => r.email)
      const { data: suppressedRows } = await adminSupabase
        .from('suppressed_emails')
        .select('email')
        .in('email', emailsToCheck)
      const suppressedSet = new Set((suppressedRows || []).map((s: any) => (s.email || '').toLowerCase()))
      if (suppressedSet.size > 0) {
        const before = cleanRecipients.length
        for (let i = cleanRecipients.length - 1; i >= 0; i--) {
          if (suppressedSet.has(cleanRecipients[i].email)) {
            cleanRecipients.splice(i, 1)
          }
        }
        suppressedSkipped = before - cleanRecipients.length
      }
    }

    console.log('[send-bulk-brevo] Sanitization', {
      received: recipients.length,
      valid: cleanRecipients.length,
      invalid: invalidRecipients.length,
      suppressed_skipped: suppressedSkipped,
    })

    if (cleanRecipients.length === 0) {
      return new Response(JSON.stringify({
        error: 'No valid recipients (after sanitization & suppression)',
        invalid: invalidRecipients.length,
        suppressed_skipped: suppressedSkipped,
      }), {
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
        ...(htmlContent ? { htmlContent } : {}),
        ...(textContent ? { textContent } : {}),
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

        console.log('[send-bulk-brevo] Brevo response', {
          status: resp.status,
          ok: resp.ok,
          chunkSize: chunk.length,
          messageId: data?.messageId,
          messageIds: Array.isArray(data?.messageIds) ? data.messageIds.length : undefined,
          sender: senderEmail,
          error: !resp.ok ? data : undefined,
        })

        if (!resp.ok) {
          const errMsg = (data?.message || data?.code || `HTTP ${resp.status}`).toString().slice(0, 500)
          console.error('[send-bulk-brevo] Chunk failed, falling back to per-recipient send:', errMsg)

          // FALLBACK: tenta enviar 1 a 1 para isolar o(s) email(s) ruins.
          // Assim, mesmo se 1 endereço for inválido, os outros 99 do chunk são enviados.
          for (const r of chunk) {
            const singlePayload = {
              sender: { email: senderEmail, name: senderName || senderEmail },
              subject,
              ...(htmlContent ? { htmlContent } : {}),
              ...(textContent ? { textContent } : {}),
              to: [{ email: r.email, name: r.name || r.email }],
              ...(replyTo ? { replyTo: { email: replyTo } } : {}),
            }
            try {
              const singleResp = await fetch(BREVO_URL, {
                method: 'POST',
                headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
                body: JSON.stringify(singlePayload),
              })
              const singleData = await singleResp.json().catch(() => ({}))
              if (!singleResp.ok) {
                failed++
                const sErr = (singleData?.message || singleData?.code || `HTTP ${singleResp.status}`).toString().slice(0, 500)
                errors.push({ email: r.email, error: sErr })
                const invalid = isInvalidEmailError(singleData, singleResp.status)
                if (invalid) {
                  await suppressEmail(r.email, 'invalid_format', { brevo_response: singleData })
                }
                 await adminSupabase.from('email_send_log').insert({
                  template_name: 'brevo_bulk',
                  recipient_email: r.email,
                  status: invalid ? 'suppressed' : 'failed',
                  error_message: sErr,
                  metadata: { owner_id: userId, provider: 'brevo', brevo_response: singleData, fallback: true, auto_suppressed: invalid },
                })
              } else {
                sent++
                 await adminSupabase.from('email_send_log').insert({
                  template_name: 'brevo_bulk',
                  recipient_email: r.email,
                  status: 'sent',
                  metadata: { owner_id: userId, provider: 'brevo', messageId: singleData?.messageId, fallback: true },
                })
              }
            } catch (sErr) {
              failed++
              const m = sErr instanceof Error ? sErr.message : String(sErr)
              errors.push({ email: r.email, error: m })
               await adminSupabase.from('email_send_log').insert({
                template_name: 'brevo_bulk',
                recipient_email: r.email,
                status: 'failed',
                error_message: m.slice(0, 500),
                metadata: { owner_id: userId, provider: 'brevo', fallback: true },
              })
            }
            // pequena pausa entre envios individuais
            await new Promise((res) => setTimeout(res, 50))
          }
        } else {
          sent += chunk.length
          const rows = chunk.map((r) => ({
            template_name: 'brevo_bulk',
            recipient_email: r.email,
            status: 'sent',
            metadata: { owner_id: userId, provider: 'brevo', messageId: data?.messageId, messageIds: data?.messageIds },
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
      JSON.stringify({
        total: cleanRecipients.length,
        sent,
        failed,
        invalid: invalidRecipients.length,
        suppressed_skipped: suppressedSkipped,
        errors: errors.slice(0, 50),
      }),
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
