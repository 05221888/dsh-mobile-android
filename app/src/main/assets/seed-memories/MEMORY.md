[2026-08-15] 环境约定（2026-08-15）：用户建立"直接执行模式"——AI 按自己的推荐方案直接做完任务交付结果，全程不问用户同意；结果不符用户会自己改。这是所有会话/任务默认工作方式。
§
[2026-08-16] # Hermes 记忆系统源码分析精华（2026-08-12）

## 架构概览
Hermes 记忆系统采用**插件化架构**，`plugins/memory/` 下有 8 个记忆提供者：
- **holographic**（本地 SQLite + FTS5 + HRR 向量代数）← 核心设计
- mem0（云端/自托管 Mem0 平台）
- honcho（Honcho AI-native 记忆）
- retaindb（本地数据库）
- byterover、supermemory、openviking、hindsight

每个提供者实现统一的 `MemoryProvider` ABC 接口。

## Holographic 记忆系统核心设计（最值得学习）

### 1. 数据库架构
- SQLite + FTS5 全文索引（虚拟表）
- `facts` 表：content, category, tags, trust_score, retrieval_count, helpful_count, hrr_vector（向量）
- `entities` 表：实体名 + 别名 + 类型
- `fact_entities` 关联表：事实←→实体多对多
- `memory_banks` 表：按类别聚合的 HRR 向量束

### 2. 实体提取与解析
- 自动从文本提取实体：大写多词短语、引号内词、AKA 别名
- 去重 + 大小写不敏感匹配
- 别名支持（逗号分隔，LIKE 模糊匹配）

### 3. 信任评分系统（非常关键！）
- 每个事实有 `trust_score`（0-1），默认 0.5
- 用户反馈：helpful → +0.05，unhelpful → -0.10
- 检索时按 trust_score 加权：`final_score = relevance * trust_score`
- 反馈工具 `fact_feedback` 让用户主动训练记忆质量

### 4. 混合检索策略（多权重打分）
- FTS5 全文搜索（权重 0.4）→ 取 limit*3 候选
- Jaccard 相似度（权重 0.3）→ 词袋重叠率
- HRR 向量相似度（权重 0.3）→ 代数语义匹配
- 最终得分 = 综合相关性 × trust_score
- 可选时间衰减：`0.5^(age_days / half_life)`

### 5. HRR 向量代数（Holographic Reduced Representations）
- 每个概念映射为相位向量（1024 维，float64）
- 操作：bind（关联）、unbind（解绑）、bundle（合并）
- 确定性生成（SHA-256 哈希），跨进程/机器一致
- 支持代数推理：`reason(["peppi", "backend"])` 找同时涉及两个实体的事实
- 矛盾检测：高实体重叠 + 低内容相似度 → 潜在矛盾

### 6. 关键设计理念
- **主动存储**：系统提示告知 agent "proactively add facts"
- **反馈闭环**：好用就加分，不好用就扣分，垃圾自动沉底
- **系统提示注入**：显示"已存储 N 条事实"
- **预取（prefetch）**：每轮对话前自动检索相关记忆注入上下文
- **自动提取**：会话结束时可选正则提取（偏好/决策/项目信息）
- **记忆镜像**：`on_memory_write` 钩子把内置 memory 工具写入同步到事实库

### 7. 踩过的坑（代码注释里的经验）
- **SQLite 多写者竞争**：多个 agent 实例同时写同一数据库 → "database is locked"。解决方案：进程级共享连接 + 引用计数 + RLock 序列化
- **FTS5 AND 默认行为**：多词查询默认 AND 连接，自然语言查询召回率为 0。必须 OR 连接 + 去停用词
- **HRR 容量警告**：当 SNR < 2.0 时（n_items > dim/4）检索精度下降，必须增加维度或减少存储
- **矛盾检测 O(n²)**：500 条以上时只检查最近更新的，防止性能爆炸
- **时间衰减边界**：timestamp 为空时返回 1.0、age 为负时返回 1.0（防止未来时间戳导致分数异常）
- **路径变量展开**：`$HERMES_HOME` 和 `~` 都要展开
- **自动提取只做精确模式匹配**：不语义提取，只匹配 "I prefer/like/use" 等明确模式

