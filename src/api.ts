// All external calls go through the Stride server. In dev, Vite proxies /api to it;
// on real glasses set VITE_API_URL to the server's public address.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export interface Status {
  mock: boolean
  signedIn: boolean
  signInUrl: string
}

export interface EmailItem {
  id: string
  from: string
  subject: string
  summary: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`)
  return data as T
}

function postJson<T>(path: string, body: unknown) {
  return call<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const api = {
  status: () => call<Status>('/api/status'),
  emails: async () => (await call<{ emails: EmailItem[] }>('/api/emails')).emails,
  stt: async (pcm: Uint8Array) =>
    (
      await call<{ text: string }>('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: pcm as BufferSource,
      })
    ).text,
  draft: async (emailId: string, instruction: string) =>
    (await postJson<{ draft: string }>('/api/reply/draft', { emailId, instruction })).draft,
  send: (emailId: string, text: string) => postJson<{ sent: boolean }>('/api/reply/send', { emailId, text }),
}
