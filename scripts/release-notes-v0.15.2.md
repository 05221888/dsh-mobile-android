## v0.15.2 - 修「装完用不了」

**症状**：v0.15.0 / v0.15.1 装在手机上，界面卡在「正在启动引擎…」，两次超时后提示「引擎启动超时，请重试」，进不去聊天。

**根因（两条叠加）**

1. v0.15.0 把 AI 生图插件从 1.0.5 升到 1.5.1 时，**把插件自带的 node_modules 一起丢了**（schemastery / @deepseek-ai/cosmokit / @standard-schema/spec）。手机快照里只有作用域版 `@deepseek-ai/schemastery`，没有顶层 `schemastery`，于是插件顶部的 `import z from "schemastery"` 直接 `ERR_MODULE_NOT_FOUND`。dsh 的插件加载是 fail-loud（一个插件挂掉整棵 cordis 树倒），引擎就再也没起来。
2. 生图插件在插件表里被标成 `safe: true`，而一级兜底的判据正是 safe → **安全模式关不掉它**，两次 90 秒都超时，手机上永远进不去。

**修复**

- 恢复生图插件随包 `node_modules`（schemastery 3.18.1 + cosmokit + @standard-schema/spec），App 里已核对打包内容。
- 引擎侧新增**裸依赖兜底**：启动时把 `schemastery` / `ws` 这类裸名做成 symlink 指向快照内的作用域版，以后插件升级再丢依赖也不会把引擎拖死。
- 插件铺装改为**版本感知**：内置包版本和手机里不一致就整目录重铺（老逻辑「有 package.json 就跳过」会让手机永远跑旧插件）。
- 生图插件 `safe` 改 `false`；新增**二级兜底**（只留启动必需插件）。
- 启动流程改为**三级兜底**：全部开启 → 只留 safe → 只留 bootCritical，保证「至少能进聊天」。

**升级提示**：直接覆盖安装即可，不要卸载（数据在私有目录，覆盖安装会保留）。升完第一次启动会自动重铺生图插件，稍等十几秒。