## 对我自己的改进方向
1. 引入信任评分机制，让记忆质量自动上升/下沉
2. 增加实体识别和关联能力（跨事实关联实体）
3. 实现矛盾检测，自动发现记忆冲突
4. 多策略混合检索（FTS + 语义 + 信任加权）
5. 反馈闭环：用户告诉我"这条不准"时自动降权
6. 预取机制：在每一轮对话前自动检索相关记忆
7. 更精确的自动提取（按模式匹配，不盲目全存）
§
[2026-08-16] # Hermes 记忆系统源码分析 - 补充（2026-08-12）

## Mem0 的自动同步机制
- **sync_turn**：每轮对话（user+assistant）自动发送给 Mem0 服务端做 LLM 事实提取
- **prefetch 预取**：用户消息一到就启动后台线程搜索记忆，等 agent 处理时记忆已就绪
- **熔断器（Circuit Breaker）**：连续 5 次失败后暂停 2 分钟，避免打挂已宕机的服务
- **线程安全**：用锁防止并发预取冲突，超时跳过避免重复摄入

## Holographic 的自动提取机制
- 会话结束时可选正则提取（`auto_extract` 配置项）
- 只匹配明确模式："I prefer/like/love/use/want/need..."、"my favorite/preferred...is..."、"we decided/agreed/chose to..."
- 不语义提取，只做精确模式匹配 → 避免噪音

## 我当前记忆系统与 Hermes 的差距

| 维度 | Hermes Holographic | 我当前的系统 |
|------|-------------------|-------------|
| 信任评分 | 每条事实有 trust_score，用户反馈调整 | 无评分机制，新旧不分 |
| 实体识别 | 自动提取实体 + 实体关联实体 | 无实体概念 |
| 矛盾检测 | 自动发现矛盾事实 | 无此功能 |
| 混合检索 | FTS5 + Jaccard + HRR 向量三重打分 | 仅关键词匹配 |
| 时间衰减 | 可选指数衰减，旧的降权 | 无时间衰减 |
| 预取机制 | 每轮自动检索相关记忆注入上下文 | 需要手动调用 |
| 反馈闭环 | helpful/unhelpful 训练质量 | 无反馈机制 |
| 分类管理 | category 分类 + 标签 | 有 target 但无分类 |
| 自动提取 | 正则模式自动提取关键信息 | 有 suggest 但无自动提取 |
| 系统提示 | 注入记忆概况（N条事实） | 有注入但无统计 |
| 熔断保护 | 失败时自动降级不阻塞 | 无此机制 |
| 共享连接 | 多实例共享 SQLite 连接防死锁 | 单实例无此问题 |
§
[2026-08-16] # 从 Hermes 学到的可立即改进的实践

## 1. 主动存储 + 反馈闭环
- 在每一轮对话中，当用户明确表达了偏好/决定/个人信息时，主动调用 memory 存储
- 当用户说"不对/不是这样的/上次记错了"时，不应该只是追加新记录，应该标记旧记录为低可信度（如果系统支持）或明确说明"以下旧记录已失效"
- 我的 `memory_suggest` 机制很好，但需要更主动，不要等审查

## 2. 实体关联思维
- 存储记忆时，应该思考"这与哪些实体相关"（人名、项目名、工具名）
- 检索时应该用"实体"作为索引，而不是只靠关键词
- 例如：用户说"五五的项目" → 关联到"五五"这个实体 + "项目"类别

## 3. 预取思维
- 在回答前，应该先检索相关记忆，而不是仅靠上下文
- 对多跳问题，应该多次检索，每次用不同角度

## 4. 矛盾检测
- 当新信息与旧记忆冲突时，应该主动指出矛盾
- 例如：用户之前说"最喜欢吃辣"，现在说"不能吃辣" → 询问哪个是当前正确的

