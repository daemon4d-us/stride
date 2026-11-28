import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { api, type EmailItem } from './api'

const bridge = await waitForEvenAppBridge()

// One full-canvas text container; every screen is a text update to it.
// Layout is a placeholder until the Figma mockups arrive.
await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: 288,
        borderWidth: 0,
        borderColor: 5,
        paddingLength: 8,
        containerID: 1,
        containerName: 'main',
        content: 'Stride\nLoading…',
        isEventCapture: 1,
      }),
    ],
  }),
)

let shown = ''
function show(content: string) {
  if (content === shown) return
  shown = content
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'main', content }))
}

// --- State

type Screen =
  | { name: 'signin'; url: string }
  | { name: 'list' }
  | { name: 'detail' }
  | { name: 'recording' }
  | { name: 'busy'; label: string }
  | { name: 'draft'; text: string; heard: string }
  | { name: 'notice'; text: string; next: Screen }

let screen: Screen = { name: 'busy', label: 'Loading…' }
let emails: EmailItem[] = []
let index = 0
let audio: Uint8Array[] = []

function render() {
  const email = emails[index]
  switch (screen.name) {
    case 'signin':
      show(`Sign in to Google on your phone or laptop:\n${screen.url}\n\nTap when done`)
      break
    case 'list':
      // Walking view: who and the one line, nothing else.
      show(
        email
          ? `${index + 1}/${emails.length}  ${email.from}\n\n${email.summary}`
          : 'No important emails\n\nTap to refresh',
      )
      break
    case 'detail':
      show(`${email.from}\n${email.subject}\n\n${email.summary}\n\nTap: reply by voice · Double tap: back`)
      break
    case 'recording':
      show(`Reply to ${email.from}\n\nListening…\n\nTap when done · Double tap: cancel`)
      break
    case 'busy':
      show(screen.label)
      break
    case 'draft':
      show(`To ${email.from}:\n\n${screen.text}\n\nTap: send · Double tap: cancel`)
      break
    case 'notice':
      show(`${screen.text}\n\nTap to continue`)
      break
  }
}

function go(next: Screen) {
  screen = next
  render()
}

function fail(err: unknown, next: Screen) {
  console.error(err)
  go({ name: 'notice', text: err instanceof Error ? err.message : String(err), next })
}

async function load() {
  go({ name: 'busy', label: 'Stride\nLoading…' })
  try {
    const status = await api.status()
    if (!status.signedIn) {
      go({ name: 'signin', url: status.signInUrl })
      return
    }
    emails = await api.emails()
    index = 0
    go({ name: 'list' })
  } catch (err) {
    fail(err, { name: 'list' })
  }
}

async function finishRecording() {
  await bridge.audioControl(false)
  const email = emails[index]
  const pcm = new Uint8Array(audio.reduce((n, chunk) => n + chunk.length, 0))
  let offset = 0
  for (const chunk of audio) {
    pcm.set(chunk, offset)
    offset += chunk.length
  }
  audio = []
  try {
    go({ name: 'busy', label: 'Transcribing…' })
    const heard = await api.stt(pcm)
    if (!heard) {
      go({ name: 'notice', text: "Didn't catch that", next: { name: 'detail' } })
      return
    }
    go({ name: 'busy', label: `"${heard}"\n\nWriting reply…` })
    const text = await api.draft(email.id, heard)
    go({ name: 'draft', text, heard })
  } catch (err) {
    fail(err, { name: 'detail' })
  }
}

async function sendDraft(text: string) {
  go({ name: 'busy', label: 'Sending…' })
  try {
    await api.send(emails[index].id, text)
    go({ name: 'notice', text: 'Sent', next: { name: 'list' } })
  } catch (err) {
    fail(err, { name: 'draft', text, heard: '' })
  }
}

// --- Input

function onTap() {
  switch (screen.name) {
    case 'signin':
      load()
      break
    case 'list':
      if (emails.length) go({ name: 'detail' })
      else load()
      break
    case 'detail':
      audio = []
      bridge.audioControl(true)
      go({ name: 'recording' })
      break
    case 'recording':
      finishRecording()
      break
    case 'draft':
      sendDraft(screen.text)
      break
    case 'notice':
      go(screen.next)
      break
  }
}

// Double tap steps back one level; from the top level it exits the app.
function onDoubleTap() {
  switch (screen.name) {
    case 'detail':
      go({ name: 'list' })
      break
    case 'recording':
      bridge.audioControl(false)
      audio = []
      go({ name: 'detail' })
      break
    case 'draft':
      go({ name: 'notice', text: 'Cancelled', next: { name: 'detail' } })
      break
    case 'notice':
      go(screen.next)
      break
    default:
      bridge.shutDownPageContainer(1)
  }
}

function onScroll(step: 1 | -1) {
  if (screen.name !== 'list' || emails.length === 0) return
  index = Math.min(emails.length - 1, Math.max(0, index + step))
  render()
}

// CLICK_EVENT is 0 and protobuf omits zero values, so a tap arrives with eventType undefined.
// Resolve the default only inside an envelope that exists, or audio frames would read as taps.
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const pcm = event.audioEvent?.audioPcm
  if (pcm) {
    if (screen.name === 'recording') audio.push(pcm)
    return
  }

  const type = eventTypeOf(event.sysEvent) ?? eventTypeOf(event.textEvent)
  switch (type) {
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      onDoubleTap()
      break
    case OsEventTypeList.CLICK_EVENT:
      onTap()
      break
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      onScroll(1)
      break
    case OsEventTypeList.SCROLL_TOP_EVENT:
      onScroll(-1)
      break
    case OsEventTypeList.SYSTEM_EXIT_EVENT:
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:
      bridge.audioControl(false)
      unsubscribe()
      break
  }
})

load()
