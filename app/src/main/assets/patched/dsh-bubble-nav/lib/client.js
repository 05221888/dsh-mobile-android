// Web half of dsh-bubble-nav.
//
// Draggable accelerator ball listing all user questions (numbered + timed),
// plus a full-session outline panel with category filters. Data comes from the
// host web route /dsh-bubble-nav (full history, no "load more" needed).
//
// Robustness notes:
// - pluginCtx is captured in apply() and used by module-level helpers.
//   The previous version referenced a bare `ctx` from module scope, which is
//   undefined there and threw ReferenceError as soon as the debounced fetch
//   fired (React crashed).
// - inject declares every service this client plugin touches (slots, sessions,
//   timer) — the client runtime denies undeclared ctx access.
let pluginCtx = null;

window.__ModuleLoader__.load({
	id: "dsh-bubble-nav",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let React = require("react");

		const BALL_SIZE = 24;
		const HALF = BALL_SIZE / 2;

		// ---- 共享状态（加速球 与 全对话框 分离） ----
		let version = 0;
		const listeners = new Set();
		const store = {
			ballOpen: false,
			panelOpen: false,
			filter: 'all',
			sessionId: null,
			outline: null,
			questions: null,
			seqToKey: {},
			hasMore: false,
			ball: null,
			panelPos: null,
			panelSize: null,
			setBallOpen(v) { if (this.ballOpen !== v) { this.ballOpen = v; emit(); } },
			setPanelOpen(v) { if (this.panelOpen !== v) { this.panelOpen = v; emit(); } },
			setFilter(f) { if (this.filter !== f) { this.filter = f; emit(); } },
			setBall(ball) { if (this.ball !== ball) { this.ball = ball; emit(); } },
			setPanelPos(pos) { if (this.panelPos !== pos) { this.panelPos = pos; emit(); } },
			setPanelSize(size) { if (this.panelSize !== size) { this.panelSize = size; emit(); } },
			setData(outline, questions) {
				let changed = false;
				if (this.outline !== outline) { this.outline = outline; changed = true; }
				if (this.questions !== questions) { this.questions = questions; changed = true; }
				if (changed) emit();
			},
			setWindow(sessionId, seqToKey, hasMore) {
				let changed = false;
				if (this.sessionId !== sessionId) { this.sessionId = sessionId; changed = true; }
				if (this.seqToKey !== seqToKey) { this.seqToKey = seqToKey; changed = true; }
				if (this.hasMore !== hasMore) { this.hasMore = hasMore; changed = true; }
				if (changed) emit();
			},
			subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
		};
		function emit() { version++; listeners.forEach((fn) => fn()); }

		// ---- 数据拉取（防抖，走 Host web 路由） ----
		let sessionsSvc = null;
		let fetchTimer = null;
		let fetchSeq = 0;
		function fetchOutline(sessionId) {
			return fetch('/dsh-bubble-nav?sessionId=' + encodeURIComponent(sessionId))
				.then((r) => r.json())
				.then((data) => {
					if (data && Array.isArray(data.outline) && Array.isArray(data.questions)) {
						store.setData(data.outline, data.questions);
					}
				})
				.catch(() => {});
		}
		function scheduleFetch(sessionId) {
			const my = ++fetchSeq;
			if (fetchTimer) { fetchTimer(); fetchTimer = null; }
			const timer = pluginCtx && pluginCtx.timer;
			if (!timer || typeof timer.timeout !== 'function') {
				fetchOutline(sessionId);
				return;
			}
			fetchTimer = timer.timeout(() => {
				fetchTimer = null;
				if (my === fetchSeq) fetchOutline(sessionId);
			}, 350);
		}

		// ---- 定位：只滚动对话容器 ----
		function scrollToKey(key) {
			const port = document.querySelector('[data-conversation-scroll]');
			if (!port) return;
			let target = null;
			const rows = port.querySelectorAll('[data-chat-anchor-key]');
			for (let i = 0; i < rows.length; i++) {
				if (rows[i].getAttribute('data-chat-anchor-key') === key) { target = rows[i]; break; }
			}
			if (!target) return;
			const cRect = port.getBoundingClientRect();
			const tRect = target.getBoundingClientRect();
			port.scrollTo({ top: port.scrollTop + (tRect.top - cRect.top) - 12, behavior: 'smooth' });
		}

		function ensureLoaded(targetSeq) {
			return new Promise((resolve) => {
				const timer = pluginCtx && pluginCtx.timer;
				if (!timer || typeof timer.timeout !== 'function') {
					resolve(!!store.seqToKey[targetSeq]);
					return;
				}
				let tries = 0;
				const tick = () => {
					if (store.seqToKey[targetSeq]) return resolve(true);
					if (!store.hasMore) return resolve(false);
					if (tries++ >= 30) return resolve(!!store.seqToKey[targetSeq]);
					const binding = sessionsSvc && store.sessionId ? sessionsSvc.binding(store.sessionId) : undefined;
					if (!binding || !binding.session || typeof binding.session.loadOlder !== 'function') return resolve(false);
					binding.session.loadOlder().then(() => { timer.timeout(tick, 300); }).catch(() => resolve(false));
				};
				timer.timeout(tick, 0);
			});
		}

		function jumpTo(seq, closePanel) {
			if (typeof seq !== 'number' || seq < 0) return;
			ensureLoaded(seq).then((ok) => {
				if (!ok) return;
				const key = store.seqToKey[seq];
				if (key) {
					scrollToKey(key);
					if (closePanel) store.setBallOpen(false);
				}
			});
		}

		// ---- React hooks ----
		function useOutlineStore() {
			const [, force] = React.useState(0);
			React.useEffect(() => store.subscribe(() => force((v) => v + 1)), []);
			return store;
		}

		function fmtTime(ts) {
			if (typeof ts !== 'number') return '';
			const d = new Date(ts);
			const now = new Date();
			const pad = (n) => String(n).padStart(2, '0');
			const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
			if (d.toDateString() === now.toDateString()) return hm;
			return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
		}

		function categoryOf(kind) {
			if (kind === 'user' || kind === 'steering') return 'question';
			if (kind === 'assistant-step') return 'answer';
			if (kind === 'tool-call' || kind === 'command' || kind === 'command-input' || kind === 'workflow-run') return 'tool';
			return null;
		}

		function badgeOf(kind) {
			if (kind === 'user' || kind === 'steering') return { cls: 'user', text: '问' };
			if (kind === 'assistant-step') return { cls: 'assistant', text: '答' };
			if (kind === 'tool-call') return { cls: 'tool', text: '具' };
			if (kind === 'command' || kind === 'command-input') return { cls: 'other', text: '命' };
			if (kind === 'context-agg') return { cls: 'context', text: '注' };
			return { cls: 'other', text: '·' };
		}

		const LIST_ICON = React.createElement(
			'svg',
			{ width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' },
			React.createElement('line', { x1: '2.5', y1: '4', x2: '13.5', y2: '4' }),
			React.createElement('line', { x1: '2.5', y1: '8', x2: '13.5', y2: '8' }),
			React.createElement('line', { x1: '2.5', y1: '12', x2: '13.5', y2: '12' }),
			React.createElement('circle', { cx: '1.4', cy: '4', r: '1', fill: 'currentColor', stroke: 'none' }),
			React.createElement('circle', { cx: '1.4', cy: '8', r: '1', fill: 'currentColor', stroke: 'none' }),
			React.createElement('circle', { cx: '1.4', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' })
		);

		// ---- 组件：头部按钮（全对话框开关） ----
		function OutlineToggle(props) {
			const useSession = props.useSession;
			const sessionId = props.sessionId;
			const snapshot = useSession((s) => s);
			React.useEffect(() => {
				if (!snapshot || !sessionId) return;
				const seqToKey = {};
				for (const n of snapshot.chat.nodes.values()) {
					if (!n || !n.key) continue;
					const d = n.data && typeof n.data === 'object' ? n.data : {};
					if (typeof n.anchorSeq === 'number' && seqToKey[n.anchorSeq] === undefined) seqToKey[n.anchorSeq] = n.key;
					if (typeof d.seq === 'number' && seqToKey[d.seq] === undefined) seqToKey[d.seq] = n.key;
					if (d.finalNode && typeof d.finalNode.seq === 'number' && seqToKey[d.finalNode.seq] === undefined) seqToKey[d.finalNode.seq] = n.key;
				}
				store.setWindow(sessionId, seqToKey, !!snapshot.hasMore);
				scheduleFetch(sessionId);
			}, [snapshot, sessionId]);
			// 大纲面板已移除：此组件仅作为数据源（构建 seqToKey + 拉取问题列表），不渲染按钮
			return null;
		}

		// ---- 组件：加速球（默认完整显示；点击开/关；拖到右缘才吸附一半） ----
		function OutlineBall(props) {
			const st = useOutlineStore();
			const [dragPos, setDragPos] = React.useState(null);
			const dragRef = React.useRef(null);
			React.useEffect(() => {
				if (!store.ball) {
					store.setBall({ x: window.innerWidth - BALL_SIZE - 8, y: 88, docked: false });
				}
			}, []);
			const ball = st.ball || { x: window.innerWidth - BALL_SIZE - 8, y: 88, docked: false };
			const count = Array.isArray(st.questions) ? st.questions.length : 0;
			const label = count > 99 ? '99+' : String(count);

			if (st.panelOpen) return null;

			const pos = dragPos || ball;

			const onDown = (e) => {
				if (e.button !== 0) return;
				e.preventDefault();
				dragRef.current = null;
				store.setBall({ x: ball.x, y: ball.y, docked: ball.docked, dragging: true });
				const startX = e.clientX;
				const startY = e.clientY;
				const baseX = ball.x;
				const baseY = ball.y;
				const clampX = (v) => Math.max(4, Math.min(v, window.innerWidth - HALF));
				const clampY = (v) => Math.max(4, Math.min(v, window.innerHeight - BALL_SIZE - 4));
				const onMove = (ev) => {
					dragRef.current = {
						x: clampX(baseX + ev.clientX - startX),
						y: clampY(baseY + ev.clientY - startY),
					};
					setDragPos(dragRef.current);
				};
				const onUp = () => {
					document.removeEventListener('mousemove', onMove);
					document.removeEventListener('mouseup', onUp);
					document.removeEventListener('mouseleave', onUp);
					const end = dragRef.current;
					const moved = end !== null && (Math.abs(end.x - baseX) > 4 || Math.abs(end.y - baseY) > 4);
					if (!moved) {
						store.setBall({ x: ball.x, y: ball.y, docked: ball.docked, dragging: false });
						store.setBallOpen(!store.ballOpen);
					} else if (end) {
						if (end.x + BALL_SIZE > window.innerWidth - 40) {
							store.setBall({ x: window.innerWidth - HALF - 4, y: end.y, docked: true, dragging: false });
						} else {
							store.setBall({ x: end.x, y: end.y, docked: false, dragging: false });
						}
					} else {
						store.setBall({ x: ball.x, y: ball.y, docked: false, dragging: false });
					}
					dragRef.current = null;
					setDragPos(null);
				};
				document.addEventListener('mousemove', onMove);
				document.addEventListener('mouseup', onUp);
				document.addEventListener('mouseleave', onUp);
			};

			const cls = 'dlg-ball' +
				(ball.docked ? ' dlg-ball-docked' : '') +
				(dragPos ? ' dlg-ball-dragging' : '');
			return React.createElement(
				'div',
				{
					className: cls,
					style: { left: pos.x + 'px', top: pos.y + 'px' },
					title: count > 0 ? '我的问题 · ' + count + ' 条（点击展开，再点击收起；拖动移动）' : '我的问题（点击展开，再点击收起；拖动移动）',
					'aria-label': '我的问题',
					onMouseDown: onDown,
				},
				React.createElement('span', { className: 'dlg-ball-num' }, count > 0 ? label : '·')
			);
		}

		// ---- 组件：问题列表（跟随球，点击模式） ----
		function OutlineQuestions(props) {
			const useSessions = props.useSessions;
			const sessions = useSessions((s) => s);
			const st = useOutlineStore();
			if (!st.ballOpen || st.panelOpen) return null;
			if (st.ball && st.ball.dragging) return null;
			const matches = sessions.current === st.sessionId;
			const questions = matches ? st.questions : null;
			const ball = st.ball || { x: window.innerWidth - HALF - 4, y: 88 };
			const panelW = 320;
			let left = ball.x - panelW - 10;
			let top = ball.y - 18;
			if (left < 8) left = ball.x + BALL_SIZE + 10;
			left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
			top = Math.max(8, Math.min(top, window.innerHeight - 420));

			const rows = (questions || []).map((e, idx) =>
				React.createElement(
					'button',
					{
						key: String(e.seq),
						className: 'dlg-qrow',
						onClick: () => jumpTo(e.seq, true),
					},
					React.createElement('span', { className: 'dlg-qno' }, String(idx + 1)),
					React.createElement('span', { className: 'dlg-qtime' }, fmtTime(e.time)),
					React.createElement('span', { className: 'dlg-qtext' }, e.label)
				)
			);

			let body = null;
			if (questions === null) {
				body = React.createElement('div', { className: 'dlg-empty' }, '加载中…');
			} else if (questions.length === 0) {
				body = React.createElement('div', { className: 'dlg-empty' }, matches ? '暂无问题' : '当前无会话');
			} else {
				body = React.createElement('div', { className: 'dlg-qlist' }, rows);
			}

			return React.createElement(
				'div',
				{
					className: 'dlg-qpanel',
					style: { left: left + 'px', top: top + 'px', right: 'auto', transform: 'none' },
				},
				body
			);
		}

		// ---- 组件：右侧灰点导航（固定窗口，当前点居中） ----
		function DotRail(props) {
			var st = useOutlineStore();
			var activeState = React.useState(null);
			var setActiveKey = activeState[1];
			var active = activeState[0];
			var questions = (st.questions || []);
			var MAX_VISIBLE_DOTS = 12;
			var DOT_SLOT = 20;
			var activeIndex = -1;
			for (var q = 0; q < questions.length; q++) {
				if (st.seqToKey[questions[q].seq] === active) { activeIndex = q; break; }
			}
			if (activeIndex < 0 && questions.length > 0) activeIndex = questions.length - 1;
			var hasOverflow = questions.length > MAX_VISIBLE_DOTS;
			// Reserve two positions for the pale continuation dots when history overflows.
			var visibleCount = hasOverflow ? MAX_VISIBLE_DOTS - 2 : questions.length;
			var windowStart = 0;
			if (questions.length > visibleCount) {
				windowStart = Math.max(0, activeIndex - Math.floor(visibleCount / 2));
				windowStart = Math.min(windowStart, questions.length - visibleCount);
			}
			var windowItems = questions.slice(windowStart, windowStart + visibleCount);
			var previousStart = React.useRef(windowStart);
			var shiftState = React.useState(0);
			var setShift = shiftState[1];
			var shift = shiftState[0];
			React.useEffect(function () {
				var delta = previousStart.current - windowStart;
				previousStart.current = windowStart;
				if (!delta) return;
				setShift(delta * DOT_SLOT);
				var frame = window.requestAnimationFrame(function () { setShift(0); });
				return function () { window.cancelAnimationFrame(frame); };
			}, [windowStart]);

			React.useEffect(function () {
				function updateActive() {
					var port = document.querySelector('[data-conversation-scroll]');
					if (!port) { setActiveKey(null); return; }
					var best = null;
					for (var i = 0; i < questions.length; i++) {
						var seq = questions[i].seq;
						var key = st.seqToKey[seq];
						if (!key) continue;
						var el = port.querySelector('[data-chat-anchor-key="' + key + '"]');
						if (!el) continue;
						var pr = port.getBoundingClientRect();
						var r = el.getBoundingClientRect();
						if (r.top - pr.top >= -20) { best = key; break; }
					}
					if (best === null && questions.length > 0) {
						var lastSeq = questions[questions.length - 1].seq;
						best = st.seqToKey[lastSeq] || null;
					}
					setActiveKey(function (old) { return old === best ? old : best; });
				}
				var port = document.querySelector('[data-conversation-scroll]');
				if (!port) return;
				port.addEventListener('scroll', updateActive, { passive: true });
				updateActive();
				return function () { port.removeEventListener('scroll', updateActive); };
			}, [questions.length, st.seqToKey]);

			if (questions.length === 0) return null;
			var hasHiddenAbove = windowStart > 0;
			var hasHiddenBelow = windowStart + visibleCount < questions.length;
			var makeContinuation = function (key, up) {
				return React.createElement('span', {
					key: key, className: 'dsh-dot-continuation', 'aria-hidden': 'true',
					style: { opacity: up ? 0.28 : 0.22 },
				});
			};
			var dotButtons = windowItems.map(function (e, offset) {
				var idx = windowStart + offset;
				var isActive = active === st.seqToKey[e.seq];
				return React.createElement('button', {
					key: 'dr-' + e.seq,
					className: 'dsh-dot-button' + (isActive ? ' dsh-dot-active' : ''),
					onClick: function () { jumpTo(e.seq, true); },
					title: (idx + 1) + '. ' + (e.label || ''),
					'aria-label': '跳转到第' + (idx + 1) + '条消息',
				});
			});
			var railItems = [];
			if (hasHiddenAbove) railItems.push(makeContinuation('dr-more-above', true));
			railItems = railItems.concat(dotButtons);
			if (hasHiddenBelow) railItems.push(makeContinuation('dr-more-below', false));

			var arrowBtn = React.createElement('button', {
				key: 'dr-bottom',
				onClick: function () {
					var items = document.querySelectorAll('[data-chat-flow-key]');
					if (items.length > 0) items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
				},
				title: '回到最底部', className: 'dsh-dot-bottom',
			}, '\u2193');

			return React.createElement('div', { className: 'dsh-dot-rail' },
				React.createElement('div', { className: 'dsh-dot-viewport', style: { maxHeight: (MAX_VISIBLE_DOTS * DOT_SLOT) + 'px' } },
					React.createElement('div', {
						className: 'dsh-dot-track',
						style: { transform: 'translateY(' + shift + 'px)' },
					}, railItems)
				),
				arrowBtn
			);
		}

		// ---- 插件入口 ----
		function apply(ctx) {
			pluginCtx = ctx;
			try {
				const slots = ctx.get('slots');
				if (slots === undefined) return;

				// 注入样式（生命周期内清理）
				const styleEl = document.createElement('style');
				styleEl.setAttribute('data-plugin-css', 'dsh-bubble-nav');
				styleEl.textContent = CSS;
				document.head.appendChild(styleEl);
				ctx.effect(() => () => {
					if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
				});

				slots.inject('conversation.session.header.actions', () => slots.register(
					{ name: 'conversation.session.header.actions', id: 'dlg-outline-toggle', order: 30 },
					(props) => {
						sessionsSvc = ctx.get('sessions') || sessionsSvc;
						return React.createElement(OutlineToggle, Object.assign({}, props));
					}
				));
				slots.inject('shell.overlay', () => slots.register(
					{ name: 'shell.overlay', id: 'dlg-outline-ball', order: 480 },
					(props) => React.createElement(OutlineBall, Object.assign({}, props))
				));
				slots.inject('shell.overlay', () => slots.register(
					{ name: 'shell.overlay', id: 'dlg-outline-questions', order: 500 },
					(props) => React.createElement(OutlineQuestions, Object.assign({}, props))
				));
				slots.inject('shell.overlay', () => slots.register(
					{ name: 'shell.overlay', id: 'dlg-dot-rail', order: 450 },
					(props) => React.createElement(DotRail, Object.assign({}, props))
				));
			} catch (err) {
				try { ctx.logger.warn('dsh-bubble-nav: apply failed: ' + String((err && err.message) || err)); } catch { /* ignore */ }
			}
		}

		const CSS = [
			'.dlg-toggle{width:28px;height:28px;color:var(--dsw-alias-label-tertiary,#8f959e);cursor:pointer;background:transparent;border:none;border-radius:28px;justify-content:center;align-items:center;padding:6px;display:inline-flex;flex:none}',
			'.dlg-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-secondary,#646a73)}',
			'.dlg-toggle[data-active]{color:var(--dsw-static-deepseek-500,#4d6bfe)}',
			'.dlg-ball{position:fixed;z-index:1150;width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#8fb2ff,#4e7fff 55%,#3a63e0);border:1.5px solid rgba(255,255,255,.9);box-shadow:0 4px 12px rgba(78,127,255,.45),inset 0 1px 0 rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;color:#ffffff;font-weight:700;font-size:10px;transition:left .2s ease,top .2s ease,transform .15s ease,box-shadow .15s ease}',
			'.dlg-ball:hover{transform:scale(1.1);box-shadow:0 8px 24px rgba(78,127,255,.6)}',
			'.dlg-ball:active{cursor:grabbing;transform:scale(1.03)}',
			'.dlg-ball-dragging{transition:none}',
			'.dlg-ball-docked{box-shadow:0 4px 14px rgba(78,127,255,.4)}',
			'.dlg-ball-num{line-height:1;pointer-events:none}',
			'.dsh-dot-rail{position:fixed;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;z-index:1140;pointer-events:auto;align-items:center}',
			'.dsh-dot-viewport{width:20px;overflow:hidden;display:flex;justify-content:center}',
			'.dsh-dot-track{display:flex;flex-direction:column;align-items:center;gap:10px;transition:transform .24s ease;will-change:transform}',
			'.dsh-dot-button{width:10px;height:10px;flex:none;border:none;border-radius:50%;cursor:pointer;padding:0;background:rgba(150,150,150,.5);transition:background .2s,transform .2s,opacity .2s;outline:none}',
			'.dsh-dot-button:hover{background:rgba(100,110,125,.72);transform:scale(1.18)}',
			'.dsh-dot-button.dsh-dot-active{background:#4A90D9;transform:scale(1.3);box-shadow:0 0 0 2px rgba(74,144,217,.16)}',
			'.dsh-dot-continuation{width:7px;height:7px;flex:none;border-radius:50%;background:rgba(170,175,185,.62);box-shadow:0 0 0 2px rgba(190,195,205,.14)}',
			'.dsh-dot-bottom{width:16px;height:16px;border-radius:50%;border:1px solid rgba(150,150,150,.4);cursor:pointer;padding:0;background:transparent;color:rgba(150,150,150,.6);font-size:12px;line-height:16px;text-align:center;outline:none;display:flex;align-items:center;justify-content:center}',
			'.dsh-dot-bottom:hover{color:rgba(90,100,115,.9);border-color:rgba(120,130,145,.65)}',
			'.dlg-qpanel{position:fixed;z-index:1200;width:320px;max-width:calc(100vw - 48px);max-height:min(60vh,480px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#ffffff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,.16);overflow:hidden;font:400 13px/20px var(--ds-font-family,system-ui,sans-serif);color:var(--dsw-alias-label-primary,#1f2329)}',
			'.dlg-qlist{flex:1;min-height:0;overflow-y:auto;padding:6px}',
			'.dlg-qrow{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:none;background:transparent;border-radius:9px;padding:9px 11px;cursor:pointer;color:var(--dsw-alias-label-primary,#1f2329);font:inherit}',
			'.dlg-qrow:hover{background:color-mix(in srgb,var(--dsw-static-deepseek-500,#4d6bfe) 10%,transparent)}',
			'.dlg-qno{flex:none;min-width:18px;color:var(--dsw-static-deepseek-500,#4d6bfe);font-weight:600;font-size:12px;text-align:right;font-variant-numeric:tabular-nums}',
			'.dlg-qtime{flex:none;min-width:42px;color:var(--dsw-alias-label-tertiary,#8f959e);font-size:11px;font-variant-numeric:tabular-nums}',
			'.dlg-qtext{flex:1;min-width:0;word-break:break-word}',
			'.dlg-qrow:hover .dlg-qtext{color:var(--dsw-static-deepseek-500,#4d6bfe)}',
			'.dlg-empty{color:var(--dsw-alias-label-tertiary,#8f959e);padding:16px 8px;text-align:center;font-size:12px}',
			'.dlg-panel{position:fixed;top:64px;right:16px;z-index:1210;width:320px;min-width:260px;max-width:calc(100vw - 48px);max-height:calc(100vh - 96px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#ffffff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);overflow:hidden;font:400 13px/20px var(--ds-font-family,system-ui,sans-serif);color:var(--dsw-alias-label-primary,#1f2329)}',
			'.dlg-panel-head{display:flex;align-items:center;gap:8px;padding:10px 12px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));flex:none;cursor:move;user-select:none}',
			'.dlg-panel-title{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#1f2329);flex:1;min-width:0}',
			'.dlg-panel-close{width:24px;height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#646a73);cursor:pointer;border-radius:6px;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:none}',
			'.dlg-panel-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
			'.dlg-filter{display:flex;gap:4px;padding:8px 12px 2px;flex:none;flex-wrap:wrap}',
			'.dlg-chip{height:24px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));background:transparent;color:var(--dsw-alias-label-secondary,#646a73);cursor:pointer;border-radius:12px;font-size:12px;line-height:22px}',
			'.dlg-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
			'.dlg-chip[data-active]{border-color:var(--dsw-static-deepseek-500,#4d6bfe);color:var(--dsw-static-deepseek-500,#4d6bfe);background:color-mix(in srgb,var(--dsw-static-deepseek-500,#4d6bfe) 10%,transparent);font-weight:500}',
			'.dlg-list{flex:1;min-height:0;overflow-y:auto;padding:6px}',
			'.dlg-row{display:flex;gap:8px;align-items:flex-start;width:100%;text-align:left;border:none;background:transparent;border-radius:8px;padding:7px 8px;cursor:pointer;color:var(--dsw-alias-label-primary,#1f2329);font:inherit}',
			'.dlg-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
			'.dlg-row-disabled{cursor:default;color:var(--dsw-alias-label-tertiary,#8f959e);font-size:12px}',
			'.dlg-row-disabled:hover{background:transparent}',
			'.dlg-badge{flex:none;width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;margin-top:1px;color:#ffffff}',
			'.dlg-badge-user{background:#4e7fff}.dlg-badge-assistant{background:#20b26c}.dlg-badge-tool{background:#9b59b6}.dlg-badge-context{background:#e0882f}.dlg-badge-other{background:#8f959e}',
			'.dlg-label{min-width:0;flex:1;word-break:break-word;white-space:normal}',
			'.dlg-resize{position:absolute;right:2px;bottom:2px;width:14px;height:14px;cursor:nwse-resize;opacity:.55;background:linear-gradient(135deg,transparent 45%,var(--dsw-alias-label-tertiary,#8f959e) 45%,var(--dsw-alias-label-tertiary,#8f959e) 55%,transparent 55%),linear-gradient(135deg,transparent 60%,var(--dsw-alias-label-tertiary,#8f959e) 60%,var(--dsw-alias-label-tertiary,#8f959e) 68%,transparent 68%)}',
			'.dlg-resize:hover{opacity:1}'
		].join('');

		exports.inject = ['slots', 'sessions', 'timer'];
		exports.apply = apply;
		return module.exports;
	}
});
