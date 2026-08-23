// Append-only JSONL mailbox helpers (pure, unit-testable).
// One inbox file per recipient: mailbox/inbox-<device>.jsonl

export function inboxPath(device) {
  const d = String(device || '').trim() || 'unknown';
  return `mailbox/inbox-${d.replace(/[^\w.-]/g, '_')}.jsonl`;
}

export function parseJsonl(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* skip junk */ }
  }
  return out;
}

export function serializeJsonl(messages) {
  return messages.map((m) => JSON.stringify(m)).join('\n') + (messages.length ? '\n' : '');
}

export function makeMessage({ from, to, kind, subject, body }) {
  const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    from: String(from || 'unknown'),
    to: String(to || 'unknown'),
    at: new Date().toISOString(),
    kind: kind || 'chat',
    subject: String(subject || '').slice(0, 200),
    body: String(body || '').slice(0, 12000),
    acked: false,
  };
}

export function appendMessage(existingText, msg) {
  const list = parseJsonl(existingText);
  list.push(msg);
  return serializeJsonl(list);
}

export function ackMessage(existingText, id) {
  const list = parseJsonl(existingText);
  let n = 0;
  for (const m of list) {
    if (m.id === id && !m.acked) { m.acked = true; n += 1; }
  }
  return { text: serializeJsonl(list), marked: n };
}

export function formatInbox(messages, { unreadOnly = true } = {}) {
  const rows = unreadOnly ? messages.filter((m) => !m.acked) : messages;
  if (rows.length === 0) return unreadOnly ? '(no unread messages)' : '(mailbox empty)';
  return rows.map((m) => {
    const flag = m.acked ? 'acked' : 'NEW';
    return `[${flag}] ${m.id}  ${m.at}  ${m.from}→${m.to}  (${m.kind}) ${m.subject}\n${m.body}`;
  }).join('\n---\n');
}
