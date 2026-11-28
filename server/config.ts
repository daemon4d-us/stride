import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// Load .env from the repo root if it exists (Node 22 built-in).
try {
  process.loadEnvFile(path.join(here, '..', '.env'))
} catch {
  // No .env file: rely on the real environment.
}

const port = Number(process.env.PORT ?? 8787)

export const config = {
  port,
  // Public base URL of this server; must match the redirect URI registered in Google Cloud.
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
  // MOCK=1 serves canned emails, transcripts and drafts so the glasses UI runs without any keys.
  mock: process.env.MOCK === '1',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY ?? '',
  hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  dataDir: path.join(here, '.data'),
}
