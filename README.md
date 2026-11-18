# TokenScope · AI 模型 Token 用量与成本看板

一个纯前端、数据不出本机的网站：统计各 AI 模型用了多少 token，并按**官方真实单价**折算成本。

## 在线访问

打开链接即可使用，无需安装；所有数据都在你自己的浏览器里解析和保存，不上传服务器。

- **对外推荐（GitHub Pages）**：https://muxili686-code.github.io/token-scope/
- **备用（WorkBuddy 应用）**：https://wbapp-r4s1uh4nui4eeoqeuzkm5e.app.workbuddy.host/?sharecode=L5BF25AG7E
- **GitHub 仓库（源码）**：https://github.com/muxili686-code/token-scope

## 启动

```bash
cd token-scope
npm install
npm run dev        # 开发预览 http://localhost:5173
npm run build      # 打包到 dist/，可静态部署
```

## 四个模块

| 模块 | 作用 |
|---|---|
| **数据接入（首页）** | **选择日志/账单文件、整个目录、粘贴文本、API 导入、演示数据 → 自动识别模型 → 跳看板。数据存 IndexedDB 刷新不丢，按批次管理（可重命名/单批删除）** |
| 总览看板 | 时间范围筛选、工作空间活跃分布、日分布热力图、单次请求大小分布（悬停看 token 量）、成本趋势、厂商费用/Token 双环占比、按模型明细、导出报告（PNG/CSV）。所有 token 数统一按「亿 / 万」中文单位显示（万级保留 2 位小数）；同一模型/厂商在各图表中颜色固定统一 |
| Token 估算 | 文本 token 估算 + **多轮对话上下文重复分析**（直观展示历史重放放大倍数，解释"越聊越贵"） |
| 价格管理 | 每百万 token 单价表，输入/输出/缓存分列，可编辑、可改汇率、标注来源与日期 |

> 原「文件分析」与「数据接入」已合并为首页「数据接入」，选文件后自动跳看板。数据存本机 IndexedDB，刷新不丢。每个历史批次可点「查看」看摘要，或点「看板」把该批数据**加载进总览看板**用完整图表分析（看板工具栏的数据源下拉可随时切换/多选组合批次，导出也按当前数据源）。数据安全提示放在首页最前：**全部本地运行，数据不上传、不联网**。

## 数据接入模块（核心 · 首页）

选择文件（支持拖拽、多选、选整个日志目录、粘贴文本）后，浏览器本地自动解析，**完成后自动跳转到「总览看板」**展示结果，不停留在长结果页。页面内置可折叠的「常用 Agent 日志在哪找」指南，覆盖国内外 20+ 工具：WorkBuddy / Claude Code / Qoder CLI / Codex（含累计值差分）/ Gemini CLI / DeepSeek Harness / Hermes Agent / Continue / Cline / Kimi Code / Aider / OpenCode / Cursor / Trae 等编码 Agent，以及 ChatGPT / 豆包 / Devin 等云端 App。每个标注「可直接识别 / 需导出转换 / 需账单」，对 zstd 压缩、SQLite 库等浏览器读不了的格式附本机一键导出命令。

展示的 7 项 KPI：

- **总 TOKEN**：所有请求 token 之和（输入+输出+缓存命中+缓存写入）
- **活跃（缓存写入）**：`cache_creation_input_tokens` 之和
- **会话**：按 `sessionId` 去重的独立会话数
- **请求**：解析出的请求条数
- **输入 / 输出**：输入 token : 输出 token 的比值
- **缓存命中率**：缓存命中 /（缓存命中 + 非缓存输入）
- **费用估算（以官方为准）**：按各厂商官网单价折算人民币，可校正

下方按模型逐行列用量与成本，标注免费档（如 `hy4-free` 成本 0）与未匹配官方价的模型（提示去价格页校正）。成本拆成输入/输出/缓存命中/缓存写入四项分别计价。

**识别的日志格式**（关键）：
- **WorkBuddy / CodeBuddy**：用量在 `providerData.rawUsage`（`prompt_tokens` / `completion_tokens` / `prompt_cache_hit_tokens` / `cache_creation_input_tokens`），模型名在 `providerData.model`
- **Claude Code**：`message.usage`；**OpenAI**：`usage.prompt_tokens` / `prompt_tokens_details.cached_tokens`
- **Hermes Agent**：官方 `hermes sessions export` 导出的 `token_counts:{input,output}` + `model`
- **Codex CLI**：`token_count` 事件是累计值，内置差分还原每次请求
- **DeepSeek Harness**：解压后事件流 `data.usage`；**Gemini CLI**：`usageMetadata`
- **账单**：CSV/JSON 自动识别列名
- 系统摘要类 `message` 事件（无模型名）会被排除，避免虚增请求数