## 5. 分类管理
- 记忆应该按类别组织（用户偏好、项目决策、工具配置、通用知识）
- 不同类别应该有不同的检索权重

## 6. 熔断保护
- 当 memory 工具调用连续失败时，应该降级而不是阻塞对话
- 失败时不报错，跳过记忆注入继续对话

## 7. 时间衰减
- 旧记忆的权重应该随时间降低
- 除非该记忆被频繁使用（retrieval_count 高）

## 8. 自动提取模式
- 从用户对话中识别可记忆的信息：偏好表述（"我喜欢/用/想要"）、决策（"决定/选择了"）、配置（"我设了/配置了"）
- 但不要盲目提取所有内容，只提取明确的、长久性的信息
§
[2026-08-16] # Hermes 源码深挖第二弹：记忆系统与技能沉淀系统（2026-08-16）

## 记忆系统（Holographic，源码 D:\Hermes Agent CN Desktop\bundled-plugins\memory\holographic\）

### 1. fact_store 工具——比 dsh-memory-evolve 多了 5 个动作
- **probe**（实体探针）：用 HRR 代数解绑实体向量，找"关于某实体的全部事实"，不是关键词搜索
- **related**（关联发现）：找"与该实体结构相关的其他事实"（共享上下文/其他实体）
- **reason**（组合推理）：多实体 AND 查询，`reason(["peppi","backend"])` 找同时涉及两个实体的事实，用 min 相似度实现 AND 语义
- **contradict**（矛盾检测）：实体重叠 Jaccard ≥ 0.3 + 内容向量相似度低 → 矛盾分数 = 实体重叠 × (1-内容相似度)；500 条以上只查最近更新的（防 O(n²)）
- **update**（原地修正）：按 fact_id 改内容/信任分/标签/分类，支持 trust_delta

### 2. 预取（prefetch）真正实现——Mem0 和 Holographic 两种模式
- Holographic 模式：`on_turn_start` 同步调用 retriever.search(query, limit=5)，把结果格式化注入上下文
- Mem0 模式：`on_turn_start` 启动**后台线程**（daemon thread）搜索，`prefetch()` 先看缓存、再启动线程、等最多 3 秒（`_PREFETCH_WAIT_SECS`），超时就跳过注入（不阻塞对话）
- 熔断器：连续 5 次失败（`_BREAKER_THRESHOLD`）暂停 120 秒（`_BREAKER_COOLDOWN_SECS`）
- 查询重写：`query_rewrite.py` 用 LLM 把用户消息改写为检索问句（带防注入校验：要求以疑问词开头、必须提到 user/their/history 等记忆词、防 instruction leak、截断 320 字符）

### 3. 记忆镜像（on_memory_write）
- 内置 memory 工具写入时同步镜像为事实（`on_memory_write` 钩子），Holographic 把它存成 category=user_pref 或 general
- 即"built-in 记忆 → 结构化事实库"双向打通

### 4. 系统提示块（system_prompt_block）
- 注入"已存储 N 条事实 + 用 fact_store 搜索/probe/reason + 用 fact_feedback 评分"
- 空库时提示"主动添加用户会期望你记住的事实"

### 5. 自动提取（on_session_end + auto_extract）
- 只在会话结束时运行，只匹配精确模式：`I prefer/like/love/use/want/need`、`my favorite/preferred/default X is`、`we decided/agreed/chose to`、`the project uses/needs/requires`
- 提取内容截断 400 字符，分类：偏好 → user_pref，决策 → project
- 不做语义提取，只做正则匹配（避免噪音）

### 6. 查询安全（FTS5 踩坑）
- FTS5 多词默认 AND → 召回率为 0；必须 OR 连接 + 去停用词（_FTS_STOPWORDS 约 100 个英文词）
- 每个 token 用引号包裹（防特殊字符当操作符）
- 归一化 FTS5 rank 到 [0,1]

