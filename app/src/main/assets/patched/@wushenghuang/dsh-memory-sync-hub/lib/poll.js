// Peer-mailbox poll loop: GET inbox on a timer. Empty / unchanged SHA
// never calls the model. Task mail wakes (or creates) one dedicated session.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  inboxPath,
  parseJsonl,
  formatInbox,
  unreadMessages,
  pickDispatchable,
  formatDispatchPrompt,
  decidePoll,
  nextBackoff,
  rememberDispatched,
} from './mailbox.js?cachebust=2';

export function pollStatePath(dshHome) {
  return path.join(dshHome, 'dsh-memory-sync', 'poll-state.json');
}

export function pendingMailPath(dshHome) {
  return path.join(dshHome, 'dsh-memory-sync', 'pending-mail.json');
}

export function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function userMessage(text) {
  return {
    role: 'user',
    id: randomUUID(),
    content: [{ type: 'text', text: String(text) }],
    source: { kind: 'user' },
  };
}

export async function dispatchToAgent(ctx, { sessionId, prompt }) {
  const agents = typeof ctx.get === 'function' ? ctx.get('agents') : null;
  if (!agents || typeof agents.create !== 'function') {
    return { ok: false, mode: 'pending-file', message: 'agents 服务不可用（本进程不能自动叫醒会话）' };
  }

  const msg = userMessage(prompt);
  let agent;
  if (sessionId && typeof agents.get === 'function') {
    try { agent = agents.get(sessionId); } catch { agent = undefined; }
  }
  if (!agent && sessionId && typeof agents.resume === 'function') {
    try {
      const handle = await agents.resume({ resumeSessionId: sessionId });
      agent = handle?.agent;
    } catch {
      agent = undefined;
    }
  }
  if (agent && typeof agent.followup === 'function') {
    agent.followup(msg);
    return { ok: true, mode: 'wake', sessionId };
  }

  const newId = `session-${randomUUID()}`;
  try {
    let setup;
    const presets = typeof ctx.get === 'function' ? ctx.get('agentPresets') : null;
    if (presets && typeof presets.resolve === 'function' && typeof presets.mount === 'function') {
      try {
        const resolved = await presets.resolve(undefined);
        const presetId = String(resolved?.id ?? '').trim();
        if (presetId) setup = async (agentCtx) => { await presets.mount(agentCtx, presetId); };
      } catch { /* 无预设就裸建，工具可能不全但仍能回信 */ }
    }
    const create = typeof agents.withoutInitiator === 'function'
      ? (opts) => agents.withoutInitiator(() => agents.create(opts))
      : (opts) => agents.create(opts);
    const handle = await create({
      sessionId: newId,
      meta: { cwd: process.cwd() },
      ...(setup ? { setup } : {}),
    });
    if (handle?.agent?.whenIdle) {
      try { await handle.agent.whenIdle(); } catch { /* 继续投递 */ }
    }
    handle.agent.followup(msg);
    return { ok: true, mode: 'spawn', sessionId: newId };
  } catch (e) {
    return { ok: false, mode: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

export async function runPollTick({ ctx, cfg, gitee, dshHome, now = Date.now(), force = false }) {
  const stateFile = pollStatePath(dshHome);
  const pendingFile = pendingMailPath(dshHome);
  const state = readJsonFile(stateFile, {
    lastSha: '',
    lastPollAt: 0,
    consecutiveFails: 0,
    nextAt: 0,
    sessionId: '',
    dispatched: [],
    lastAction: '',
    lastReason: '',
  });
  const intervalMs = Number(cfg.poll?.intervalMs) > 5000 ? Number(cfg.poll.intervalMs) : 180000;

  if (state.inFlight) {
    return { action: 'skip', reason: 'in-flight', state };
  }

  const rel = inboxPath(cfg.device);
  let existing;
  try {
    existing = await gitee.getContent(rel);
  } catch (e) {
    state.consecutiveFails = (state.consecutiveFails || 0) + 1;
    state.nextAt = now + nextBackoff(state.consecutiveFails, { minMs: intervalMs });
    state.lastAction = 'error';
    state.lastReason = e instanceof Error ? e.message : String(e);
    state.lastPollAt = now;
    writeJsonFile(stateFile, state);
    return { action: 'error', reason: state.lastReason, state };
  }

  const sha = existing?.sha || '';
  const text = existing ? existing.buffer.toString('utf8') : '';
  const messages = parseJsonl(text);
  const unread = unreadMessages(messages);
  const dispatchable = pickDispatchable(messages, {
    dispatched: state.dispatched,
    now,
  });
  const decision = force
    ? (dispatchable.length
      ? { action: 'dispatch', reason: 'force', count: dispatchable.length }
      : unread.length
        ? { action: 'idle', reason: 'no-task-mail' }
        : { action: 'idle', reason: 'empty' })
    : decidePoll({
      sha,
      lastSha: state.lastSha,
      unread,
      dispatchable,
      now,
      nextAt: state.nextAt,
      inFlight: false,
    });

  state.lastSha = sha;
  state.lastPollAt = now;
  state.lastAction = decision.action;
  state.lastReason = decision.reason;
  state.unread = unread.length;
  state.dispatchable = dispatchable.length;

  if (decision.action === 'skip' || decision.action === 'idle') {
    state.consecutiveFails = 0;
    state.nextAt = now + intervalMs;
    writeJsonFile(stateFile, state);
    if (decision.reason === 'empty' || decision.reason === 'no-task-mail') {
      try { fs.unlinkSync(pendingFile); } catch { /* none */ }
    }
    return { action: decision.action, reason: decision.reason, unread: unread.length, state };
  }

  const prompt = formatDispatchPrompt({ device: cfg.device, messages: dispatchable });
  state.inFlight = true;
  writeJsonFile(stateFile, state);

  const sent = await dispatchToAgent(ctx, { sessionId: state.sessionId, prompt });
  state.inFlight = false;
  if (sent.ok) {
    state.consecutiveFails = 0;
    state.nextAt = now + intervalMs;
    state.sessionId = sent.sessionId || state.sessionId;
    state.dispatched = rememberDispatched(state.dispatched, dispatchable.map((m) => m.id), now);
    state.lastDispatchAt = now;
    state.lastDispatchMode = sent.mode;
    try { fs.unlinkSync(pendingFile); } catch { /* none */ }
    writeJsonFile(stateFile, state);
    return {
      action: 'dispatch',
      reason: decision.reason,
      mode: sent.mode,
      sessionId: state.sessionId,
      count: dispatchable.length,
      preview: formatInbox(dispatchable, { unreadOnly: false }),
      state,
    };
  }

  writeJsonFile(pendingFile, {
    at: new Date(now).toISOString(),
    device: cfg.device,
    count: dispatchable.length,
    prompt,
    error: sent.message,
  });
  state.consecutiveFails = (state.consecutiveFails || 0) + 1;
  state.nextAt = now + nextBackoff(state.consecutiveFails, { minMs: intervalMs });
  state.lastReason = sent.message;
  writeJsonFile(stateFile, state);
  return {
    action: 'pending-file',
    reason: sent.message,
    count: dispatchable.length,
    pendingFile,
    state,
  };
}

export function startPeerPoll(ctx, { readConfig, createGitee, dshHome }) {
  const home = dshHome();
  let hint = '';
  const pollCfg = () => {
    try {
      const cfg = readConfig();
      return cfg;
    } catch {
      return null;
    }
  };

  const tick = async ({ force = false } = {}) => {
    const cfg = pollCfg();
    if (!cfg) return { action: 'skip', reason: 'no-config' };
    if (cfg.poll?.enabled === false && !force) return { action: 'skip', reason: 'disabled' };
    const { createGitee: make } = { createGitee };
    const gitee = make(cfg.gitee);
    const result = await runPollTick({ ctx, cfg, gitee, dshHome: home, force });
    if (result.action === 'pending-file') {
      hint = `【跨设备信箱】有 ${result.count} 封任务信未能自动叫醒会话（${result.reason}）。请对本会话说「看看信箱」或调用 peer_poll_now / peer_inbox。`;
    } else if (result.action === 'dispatch') {
      hint = `【跨设备信箱】已把 ${result.count} 封任务信投到会话 ${result.sessionId}（${result.mode}）。`;
    } else {
      hint = '';
    }
    return result;
  };

  const intervalMs = (() => {
    const cfg = pollCfg();
    const n = Number(cfg?.poll?.intervalMs);
    return n > 5000 ? n : 180000;
  })();

  try {
    let startTimer;
    try {
      startTimer = typeof ctx.setInterval === 'function'
        ? (fn, ms) => ctx.setInterval(fn, ms)
        : null;
    } catch {
      startTimer = null;
    }
    if (!startTimer) {
      startTimer = (fn, ms) => {
        const id = setInterval(fn, ms);
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => () => clearInterval(id), 'peer-mailbox-poll-timer');
        }
        return id;
      };
    }
    startTimer(() => { void tick(); }, intervalMs);
    setTimeout(() => { void tick(); }, 8000);
  } catch (e) {
    console.warn('[dsh-memory-sync] poll timer failed, tools still work:', e instanceof Error ? e.message : e);
  }

  try {
    const sp = typeof ctx.get === 'function' ? ctx.get('systemPrompt') : ctx.systemPrompt;
    if (sp && typeof sp.context === 'function' && typeof ctx.effect === 'function') {
      ctx.effect(() => sp.context({
        name: 'peer-mailbox-poll',
        order: 86,
        text: () => hint,
      }), 'peer-mailbox-poll-hint');
    }
  } catch { /* 快照提示是锦上添花，缺服务不阻断信箱工具 */ }

  return { tick, intervalMs };
}

