import type { Email } from './google.ts'

// Canned data for MOCK=1, so the glasses UI can be built and recorded without any keys.
function email(id: string, fromName: string, address: string, subject: string, body: string): Email {
  return {
    id,
    threadId: id,
    from: `${fromName} <${address}>`,
    fromName,
    replyTo: address,
    subject,
    date: new Date().toUTCString(),
    messageId: `<${id}@example.com>`,
    references: '',
    body,
  }
}

export const mockEmails: Email[] = [
  email('m1', 'Anna Keller', 'anna@example.com', 'Contract draft', 'Can you confirm the contract draft by Friday?'),
  email('m2', 'Marco Rossi', 'marco@example.com', 'Lunch tomorrow', 'Are we still on for lunch at 1pm tomorrow?'),
  email('m3', 'Flight Desk', 'no-reply@example.com', 'Your flight', 'Your flight to Berlin now departs at 18:40.'),
]

export const mockSummaries: Record<string, string> = {
  m1: 'Needs your OK on the contract draft by Friday',
  m2: 'Asks if lunch tomorrow at 1pm still works',
  m3: 'Berlin flight moved to 18:40',
}

export const mockTranscript = "Tell her I'll confirm by Thursday evening"

export const mockDraft = "Hi Anna,\n\nI'll confirm the draft by Thursday evening.\n\nBest regards"