**浏览器直接读取的格式**（v2 新增）：
- `.jsonl.zstd` 压缩日志（DeepSeek Harness）——`fzstd` 在浏览器内自动解压，支持多帧
- `.db / .sqlite / .vscdb` 数据库（Cursor / OpenCode / Qoder 桌面 / MiMoCode / ZCode / Hermes state.db）——`sql.js` WASM 在浏览器内打开，探索式扫描所有表里的 usage JSON，不依赖固定 schema
- 上述文件直接拖入「数据接入」即可，无需命令行

**其他情况**：采用加密存储的本地应用数据（如 Trae）需先从应用内导出；ChatGPT / 豆包 / Devin 等云端 App 对话不落本地 token 日志，可通过页面内置的分平台图文向导导出账单 CSV 后导入。

## 三种数据来源说明

1. **本地日志**：选 WorkBuddy `~/.workbuddy/projects/`、Claude Code `~/.claude/projects/` 目录，或单个 `.jsonl` 文件，逐行解析请求级 usage。
2. **账单导入**：OpenAI usage 导出、火山方舟/豆包账单，或任意含「模型+输入+输出」的 CSV/JSON，自动识别列名。
3. **API 导入**（首页「数据接入」→「API 导入」按钮）：两个 Tab——
   - **网页导出（推荐）**：ChatGPT / 豆包 / 其他平台的分步图文教程，网页点选导出 CSV 后拖入，零基础可照做。
   - **本机命令**：生成可在本机终端运行的 `curl` 命令（OpenAI Usage API），导出 JSON 后拖入或粘贴。Key 只在本机使用，**不经过本网站、不上传、不保存**（网页直连管理平台会被 CORS 拦截）。解析器已支持 OpenAI Usage API 的 `n_input_tokens` / `n_output_tokens` 字段。

## 计费逻辑（为什么更准）

成本 = 输入/1e6×输入单价 + (输出+推理)/1e6×输出单价 + 缓存命中/1e6×缓存命中单价 + 缓存写入/1e6×写入单价。
USD 计价的模型按汇率折算成人民币后汇总（默认 1USD=6.6793CNY，2026-11-17 实时汇率，可改）。缓存写入价默认取输入价 1.25×（Claude 口径）。

单价来源（共 **155 个模型**，均可在价格页点铅笔修改）：
- 价格表列展示**发布日期**（联网核实的模型官方发布日，同系列变体沿用系列发布日）；每条 `source` / `updated`（单价出处与采集日）为内部维护字段，不在客户界面展示。
- **Artificial Analysis 模型价格榜（2026-11-17 采集，主要口径）**：用户提供的榜单截图，含 90+ 主流模型的输入/输出/缓存命中单价与 3:1 折算列。用 `(输入×3+输出)/4=折算列` 交叉校验每行数字，全部吻合后录入。国外模型取榜单美元小字（USD），国内模型（Qwen/DeepSeek/GLM/Kimi/MiMo/MiniMax/腾讯/阶跃等）取人民币价（CNY）。
  - 据此修正了此前取 fast mode / 高价档导致的偏差：如 GPT-6 Astra 20/100→10/50、gpt-5.5 12.5/75→5/30、GLM-5.3 2/8→8/28、Gemini 4 Carbon 优惠价 2/10→标准价 4/20。
- Anthropic 官方：`platform.claude.com/docs` rate card（**Fable 5.2** 2026-11-09 发布 8/40/0.2，5min 写 10、1h 写 16；Opus 4.5~4.8、Sonnet 4.5/4.6 缓存写等细项）
- Google 官方：`aistudio.google.com/docs/pricing`（Gemini 4/3.x 缓存写入等补充）
- Kimi / Qwen 官方：`platform.kimi.ai`、`bailian.console.aliyun.com`（交叉验证）
- 豆包/方舟：火山引擎官方定价页 [0,32K) 现金结算档
- 官网未公开或本次未查到的条目（少数 Grok / Mistral / Inking / Muse 变体等）标 `estimated`，source 注明「请校正」，不伪装成精确价。

## 技术栈

Vite + React 19 + TypeScript(strict) + Tailwind CSS v4 + Recharts + Lucide Icons。响应式，mobile-first。
