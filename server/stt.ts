import { config } from './config.ts'

// The glasses mic delivers signed 16-bit little-endian PCM, 16 kHz, mono.
// Deepgram accepts raw PCM directly when the encoding is given in the query string.
export async function transcribe(pcm: Buffer): Promise<string> {
  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'multi',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    smart_format: 'true',
  })
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.deepgramApiKey}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(pcm),
  })
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] }
  }
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
}
