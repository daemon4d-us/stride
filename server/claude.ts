import Anthropic from '@anthropic-ai/sdk'
import type { Email } from './google.ts'

// Reads ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) from the environment.
// Created on first use so the server still starts in MOCK mode without a key.
let client: Anthropic | undefined

const MODEL = 'claude-opus-5-5'

async function ask(system: string, user: string): Promise<string> {
  client ??= new Anthropic()
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Short, latency-sensitive outputs read while walking: keep reasoning light.
    output_config: { effort: 'low' },
    // If a safety classifier declines, the API retries on a fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: user }],
  })
  if (response.stop_reason === 'refusal') throw new Error('Claude declined this request')
  return response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim()
}

function emailBlock(email: Email) {
  return `<email>\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}\n</email>`
}

const SUMMARY_SYSTEM = `You write one-line email summaries for smart glasses. The wearer reads them at a glance while walking.

Reply with a single line of at most 48 characters, because the display fits about 50 before wrapping: what the sender wants or what happened, with the concrete detail that matters (a date, an amount, a decision needed). Don't repeat the sender's name or the subject, and don't add quotes, a label or a closing period. Write in the language of the email.`

export function summarizeEmail(email: Email) {
  return ask(SUMMARY_SYSTEM, emailBlock(email))
}

const REPLY_SYSTEM = `You draft email replies for someone dictating to smart glasses while walking. They see the draft on a small display and send it with a tap, so it has to be right without editing.

You get the email they are answering and a transcript of what they said. The transcript comes from speech recognition and may contain small errors; work out what they meant. Write the reply they intended: a greeting with the sender's first name, their point in one to three plain sentences, and a short sign-off without a name. Say only what they said; don't add commitments, dates or details they didn't mention. Write in the language of the original email unless they spoke in or asked for another.

Reply with the email body only: no subject line, no commentary.`

export function draftReply(email: Email, instruction: string) {
  return ask(REPLY_SYSTEM, `${emailBlock(email)}\n\n<spoken_reply>\n${instruction}\n</spoken_reply>`)
}
