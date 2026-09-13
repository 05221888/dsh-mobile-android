# dsh-memory-sync

跨设备 DSH 记忆互通插件：让**电脑端 DSH Web** 与 **手机端 dsh-mobile APK** 通过一个 Gitee 私有仓库互相同步记忆与插件清单。

```
电脑 ~/.dsh/memories ──push──►  Gitee 私有仓库(dsh-memory-hub)  ◄──pull── 手机 ~/.dsh/memories
        ◄──────────────────── 双向条目级合并，互不覆盖 ────────────────────►
```

## 为什么是 Gitee API 而不是 git

- 国内直连快，不依赖代理；
- 纯 HTTP contents API —— **两端都不需要 git 二进制**（手机 APK 引擎里没有 git）；
- 纯 Node 内置模块实现，零 npm 依赖，ARM 引擎直接可跑。

## 安装（两端同款）

```powershell
# 电脑端（本机）：写入 web profile 并热加载
#   dev_install_package C:\Users\五五\Desktop\项目\dsh-memory-sync
# 手机端：把插件包放进 APK assets 插件列表（v0.13+ 默认内置）
```

## 配置（每端一份，token 绝不入库）

`~/.dsh/dsh-memory-sync/config.json`：

```json
{
  "gitee": {
    "owner": "<gitee用户名>",
    "repo": "dsh-memory-hub",
    "branch": "master",
    "token": "<Gitee 私人令牌，勾选 projects 权限>"
  },
  "device": "desktop-pc"
}
```

手机端 `device` 填 `phone`（或任意不同名），其余完全一致。同一 token 可两端共用。

## 工具面（AI 在对话中直接调用）

| 工具 | 作用 |
|---|---|
| `memory_sync_status` | 对比本地与枢纽：仅本地/仅远端/两边都有的���异文件 |
| `memory_sync_pull` | 拉取枢纽：远端独有文件下载、双方都有且不同的条目式 md 做 **union 合并**（先备份到 `~/.dsh/memories-sync-backup/<时间戳>/`） |
| `memory_sync_push` | 先吸收枢纽侧新增条目，再上传全部本地记忆 + **已装插件清单** `manifest/plugins-<device>.json` |

| `peer_send` | 给对端写信。`kind=ask/lesson/task`（或 chat 且标题带 `[task]`）会被对端轮询自动叫醒；纯问候不会 |
| `peer_inbox` / `peer_ack` | 读信 / 标记已处理 |
| `peer_poll_now` | 立刻拉一次信箱。空箱不启动模型 |
| `peer_poll_status` | 看轮询守护状态 |

典型用法——在手机上说：「同步一下电脑的记忆」→ AI 执行 `memory_sync_pull`；
想知道电脑装了什么插件 → pull 后读 `manifest/plugins-desktop-pc.json`。

## 自动对话（方案 A，v0.2.0）

插件启动后每 3 分钟 GET 一次本机 inbox（`~/.dsh/dsh-memory-sync/config.json` 可写 `poll.intervalMs` / `poll.enabled`）。

- 空箱、SHA 没变、只有问候 chat：**不调用模型、不新建会话**
- 有 `ask` / `lesson` / `task`（或标题带 `[task]` 的 chat）：叫醒**同一个**专用会话去办事，办完应 `peer_send` 回信并 `peer_ack`
- 自动叫醒失败时写 `~/.dsh/dsh-memory-sync/pending-mail.json`，当前对话快照会提示「看看信箱」

## 同步范围与排除

- 同步：`MEMORY.md` / `USER.md` / `USER-archive.md` / `TODOS-work.md` / `memory-metadata.json` / `daily/**` / `projects/**`（KEY/TODOS/MEMORY 等）以及未来的新文件
- 排除（本机状态，不上传）：`notifications/`（大附件）、`advisor/`、`pending-skills/`、`dsh-memory-evolve/update-state.json`、`plugin-state.json`、`SUGGESTIONS.jsonl`

## 合并策略

- 条目式 markdown（含 ≥2 个 `[YYYY-MM-DD]` 标记块）：**整块 union 合并**——本地内容永不被改写，远端新条目追加到底部；同一条目两边文本不一致时两条都保留（由 AI/人后续收敛）。
- 其余文件（json 等）：拉取时以枢纽为准覆盖（先备份）。
- push 前自动做一次反向 union 合并，保证「先合并再上传」，任何一端的新条目都不会被冲掉。

## 已知边界

- 单文件 >900KB 跳过（contents API 上限保护）；记忆文件通常 <100KB。
- Gitee 未认证流量走 HTTPS API，个人令牌限速足够日常同步。