### 7. HRR 向量代数（holographic.py）
- 相位向量 1024 维，SHA-256 确定性生成，跨进程一致
- bind=相位加法（关联）、unbind=相位减法（解绑）、bundle=圆均值（合并）
- encode_fact：内容绑定 ROLE_CONTENT，每个实体绑定 ROLE_ENTITY，再 bundle
- 容量警告：SNR < 2.0 时（n_items > dim/4）检索精度下降，需要增加维度
- numpy 不可用时自动降级：HRR 权重重分配到 FTS5+Jaccard

### 8. SQLite 共享连接注册表
- 进程内所有 MemoryStore 实例共享同一连接（引用计数），避免多写者 "database is locked"
- 关闭连接也走引用计数，最后引用释放才真正关闭

## 技能沉淀系统（Hermes 做法）

### 1. SKILL.md 严格规范（hermes-agent-skill-authoring）
- frontmatter 必须：`---` 在文件字节 0 开始，`\n---\n` 结束，name 必填，description ≤ 1024 字符，正文非空
- 总文件 ≤ 100,000 字符（~36k tokens）；peer 技能 8-14k 字符为佳，超过 20k 要拆分到 references/
- 推荐结构：`# 标题` → `## Overview` → `## When to Use` → 正文 → `## Common Pitfalls` → `## Verification Checklist`
- 每个有序步骤必须有可检查的完成标准（completion criteria）
- description 以 "Use when ..." 开头（触发匹配靠它），避免重复正文内容
- metadata.hermes.tags + related_skills 用于分类关联

### 2. 技能生命周期（skill-curator，用户已有）
- 活跃 → 闲置（30 天未用）→ 归档（60 天未用）
- 归档只移入 .archive/ 永不删除；钉住（pinned）保护
- 使用追踪 .usage.json：use_count / patch_count / view_count / last_used_at

### 3. 自动沉淀（skill-factory，用户已有）
- 复杂任务成功后把方法写成新技能
- 踩坑修复 → 补进对应技能
- 用户纠正 → 立刻更新相关技能
- 技能重叠 → 合并成"伞形"技能

## 与 dsh-memory-evolve 的差距清单（按可实施性排序）

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | fact_store 的 probe/related/reason 动作 | 我们的实体索引已经有了，但只有 list/filter，没有"按实体查全部关联" |
| P0 | 记忆镜像（on_memory_write） | 内置 memory 写入时自动同步到结构化事实库 |
| P1 | 查询重写（LLM rewrite） | 预取前用 LLM 把用户消息改写成检索问句，显著提升召回 |
| P1 | 真正的 prefetch 后台线程 | 现在只有"提示模型先检索"，没有后台预取+3秒等待 |
| P1 | 熔断器 | 工具连续失败 5 次暂停 120 秒，防打挂 |
| P2 | 自动提取（会话结束正则提取） | 已有 suggest，但没有会话结束时的精确模式提取 |
| P2 | fact_feedback 的 update/trust_delta | 现在只有 helpful/unhelpful，没有原地修正 |
| P2 | FTS5 全文搜索 | Node 无内置 FTS5，可自己写简单倒排索引（token → entries） |
| P3 | HRR 向量代数 | 需要纯 JS 实现（无 numpy），1024 维 Float64Array 可行 |
| P3 | 记忆镜像反方向（fact → memory） | 结构化事实写回内置记忆 |
§
[2026-08-16] # dsh-memory-evolve 向 Hermes 自动模式靠拢（2026-08-16）

## 本次新增的自动机制
1. **每轮自动提取**：快照收尾纪律新增"用户消息里有明确偏好/决策时，用 memory action=extract 自动提取"（不再只在会话结束时手动调用）
2. **每轮技能沉淀**：快照收尾纪律新增"复杂任务完成时用 skill_manage 创建/更新技能"
3. **记忆 Tab UI**：memory-files API 现在在每条条目后追加 [信任:X.XX] [实体:...] 标签，刷新页面即可看到

