## v0.15.4 — 保证「装完能进聊天」

**v0.15.3 为什么仍可能用不了**

1. 默认把 imagegen / 记忆系统 / 记忆互通等重型插件全开；任何一环坏掉，cordis fail-loud 整树倒。
2. 三级兜底最后仍保留 bootCritical；快照自带 `ui-layout` 被禁用，ui-responsive 一坏界面全空（同类项目 kelai141 已证实这是致命项）。
3. 视觉 MCP 在无 key 时也强制挂载，子进程失败同样拖垮引擎。

**v0.15.4 修复**

1. **默认只开最小集**：安卓控制 + 删除会话。其余插件默认关闭，进聊天后在「手机设置」按需打开。
2. **四级启动兜底**：当前集合 → safe → bootCritical → **裸引擎**（目录插件全关 + 剥 mcp-vision + 修 ui-layout）。
3. **工厂语义纠正**：ui-responsive 缺失时强制 re-enable `ui-layout`，避免「引擎在但界面死」。
4. **依赖预检加深**：扫入口 + 随包 node_modules 一层；空壳 entry 直接判坏并关掉非关键插件。
5. **视觉 MCP 懒加载**：只有配置了 `dashscope-key.txt` 才写入 cordis。

**升级方式**：覆盖安装，不要卸载。首次启动会重铺内置插件并按最小集启动。

**排障**：仍失败请把 `startup-report.txt`（App 私有目录）发来。
