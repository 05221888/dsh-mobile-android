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

export const DEFAULT_DISPATCH_KINDS = ['ask', 'lesson', 'task'];
export const DISPATCH_COOLDOWN_MS = 30 * 60 * 1000;

export function unreadMessages(messages) {
  return (messages || []).filter((m) => m && m.acked !== true && m.id);
}

export function isTaskSubject(subject) {
  return /\[task\]|【任务】/i.test(String(subject || ''));
}

export function shouldDispatchKind(kind, subject, kinds = DEFAULT_DISPATCH_KINDS) {
  const k = String(kind || 'chat').toLowerCase();
  if ((kinds || []).includes(k)) return true;
  if (k === 'chat' && isTaskSubject(subject)) return true;
  return false;
}

export function pickDispatchable(messages, { kinds = DEFAULT_DISPATCH_KINDS, dispatched = [], now = Date.now(), cooldownMs = DISPATCH_COOLDOWN_MS } = {}) {
  const blocked = new Set(
    (dispatched || [])
      .filter((d) => d && d.id && (now - Number(d.at || 0)) < cooldownMs)
      .map((d) => d.id),
  );
  return unreadMessages(messages).filter((m) => {
    if (blocked.has(m.id)) return false;
    return shouldDispatchKind(m.kind, m.subject, kinds);
  });
}

export function formatDispatchPrompt({ device, messages }) {
  const rows = (messages || []).map((m) =>
    `[${m.id}] ${m.at || ''} from=${m.from} kind=${m.kind} subject=${m.subject || ''}\n${m.body || ''}`,
  ).join('\n---\n');
  return [
    `【跨设备信箱自动投递】本机 device=${device}。以下是对端发来、尚未处理的任务信。`,
    '请：1) 按信内容执行（能做就做）；2) 用 peer_send 把结果回给对端（kind=chat，subject 写原信 id）；3) 做完立刻 peer_ack 每封信的 id。',
    '不要再开一轮闲聊。不要把纯问候信当任务。',
    '',
    rows,
  ].join('\n');
}

export function nextBackoff(fails, { minMs = 180000, maxMs = 15 * 60 * 1000 } = {}) {
  const n = Math.max(0, Number(fails) || 0);
  return Math.min(maxMs, minMs * (2 ** Math.min(n, 4)));
}

export function decidePoll({ sha, lastSha, unread, dispatchable, now, nextAt = 0, inFlight = false } = {}) {
  if (inFlight) return { action: 'skip', reason: 'in-flight' };
  if (Number(now) < Number(nextAt || 0)) return { action: 'skip', reason: 'backoff' };
  if (sha && lastSha && sha === lastSha && !(dispatchable || []).length) {
    return { action: 'skip', reason: 'unchanged-sha' };
  }
  if (!(unread || []).length) return { action: 'idle', reason: 'empty' };
  if (!(dispatchable || []).length) return { action: 'idle', reason: 'no-task-mail' };
  return { action: 'dispatch', reason: 'new-task-mail', count: dispatchable.length };
}

export function rememberDispatched(dispatched, ids, now = Date.now(), keep = 200) {
  const next = [...(dispatched || []), ...(ids || []).map((id) => ({ id, at: now }))];
  return next.slice(-keep);
}
