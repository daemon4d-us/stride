import express, { type NextFunction, type Request, type Response } from 'express'
import { config } from './config.ts'
import { draftReply, summarizeEmail } from './claude.ts'
import {
  getEmail,
  googleAuthUrl,
  googleConfigured,
  googleHandleCallback,
  googleSignedIn,
  listImportantEmails,
  sendReply,
  type Email,
} from './google.ts'
import { mockDraft, mockEmails, mockSummaries, mockTranscript } from './mock.ts'
import { transcribe } from './stt.ts'

const app = express()
app.use(express.json())

// The glasses WebView loads the app from another origin (Vite in dev, a packed bundle on device).
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

// --- Google sign-in: opened in a normal browser, since it doesn't work inside the glasses WebView.

app.get('/auth/google', (_req, res) => {
  if (!googleConfigured()) {
    res.status(500).send('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart the server.')
    return
  }
  res.redirect(googleAuthUrl())
})

app.get('/auth/google/callback', async (req, res) => {
  if (req.query.error) {
    res.status(400).send(`Google sign-in was cancelled: ${String(req.query.error)}`)
    return
  }
  await googleHandleCallback(String(req.query.code ?? ''), String(req.query.state ?? ''))
  res.send('Signed in. You can close this tab and go back to the glasses.')
})

// --- API used by the glasses app.

app.get('/api/status', (_req, res) => {
  res.json({
    mock: config.mock,
    signedIn: config.mock || googleSignedIn(),
    signInUrl: `${config.publicUrl}/auth/google`,
    configured: {
      google: googleConfigured(),
      claude: config.hasAnthropicKey,
      stt: Boolean(config.deepgramApiKey),
    },
  })
})

// Summaries are cached per message so scrolling back and forth doesn't call Claude again.
const summaries = new Map<string, string>()

async function summaryFor(email: Email) {
  let summary = summaries.get(email.id)
  if (summary === undefined) {
    summary = config.mock ? (mockSummaries[email.id] ?? email.subject) : await summarizeEmail(email)
    summaries.set(email.id, summary)
  }
  return summary
}

app.get('/api/emails', async (_req, res) => {
  const emails = config.mock ? mockEmails : await listImportantEmails()
  res.json({
    emails: await Promise.all(
      emails.map(async email => ({
        id: email.id,
        from: email.fromName,
        subject: email.subject,
        summary: await summaryFor(email),
      })),
    ),
  })
})

async function emailById(id: string) {
  if (!config.mock) return getEmail(id)
  const email = mockEmails.find(e => e.id === id)
  if (!email) throw new Error(`No such email: ${id}`)
  return email
}

// Body: raw PCM (s16le, 16 kHz, mono) as application/octet-stream.
app.post('/api/stt', express.raw({ type: 'application/octet-stream', limit: '20mb' }), async (req, res) => {
  const pcm = req.body as Buffer
  if (!Buffer.isBuffer(pcm) || pcm.length === 0) {
    res.status(400).json({ error: 'No audio received' })
    return
  }
  res.json({ text: config.mock ? mockTranscript : await transcribe(pcm) })
})

app.post('/api/reply/draft', async (req, res) => {
  const { emailId, instruction } = req.body as { emailId?: string; instruction?: string }
  if (!emailId || !instruction) {
    res.status(400).json({ error: 'emailId and instruction are required' })
    return
  }
  const email = await emailById(emailId)
  res.json({ draft: config.mock ? mockDraft : await draftReply(email, instruction) })
})

app.post('/api/reply/send', async (req, res) => {
  const { emailId, text } = req.body as { emailId?: string; text?: string }
  if (!emailId || !text) {
    res.status(400).json({ error: 'emailId and text are required' })
    return
  }
  const email = await emailById(emailId)
  if (!config.mock) await sendReply(email, text)
  res.json({ sent: true })
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
})

app.listen(config.port, () => {
  console.log(`Stride server on ${config.publicUrl}${config.mock ? ' (MOCK mode)' : ''}`)
  if (!config.mock && !googleSignedIn()) console.log(`Sign in to Google: ${config.publicUrl}/auth/google`)
})
