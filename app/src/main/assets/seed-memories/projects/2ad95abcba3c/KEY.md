[2026-08-15] 【执行偏好】用户要求：任务直接按 AI 推荐执行到底，不要询问同意，做完交付，用户不满意会自行继续改（2026-08-15 明确指示）。本项目所有任务遵守此模式。
§
[2026-08-17] [branch:all] 【工作流程·优先搜索】用户要求：每次收到需求，先通过 dsh-plugin-store skill 搜索 DSH 商店（dshplugin.store / GitHub topic:dsh-plugin），以及 GitHub 搜索，寻找已有的相同/相似/成熟的开源项目，优先直接使用或参考借鉴，不要直接从零开始做。仅在确认无现成方案后才自己构建。
§
[2026-08-17] [branch:all] dsh-model-failover 已实现并运行时注入：C:\Users\五五\Desktop\项目\dsh-model-failover，包名 @dsh-external/dsh-model-failover。host 借助 agent/request-error + agent/request waterfall；现有 llm-retry 先做同 provider 重试，耗尽后 failover 依 fallbackChain 切换。自定义 session event 不可写入（未知 event 会让持久会话恢复拒绝），历史必须存插件 JSON。当前默认链：deepseek-official/deepseek-v4-pro → ds/z-ai/glm-5.2。
§
[2026-08-17] 会话永久删除已用社区插件 @huanlin/dsh-plugin-session-delete（lsz-asd/dsh-plugin-session-delete v0.3.1，21★）落地：源码在 C:\Users\五五\Desktop\项目\dsh-plugin-session-delete，已写入 web profile bundles 并运行时注入。删除会清 ~/.dsh/sessions 日志目录、投影缓存、工作区记账；入口为会话顶栏垃圾桶 + 侧栏「… → 删除会话」，需勾选确认。工具名 workbench_session_delete。
§
[2026-08-17] 已解决、勿再当待办：notify-sound、休闲区顶栏 Tab/profile 持久化、模型添加默认全选、工作区选 D 盘。休闲区是 profile 包 dsh-leisure-zone，不是未收尾的动态插件。
§
[2026-08-17] dsh-context 已卸载（用户看不懂且不省 token）。省 token 用新开会话 + rtk/CodeGraph，不装上下文仪表盘。收尾：只有本回合确实新增记忆/技能才口头告知，没有则不提。
§
[2026-08-17] [branch:all] router-wsl 预设在这台 Windows 上不能当真 WSL 用：宿主 dsh-base 用 process.platform==='win32' 关掉 bash-sandbox/tool-bash、打开 pwsh；预设里再写 disabled:false/true 翻不了宿主同行。bash-sandbox 与 pwsh-sandbox 都抢 ctx.shell，硬开 bash 会挂载冲突。本机 Ubuntu WSL2 能跑（wsl -e echo 成功），但默认是 Stopped，8GB 内存（空闲常 ~2GB）冷启动很吃力。日常继续用 router-standard / 标准模式 + pwsh。
§
[2026-08-17] [branch:all] 省 token 已落地（2026-08-17）：删了 router-wsl。装了改装版 dsh-rtk（C:\Users\五五\Desktop\项目\dsh-rtk，钉死 rtk.exe、关闭每轮宣告）和 dsh-compaction-instant（同目录，import 改 schemastery、白名单加 pwsh）。新会话请用 router-standard/router-spec 或官方标准模式；本会话仍锁在已删的 router-wsl 常驻件上，不影响新会话。
§
[2026-08-17] [branch:all] dsh-compaction-instant 用裸名安装时，client.js 必须额外 __ModuleLoader__.load({id:"dsh-compaction-instant"})。官方只注册了 @deepseek-ai/dsh-compaction-basic 和 @deepseek-ai/dsh-compaction-instant，boot 图要裸名就会 Failed to load plugins。bundle 的 cordis.patch.yml 已经会插 compaction-instant，profile patch 再插一次会 duplicate loader entry。不要为了前端模块 id 去反复重启整个 dsh web。
§
[2026-08-17] [branch:all] 桌面 DSH Web 快捷方式指向 C:\Users\五五\Desktop\DSH\dsh-web.bat。2026-08-17 已换成稳健启动：页面已是 200 就只开浏览器不杀 8787；否则用 D:\node.exe 直接跑 dsh，等到 HTTP 200 再开浏览器；启动前 heal-dsh-web.ps1 会拆掉 profile 里重复的 compaction-instant insert，并给 client.js 补裸名模块 id。旧脚本备份 dsh-web.bat.bak-20260817。
§
[2026-08-17] 待办时间轴按「可调时间块」排，不再铺满每个整点。[plan] 支持 HH:MM 或 HH:MM-HH:MM（回声复盘 start/end 模型）。界面：只显示已排块、起止可改、25/50/90 分预设、块间距<10 分钟提示、重叠标红。due 仍是截止日期。
§
[2026-08-18] DSH Web 已接入生图预览插件 @dickpy/dsh-imagegen：源码在 C:\Users\五五\Desktop\项目\dsh-imagegen，已写入 web profile bundles。侧栏入口「AI 生图」可预览/下载/看历史。API 走 https://ai.furry.vg/v1，默认模型 fal-ai/gpt-image-2，密钥复用 DS_API_KEY。当前中转站没有视频模型，生视频未接。
§
[2026-08-18] dsh-imagegen 当前 DSH UI 空白的根因与修复：当前 shell 中间列是动态 class*="centerCol"，旧插件只查 data-pane="conversation"，导致激活 CSS 隐藏会话但面板未挂载。mount.tsx 现在同时支持两个选择器；修改后需同步 web profile 运行包 lib/client.js 并 dev_reload_package。
§
[2026-08-18] dsh-imagegen 已支持生图面板内多配置档案：每条含名称/API地址/密钥/模型；密钥只存宿主 ~/.dsh/dsh-imagegen/profiles.json，前端只显示 keySet。旧单 URL/单密钥会自动迁成「默认配置」。面板标题栏有「返回聊天」关闭工作台。生成请求带 profileId，由宿主按档案解析上游。修改后需同步 lib 并 dev_reload_package。
§
[2026-08-18] dsh-imagegen 生图可后台继续：关闭面板/返回聊天不中断请求。完成后复用 dsh-notify-sound 的音效与音量，并在侧栏「AI 生图」入口显示状态点（生成中闪动、成功绿点、失败红点）；再次打开面板会清掉完成标记。
§
[2026-08-18] 记忆检索设计方向：采用 Trust-Gated Progressive Memory Retrieval（信任门控渐进式记忆检索）。以 OpenViking 的 L0/L1/L2 渐进加载和阈值/收敛停止为骨架，以 Hindsight 的摘要优先、原文按需回查为内容策略，以 Hermes 的 relevance×trust、实体覆盖、时间有效性和冲突检测为门控条件；先做 high→mid→low 信任分层、字符/条数/全文读取预算和 early-stop，不新做向量库。
§
[2026-08-18] DSH 手机版首版基线：kelai141/dsh-mobile-apk v0.11.3。本地仓库 C:\Users\五五\Desktop\项目\dsh-mobile-android。已加固网络安全、更新校验/回滚、快照路径穿越防护、debug-only ACTION_UPDATE、WebView polyfill；compileDebugKotlin 已通过。完整 APK 因 GitHub Releases 大文件被墙未下完，当前可用路径是手机直接下载官方 arm64 APK。远程电脑模式留第二阶段。
§
[2026-08-18] DSH 手机生态四类路线：本机运行（kelai/dsh-mobile-apk）、远程控制（dsh-pocket/full-remote）、移动 UI（dsh-web-mobile）、原生设备 Agent（dsh-phone/Minis）。不要绑 0.0.0.0；远程必须反代改写 Host/Origin 并自建 ACL。
§
[2026-08-18] Windows 构建 DSH Android：JDK 用 Android Studio jbr；SDK 在 D:\Android\Sdk；Gradle 8.11.1 可从腾讯云镜像拉；中文用户路径必须 android.overridePathCheck=true；国内构建要加阿里云 google/central/gradle-plugin 镜像。
§
[2026-08-18] GitHub Releases 大文件本机常被墙。二进制用 gh-proxy.com/<完整url>；Gradle 用 mirrors.cloud.tencent.com/gradle；迷雾通启动后等 10-20 秒，且不保证所有墙外域名都通。
§
[2026-08-19] 【aitool 网站生图】和电脑 dsh-imagegen 插件对齐：走 /images/generations 与 /images/edits；不要传 n（要几张就请求几次）；超时 240 秒；推荐模型 gpt-image-2（约 35 秒），fal-ai/gpt-image-2 经常 2 分钟+超时。页面源码禁止写入 API Key。生图建议浏览器直连 https://ai.furry.vg/v1；Cloudflare 免费 Functions 约 30 秒会断，不适合慢生图。交付目录：C:\Users\五五\Desktop\项目\aitool_site_final。