## 与 Hermes 自动模式的差距（仍需 DSH 框架支持）
- session_end 自动提取（Hermes on_session_end）——DSH 无会话结束钩子
- 每轮 LLM 提取（Hermes sync_turn）——DSH 无插件可用的 LLM API
- 真正的后台预取线程（Hermes prefetch daemon）——DSH 无 on_turn_start 钩子

## 现状
- 记忆已持久化，跨会话跨重启
- 信任分/实体/混合检索/HRR/预取工具全部就绪
- 每轮收尾时 AI 会主动提取偏好和决策
§
[2026-08-16] # Hermes 自动模式最终实现（2026-08-16）

## 本次新增（通过插件自给自足，无需改 DSH 核心）

### 1. 实时预取（on_turn_start）
- 钩子 `session/event` 监听用户消息，缓存到 `prefetchCache` Map
- `renderSnapshot` 读取缓存，自动检索相关记忆注入上下文
- 每轮 AI 都能看到"实时预取（基于当前问题）"段

### 2. 会话结束自动提取（on_session_end）
- 钩子 `session/disposed` 扫描会话所有用户消息
- 正则匹配偏好（"我喜欢/用/想要"）→ user 轨
- 正则匹配决策（"我们决定/选择了/项目使用"）→ memory 轨
- 自动写入 store + metadata，无需模型参与

### 3. LLM 查询重写（query_rewrite）
- `memory_prefetch` 工具新增 `useLlm` 参数
- 使用 `ctx.get('llm')` 调用 DSH LLM 服务重写查询
- 5 秒超时，失败时回退到原始查询
- 已实测通过（问题"Hermes 记忆系统"→ 返回 3 轨结果）

### 4. 记忆 Tab 元数据展示
- 每条记忆后追加 `[信任:X.XX] [实体:...]` 标签
- 刷新页面即可看到（memory 轨 5 条信任分 + 7 个实体标签）
§
[2026-08-16] 本回合完成：给 DSH Web 装上了 dsh-vision-toolkit（@anionex/dsh-vision-toolkit 0.1.7），配置智谱 glm-4v-flash 免费视觉为后端，凭据名 GLM_API_KEY（从 Hermes .env 迁入 DSH 凭据库）。模型重试次数（ds provider）从默认 2 改到 5。已通过 vision_glance 端到端验证识别测试图。
§
[2026-08-17] 【工作流程·优先搜索】用户要求：每次收到需求，先通过 dsh-plugin-store skill 搜索 DSH 商店（dshplugin.store / GitHub topic:dsh-plugin），以及 GitHub 搜索，寻找已有的相同/相似/成熟的开源项目，优先直接使用或参考借鉴，不要直接从零开始做。仅在确认无现成方案后才自己构建。
§
[2026-08-17] DSH 插件确认制已取消（2026-08-17 用户拍板）：memory_suggest 直接写入记忆，skill_manage create 直接创建技能到技能库（~/.agents/skills），memory add 全部轨直接落盘，无需用户确认。系统提示词中的「提交建议（用户确认后生效）」文案已同步改为「直接写入（无需确认）」。这是记忆/技能沉淀的行为基线。
§
[2026-08-17] DSH 官方 GUI 只有归档没有删除；要真正清存储用社区插件 dsh-plugin-session-delete（21★），不要手删 ~/.dsh/sessions。
§
[2026-08-17] 改 DSH 官方包里的代码会被升级覆盖；自定义应做成独立 profile 插件（bundles），不要直接改安装目录。
§
[2026-08-18] DSH 生图不要再选聊天模型里的 fal-ai/gpt-image-2；要用侧栏「AI 生图」插件。该插件通过 /images/generations 代理生图，结果在工作台预览，不必先落到文件夹。
§
[2026-08-19] dsh-mobile Android 截图超时"PowerShell worker 超时"根因：快照内 cordis.patch.yml 只禁了 bash-sandbox，pwsh-sandbox 未禁用。Android 上无 pwsh，工具执行器 spawn pwsh worker 挂起超时。修复需在运行时补丁中追加禁用 pwsh-sandbox 的条目。
