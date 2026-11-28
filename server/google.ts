import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { google, type gmail_v1 } from 'googleapis'
import { config } from './config.ts'

// Single-user demo: one Google account, tokens kept in a local file.
const TOKEN_FILE = path.join(config.dataDir, 'google-tokens.json')

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
]

const oauth = new google.auth.OAuth2(
  config.googleClientId,
  config.googleClientSecret,
  `${config.publicUrl}/auth/google/callback`,
)

function saveTokens(tokens: object) {
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 })
}

try {
  oauth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')))
} catch {
  // Not signed in yet.
}

// Google only returns the refresh token on first consent; merge so a refresh doesn't drop it.
oauth.on('tokens', tokens => {
  const merged = { ...oauth.credentials, ...tokens }
  oauth.setCredentials(merged)
  saveTokens(merged)
})

export function googleConfigured() {
  return Boolean(config.googleClientId && config.googleClientSecret)
}

export function googleSignedIn() {
  return Boolean(oauth.credentials.refresh_token || oauth.credentials.access_token)
}

const pendingStates = new Set<string>()

export function googleAuthUrl() {
  const state = crypto.randomBytes(16).toString('hex')
  pendingStates.add(state)
  return oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state })
}

export async function googleHandleCallback(code: string, state: string) {
  if (!pendingStates.delete(state)) throw new Error('Unknown sign-in state; start again from /auth/google')
  const { tokens } = await oauth.getToken(code)
  oauth.setCredentials(tokens)
  saveTokens(tokens)
}

export interface Email {
  id: string
  threadId: string
  from: string
  fromName: string
  replyTo: string
  subject: string
  date: string
  messageId: string
  references: string
  body: string
}

function header(msg: gmail_v1.Schema$Message, name: string) {
  const h = msg.payload?.headers?.find(x => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

function decode(data?: string | null) {
  return data ? Buffer.from(data, 'base64url').toString('utf8') : ''
}

function findPart(part: gmail_v1.Schema$MessagePart | undefined, mime: string): string {
  if (!part) return ''
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data)
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime)
    if (found) return found
  }
  return ''
}

function stripHtml(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toEmail(msg: gmail_v1.Schema$Message): Email {
  const from = header(msg, 'From')
  const plain = findPart(msg.payload, 'text/plain')
  const body = plain || stripHtml(findPart(msg.payload, 'text/html')) || msg.snippet || ''
  return {
    id: msg.id ?? '',
    threadId: msg.threadId ?? '',
    from,
    fromName: from.replace(/<[^>]*>/, '').replace(/"/g, '').trim() || from,
    replyTo: header(msg, 'Reply-To') || from,
    subject: header(msg, 'Subject'),
    date: header(msg, 'Date'),
    messageId: header(msg, 'Message-ID'),
    references: header(msg, 'References'),
    body,
  }
}

export async function listImportantEmails(max = 5): Promise<Email[]> {
  const gmail = google.gmail({ version: 'v1', auth: oauth })
  const list = await gmail.users.messages.list({ userId: 'me', q: 'in:inbox is:important category:primary', maxResults: max })
  const ids = (list.data.messages ?? []).map(m => m.id!).filter(Boolean)
  return Promise.all(
    ids.map(async id => toEmail((await gmail.users.messages.get({ userId: 'me', id, format: 'full' })).data)),
  )
}

export async function getEmail(id: string): Promise<Email> {
  const gmail = google.gmail({ version: 'v1', auth: oauth })
  return toEmail((await gmail.users.messages.get({ userId: 'me', id, format: 'full' })).data)
}

function encodeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

export async function sendReply(email: Email, text: string) {
  const gmail = google.gmail({ version: 'v1', auth: oauth })
  const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`
  const threading = email.messageId
    ? [
        `In-Reply-To: ${email.messageId}`,
        `References: ${[email.references, email.messageId].filter(Boolean).join(' ')}`,
      ]
    : []
  const lines = [
    `To: ${email.replyTo}`,
    `Subject: ${encodeHeader(subject)}`,
    ...threading,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text, 'utf8').toString('base64'),
  ]
  const raw = Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url')
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId: email.threadId } })
}
