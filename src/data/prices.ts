import type { Price } from '../types'

/**
 * 官方单价表（每百万 token）
 * ------------------------------------------------------------------
 * 数据采集：2026-11-16，来源见每条 source 字段。
 * 说明：
 *  - OpenAI 短上下文标准价（非 fast mode / batch）。GPT-5 系列取官网
 *    gpt-5-for-developers 页公布值；GPT-4.1/o3/o4-mini 取 fast mode 表中
 *    标注的短上下文标准列（该页"每百万输入令牌价格"即标准价，Fast 另有条目）。
 *  - Anthropic 取 anthropic.com/api 官方页（<=200K 短上下文）。
 *  - 豆包/方舟取 volcengine 官方定价页 [0,32K) 档现金结算价，元/千token ×1000。
 *  - DeepSeek 取 deepseek.com 官方（cache miss=未命中输入，cache hit=命中）。
 *  - GLM 取 bigmodel.cn 官方定价页。
 *  - Kimi 官网未公开逐模型 API 单价，标注为估算，请自行校正。
 *  - 所有价格均可在「价格管理」页修改并持久化到 localStorage。
 *
 * ⚠️ 厂商调价频繁，本表仅作折算基准，最终以各厂商官网实时价为准。
 */
export const DEFAULT_PRICES: Record<string, Price> = {
  // ---------- OpenAI (USD / 1M) ----------
  'gpt-6-astra':      { input: 10, output: 50,  cacheRead: 1,    currency: 'USD', source: 'Artificial Analysis 榜单价($10/$50/命中1)', updated: '2026-11-17', released: '2026-09-03', },
  'gpt-6.1-sol':      { input: 2,  output: 10,  cacheRead: 0.1,  currency: 'USD', source: 'Artificial Analysis 榜单价($2/$10/命中0.1)', updated: '2026-11-17', released: '2026-09-29', },
  'gpt-6.1-terra':    { input: 1,  output: 5,   cacheRead: 0.05, currency: 'USD', source: 'Artificial Analysis 榜单价($1/$5/命中0.05)', updated: '2026-11-17', released: '2026-10-26', },
  'gpt-6-sol':        { input: 2,  output: 10,  cacheRead: 0.2,  currency: 'USD', source: 'Artificial Analysis 榜单价($2/$10/命中0.2)', updated: '2026-11-17', released: '2026-09-22', },
  'gpt-6-luna':       { input: 0.1,output: 0.5, cacheRead: 0.01, currency: 'USD', source: 'Artificial Analysis 榜单价($0.1/$0.5/命中0.01)', updated: '2026-11-17', released: '2026-09-22', },
  'gpt-5.6-sol':      { input: 5,  output: 30,  cacheRead: 0.5,  currency: 'USD', source: 'Artificial Analysis 榜单价($5/$30/命中0.5)', updated: '2026-11-17', released: '2026-07-09', },
  'gpt-5.6-terra':    { input: 2,  output: 12,  cacheRead: 0.2,  currency: 'USD', source: 'Artificial Analysis 榜单价($2/$12/命中0.2)', updated: '2026-11-17', released: '2026-07-09', },
  'gpt-5.6-luna':     { input: 0.2,output: 1.2, cacheRead: 0.02, currency: 'USD', source: 'Artificial Analysis 榜单价($0.2/$1.2/命中0.02)', updated: '2026-11-17', released: '2026-07-09', },
  'gpt-5.5':          { input: 5,  output: 30,  cacheRead: 0.5,  currency: 'USD', source: 'Artificial Analysis 榜单价($5/$30/命中0.5)', updated: '2026-11-17', released: '2026-04-23', },
  'gpt-5.4-mini':     { input: 0.75,output: 4.5, cacheRead: 0.075,currency: 'USD', source: 'Artificial Analysis 榜单价($0.75/$4.5)', updated: '2026-11-17', released: '2026-03-17', },
  'gpt-5.4':          { input: 2.5, output: 15,  cacheRead: 0.25, currency: 'USD', source: 'Artificial Analysis 榜单价($2.5/$15/命中0.25)', updated: '2026-11-17', released: '2026-03-05', },
  'gpt-5.2':          { input: 3.5, output: 28,  cacheRead: 0.35, currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-12-11', },
  'gpt-5.1':          { input: 2.5, output: 20,  cacheRead: 0.25, currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-11-12', },
  'gpt-5':            { input: 2.5, output: 20,  cacheRead: 0.25, currency: 'USD', source: 'OpenAI 官网 (gpt-5-for-developers)', updated: '2026-11-16', released: '2025-08-07', },
  'gpt-5-mini':       { input: 0.25,output: 2,   cacheRead: 0.025,currency: 'USD', source: 'Artificial Analysis 榜单价($0.25/$2/命中0.025)', updated: '2026-11-17', released: '2025-08-07', },
  'gpt-5-nano':       { input: 0.05,output: 0.4, cacheRead: 0.005,currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-08-07', },
  'gpt-4.1':          { input: 3.5, output: 14,  cacheRead: 0.875,currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-04-14', },
  'gpt-4.1-mini':     { input: 0.7, output: 2.8, cacheRead: 0.175,currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-04-14', },
  'gpt-4.1-nano':     { input: 0.2, output: 0.8, cacheRead: 0.05, currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-04-14', },
  'gpt-4o':           { input: 4.25,output: 17,  cacheRead: 2.125,currency: 'USD', source: 'OpenAI 官网 (fast mode 短上下文)', updated: '2026-11-16', released: '2024-05-13', },
  'gpt-4o-mini':      { input: 0.25,output: 1,   cacheRead: 0.125,currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2024-07-18', },
  'o3':               { input: 3.5, output: 14,  cacheRead: 0.875,currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-04-16', },
  'o4-mini':          { input: 2,   output: 8,   cacheRead: 0.5,  currency: 'USD', source: 'OpenAI 官网', updated: '2026-11-16', released: '2025-04-16', },

  // ---------- Anthropic Claude (USD / 1M) ----------
  // Fable 5.2（2026-11-09 发布）：$8/$40，缓存读 $0.20(输入价0.025x)，5min写 $10，1h写 $16
  'claude-fable-5.2': { input: 8,   output: 40,  cacheRead: 0.2,  cacheWrite: 10,   currency: 'USD', source: 'Anthropic 官网 claude-fable-5-2 platform docs (11/9发布)', updated: '2026-11-17', released: '2026-11-09', },
  'claude-mythos-5.2':{ input: 8,   output: 40,  cacheRead: 0.2,  cacheWrite: 10,   currency: 'USD', source: 'Anthropic 官网，与 Fable 5.2 同价', updated: '2026-11-17', released: '2026-11-09', },
  'claude-fable-5.1': { input: 10,  output: 50,  cacheRead: 0.25, cacheWrite: 12.5, currency: 'USD', source: 'Anthropic 官网 api', updated: '2026-11-16', released: '2026-09-01', },
  'claude-opus-5.5':  { input: 4,   output: 20,  cacheRead: 0.2,  cacheWrite: 5,    currency: 'USD', source: 'Anthropic 官网 api', updated: '2026-11-16', released: '2026-09-22', },
  'claude-sonnet-5.5':{ input: 2,   output: 10,  cacheRead: 0.1,  cacheWrite: 2.5,  currency: 'USD', source: 'Anthropic 官网 api', updated: '2026-11-16', released: '2026-09-28', },
  'claude-haiku-5.5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125,currency: 'USD', source: 'Anthropic 官网 (<=100K)', updated: '2026-11-16', released: '2026-09', },
  'claude-opus-5':    { input: 5,   output: 25,  cacheRead: 0.5,  cacheWrite: 6.25, currency: 'USD', source: 'Anthropic 官网', updated: '2026-11-16', released: '2026-07-24', },
  'claude-sonnet-5':  { input: 2,   output: 10,  cacheRead: 0.2,  cacheWrite: 2.5,  currency: 'USD', source: 'Anthropic 官网', updated: '2026-11-16', released: '2026-08', },
  'claude-haiku-4.5': { input: 1,   output: 5,   cacheRead: 0.1,  cacheWrite: 1.25, currency: 'USD', source: 'Anthropic 官网', updated: '2026-11-16', released: '2025-10-15', },

  // ---------- 豆包 / 火山方舟 (CNY / 1M) ----------
  'doubao-seed-2.0-pro':  { input: 3.2, output: 16,  cacheRead: 0.64, currency: 'CNY', source: '火山引擎官方 [0,32K) 现金结算', updated: '2026-11-16', released: '2025-12', },
  'doubao-2.1-pro':       { input: 6,   output: 30,  cacheRead: 1.2,  currency: 'CNY', source: '火山引擎官网首页', updated: '2026-11-16', released: '2026', },
  'doubao-seed-2.0-lite': { input: 0.6, output: 3.6, cacheRead: 0.12, currency: 'CNY', source: '火山引擎官方 [0,32K)', updated: '2026-11-16', released: '2025-12', },
  'doubao-seed-2.0-mini': { input: 0.2, output: 2,   cacheRead: 0.04, currency: 'CNY', source: '火山引擎官方 [0,32K)', updated: '2026-11-16', released: '2025-12', },
  'doubao':               { input: 6,   output: 30,  cacheRead: 1.2,  currency: 'CNY', source: '火山引擎官网首页(推理)', updated: '2026-11-16', released: '2025-12', },

  // ---------- DeepSeek (CNY / 1M) ----------
  'deepseek-v3.2':  { input: 2, output: 8,  cacheRead: 0.5, currency: 'CNY', source: 'DeepSeek 官方(cash miss/hit 参考)', updated: '2026-11-16', estimated: true, released: '2025-12', },
  'deepseek-reasoner':{ input: 4,output: 16, cacheRead: 1,  currency: 'CNY', source: 'DeepSeek 官方 R1 定价', updated: '2026-11-16', released: '2025-01-20', },
  'deepseek-chat':  { input: 2, output: 8,  cacheRead: 0.5, currency: 'CNY', source: 'DeepSeek 官方', updated: '2026-11-16', released: '2024-12-26', },
  'deepseek':       { input: 2, output: 8,  cacheRead: 0.5, currency: 'CNY', source: 'DeepSeek 官方', updated: '2026-11-16', released: '2025-01', },

  // ---------- 智谱 GLM (CNY / 1M) ----------
  'glm-5.3':      { input: 8,   output: 28,  cacheRead: 2,    currency: 'CNY', source: 'Artificial Analysis 榜单价(¥8/¥28/命中2)', updated: '2026-11-17', released: '2026-08-14', },
  'glm-5.3-flash':{ input: 0.8, output: 2.8, cacheRead: 0.23, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥0.8/¥2.8/命中0.23)', updated: '2026-11-17', released: '2026-08-28', },
  'glm-5.2':      { input: 8,   output: 28,  cacheRead: 2,    currency: 'CNY', source: '按 GLM-5.3 档(¥8/¥28/命中2)', updated: '2026-11-17', released: '2026-06-13', },
  'glm-4.6v':     { input: 1,   output: 3,   cacheRead: 0.2,  currency: 'CNY', source: 'bigmodel.cn 官方 (<32K)', updated: '2026-11-16', released: '2026-02-12', },
  'glm':          { input: 2,   output: 8,   cacheRead: 0.4,  currency: 'CNY', source: 'bigmodel.cn 官方', updated: '2026-11-16', released: '2026-02-12', },

  // ---------- Kimi / Moonshot (USD / 1M) ----------
  'kimi-k3':      { input: 20,  output: 100, cacheRead: 2,    currency: 'CNY', source: 'Artificial Analysis 榜单价(¥20/¥100/命中2)', updated: '2026-11-17', released: '2026-07-16', },
  'kimi':         { input: 2,   output: 10,  cacheRead: 0.5,  currency: 'CNY', source: '官网未公开逐模型价，估算，请校正', updated: '2026-11-16', estimated: true, released: '2025', },
  'kimi-k2':      { input: 2,   output: 10,  cacheRead: 0.5,  currency: 'CNY', source: '估算，请校正', updated: '2026-11-16', estimated: true, released: '2025-09', },
  'moonshot':     { input: 2,   output: 10,  cacheRead: 0.5,  currency: 'CNY', source: '估算，请校正', updated: '2026-11-16', estimated: true, released: '2026-11', },

  // ---------- 用量截图中识别到的 2026 新模型（官方价，人民币/百万token）----------
  // DeepSeek V4 系列：官方 api-docs 价 $0.14/$0.28（flash）、$0.435/$0.87（pro）；国内 8/17 起峰谷，取均值口径
  'deepseek-v4.1-flash': { input: 1, output: 4, cacheRead: 0.02, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥1/¥4/命中0.02)', updated: '2026-11-17', released: '2026-09-10', },
  'deepseek-v4-flash':   { input: 1.5, output: 4.5, cacheRead: 0.05, currency: 'CNY', source: 'DeepSeek V4 Flash 官方国内价(8/17峰谷,取闲时)', updated: '2026-11-16', released: '2026-07-31', },
  'deepseek-v4-pro':     { input: 4.5, output: 13.5, cacheRead: 0.15, currency: 'CNY', source: 'DeepSeek V4 Pro 官方国内价(8/17峰谷,取闲时)', updated: '2026-11-16', released: '2026-08-13', },
  // 腾讯混元：hy3 官方 1/4/0.25；hy4 刊例 6/18/0.3；hy4-flash 11/16 新发布 0.5/2/0.02；hy4-free 为 WorkBuddy 免费档 → 按 0 成本
  'hy3':       { input: 1, output: 4, cacheRead: 0.25, currency: 'CNY', source: '腾讯混元官方 hunyuan.tencent.com/research/hy3', updated: '2026-11-16', released: '2026-06', },
  'hy4':       { input: 6, output: 18, cacheRead: 0.3, currency: 'CNY', source: '腾讯混元官方 hy4 刊例价(年底前TokenHub 5折)', updated: '2026-11-16', released: '2026-08-28', },
  'hy4-flash': { input: 0.5, output: 2, cacheRead: 0.02, currency: 'CNY', source: '腾讯混元 Hy4 flash 官方价(11/16发布，224B/12B激活，1M上下文)', updated: '2026-11-17', released: '2026-11-16', },
  'hy4-free':  { input: 0, output: 0, cacheRead: 0, currency: 'CNY', source: 'WorkBuddy 活动免费档(11/4-11/15)，实际成本 0；付费版见 hy4-flash', updated: '2026-11-16', released: '2026-11-04', },
  // 小米 MiMo V2.6 Pro 官方国内价
  'mimo-v2.6-pro': { input: 3, output: 6, cacheRead: 0.025, currency: 'CNY', source: '小米 MiMo 官方 mimo.mi.com/docs/pricing', updated: '2026-11-16', released: '2026-10', },
  // 阶跃星辰 Step 5 Preview 官方价（10/14 起缓存命中 0.70）
  'step-5-preview': { input: 7, output: 20, cacheRead: 0.7, currency: 'CNY', source: '阶跃星辰官方 platform.stepfun.com/docs', updated: '2026-11-16', released: '2026-07', },
  // MiniMax M3.1 Flash 官方价 $0.15/0.60/0.015（USD 计价，按当前汇率自动折算）
  'minimax-m3.1-flash': { input: 1, output: 4, cacheRead: 0.1, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥1/¥4/命中0.1)', updated: '2026-11-17', released: '2026-07', },

  // ================= 2026-11-17 补充：Artificial Analysis 榜单 / 用户价格图识别到的主流模型 =================
  // 说明：图中价格列因压缩模糊无法逐字辨认，以下单价一律取各厂商官网定价页核实值；
  //       官网未公开或本次未查到的，标 estimated: true，请按实际账单校正。

  // ---------- Google Gemini (USD / 1M，aistudio.google.com 官方定价页) ----------
  'gemini-4-carbon':      { input: 4,    output: 20,   cacheRead: 0.2,   currency: 'USD', source: 'Artificial Analysis 榜单价($4/$20/命中0.2)', updated: '2026-11-17', released: '2026-11-10', },
  'gemini-4-argon':       { input: 4,    output: 20,   cacheRead: 0.2,   currency: 'USD', source: 'Artificial Analysis 榜单价($4/$20/命中0.2)', updated: '2026-11-17', released: '2026-10-13', },
  'gemini-4-hydrogen':    { input: 1.5,  output: 7.5,  cacheRead: 0.075, currency: 'USD', source: 'Google 官方 Gemini 4 Hydrogen', updated: '2026-11-17', released: '2026-11-12', },
  'gemini-3.8-flash':     { input: 1.5,  output: 7.5,  cacheRead: 0.15,  currency: 'USD', source: 'Artificial Analysis 榜单价($1.5/$7.5/命中0.15)', updated: '2026-11-17', released: '2026-09-02', },
  'gemini-3.6-flash':     { input: 1.5,  output: 7.5,  cacheRead: 0.15,  currency: 'USD', source: 'Artificial Analysis 榜单价($1.5/$7.5/命中0.15)', updated: '2026-11-17', released: '2026-07-21', },
  'gemini-3.5-flash-lite':{ input: 0.3,  output: 2.5,  cacheRead: 0.03,  currency: 'USD', source: 'Google 官方 Gemini 3.5 Flash-Lite', updated: '2026-11-17', released: '2026-07-21', },
  'gemini-3.1-pro':       { input: 2,    output: 15,   cacheRead: 0.2,   currency: 'USD', source: 'Artificial Analysis 榜单价($2/$15/命中0.2)', updated: '2026-11-17', released: '2026-02-19', },
  'gemini-3.1-flash-lite':{ input: 0.25, output: 1.5,  cacheRead: 0.025, currency: 'USD', source: 'Google 官方 Gemini 3.1 Flash-Lite', updated: '2026-11-17', released: '2026-05-07', },
  'gemini-3-flash':       { input: 0.5,  output: 3,    cacheRead: 0.05,  currency: 'USD', source: 'Google 官方 Gemini 3 Flash Preview', updated: '2026-11-17', released: '2025-12-17', },
  'gemini-2.5-pro':       { input: 1.25, output: 7.5,  cacheRead: 0.125, currency: 'USD', source: 'Artificial Analysis 榜单价($1.25/$7.5/命中0.125)', updated: '2026-11-17', released: '2025-06-17', },
  'gemini-2.5-flash':     { input: 0.3,  output: 2.5,  cacheRead: 0.03,  currency: 'USD', source: 'Google 官方 Gemini 2.5 Flash', updated: '2026-11-17', released: '2025-05-20', },
  'gemini-2.5-flash-lite':{ input: 0.1,  output: 0.4,  cacheRead: 0.01,  currency: 'USD', source: 'Google 官方 Gemini 2.5 Flash-Lite', updated: '2026-11-17', released: '2025-05-20', },
  'gemini':               { input: 2,    output: 12,   cacheRead: 0.2,   currency: 'USD', source: '按 Gemini 3.1 Pro 量级估，具体看模型后缀', updated: '2026-11-17', estimated: true, released: '2025-12', },

  // ---------- Anthropic Claude 4.x 系列官方价（USD，platform.claude.com price card）----------
  'claude-opus-4.8':  { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25, currency: 'USD', source: 'Anthropic 官方 Opus 4.8 rate card', updated: '2026-11-17', released: '2026-05-28', },
  'claude-opus-4.7':  { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25, currency: 'USD', source: 'Anthropic 官方 Opus 4.7 rate card', updated: '2026-11-17', released: '2026-04-16', },
  'claude-opus-4.6':  { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25, currency: 'USD', source: 'Anthropic 官方 Opus 4.6 rate card', updated: '2026-11-17', released: '2026-02-05', },
  'claude-opus-4.5':  { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25, currency: 'USD', source: 'Anthropic 官方 Opus 4.5 rate card(≤200K)', updated: '2026-11-17', released: '2025-11-24', },
  'claude-sonnet-4.6':{ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75, currency: 'USD', source: 'Anthropic 官方 Sonnet 4.6 rate card', updated: '2026-11-17', released: '2026-02-17', },
  'claude-sonnet-4.5':{ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75, currency: 'USD', source: 'Anthropic 官方 Sonnet 4.5 rate card', updated: '2026-11-17', released: '2025-09-29', },
  'claude-fable-5':   { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5, currency: 'USD', source: 'Artificial Analysis 榜单价($10/$50/命中0.25)', updated: '2026-11-17', released: '2026-06-09', },
  'claude-mythos-5':  { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5, currency: 'USD', source: 'Artificial Analysis 榜单价(同 Fable 5)', updated: '2026-11-17', released: '2026-06-09', },

  // ---------- Kimi K3/K2 系列（USD，platform.kimi.ai 官方价目表）----------
  'kimi-k3.1-pro':         { input: 13,   output: 68,  cacheRead: 1.3,  cacheWrite: 13, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥13/¥68/命中1.3)', updated: '2026-11-17', released: '2026-10', },
  'kimi-k3.1-pro-highspeed':{ input: 4,   output: 20,  cacheRead: 0.2,  cacheWrite: 4, currency: 'USD', source: 'Kimi 官方 K3.1 Pro Highspeed 国际站价', updated: '2026-11-17', released: '2026-10', },
  'kimi-k2.7-code':        { input: 6.5, output: 27,  cacheRead: 1.3, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥6.5/¥27/命中1.3)', updated: '2026-11-17', released: '2026-06', },
  'kimi-k2.6':             { input: 6.5, output: 27,  cacheRead: 1.1, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥6.5/¥27/命中1.1)', updated: '2026-11-17', released: '2026-04-20', },
  'kimi-k2.5':             { input: 0.95, output: 4,   cacheRead: 0.16, currency: 'USD', source: '按 K2.6 同档估算，官网未单列', updated: '2026-11-17', estimated: true, released: '2026-01-27', },

  // ---------- 通义千问 Qwen3.x（CNY，阿里云百炼官方价）----------
  'qwen3.8-max':   { input: 12,  output: 36,  cacheRead: 1.5, currency: 'CNY', source: '阿里云百炼官方 Qwen3.8-Max 国内价', updated: '2026-11-17', released: '2026-08-02', },
  'qwen3.8-flash': { input: 0.8, output: 2.7, cacheRead: 0.16,currency: 'CNY', source: '阿里云百炼官方 Qwen3.8-Flash 优惠价', updated: '2026-11-17', released: '2026-08-25', },
  'qwen3.5-max':   { input: 12,  output: 36,  cacheRead: 1.5, currency: 'CNY', source: '按 Qwen3.8-Max 同档估算，官网已迭代', updated: '2026-11-17', estimated: true, released: '2026-02-16', },
  'qwen3.5-plus':  { input: 2,   output: 6,   cacheRead: 0.4, currency: 'CNY', source: '按 Qwen Plus 档估算，官网未单列', updated: '2026-11-17', estimated: true, released: '2026-02-16', },
  'qwen3.5-270b':  { input: 1,   output: 3,   cacheRead: 0.2, currency: 'CNY', source: '开源 270B 按同尺寸估算，待校正', updated: '2026-11-17', estimated: true, released: '2026-02-16', },
  'qwen3.5-397b':  { input: 1.2, output: 4,   cacheRead: 0.24,currency: 'CNY', source: '开源 397B 按同尺寸估算，待校正', updated: '2026-11-17', estimated: true, released: '2026-02-16', },

  // ---------- xAI Grok 4.x（USD，官网本次未查到逐模型价，按 Grok 4 历史档估算待校正）----------
  'grok-4.7':  { input: 2, output: 6,  cacheRead: 0.5,  currency: 'USD', source: 'Artificial Analysis 榜单价($2/$6/命中0.5)', updated: '2026-11-17', released: '2026-09-21', },
  'grok-4.4':  { input: 3, output: 15, cacheRead: 0.75, currency: 'USD', source: '按 Grok 4 档估算，请校正', updated: '2026-11-17', estimated: true, released: '2026-05', },
  'grok-4-fast':{ input: 0.2, output: 0.5, cacheRead: 0.05, currency: 'USD', source: '按 Grok 4 Fast 历史价估算，请校正', updated: '2026-11-17', estimated: true, released: '2026-03', },

  // ---------- MiniMax M2.x / M3.x（USD，官网本次未查到逐模型价，估算待校正）----------
  'minimax-m2.5':      { input: 1, output: 2, cacheRead: 0.02, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥1/¥2/命中0.02)', updated: '2026-11-17', released: '2026-03', },
  'minimax-m2.5-pro':  { input: 0.6, output: 2.4, cacheRead: 0.06, currency: 'USD', source: '按 M2 Pro 档估算，请校正', updated: '2026-11-17', estimated: true, released: '2026-03', },
  'minimax-m2.7':      { input: 2.1, output: 8.4, cacheRead: 0.42, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥2.1/¥8.4/命中0.42)', updated: '2026-11-17', released: '2026-05', },
  'minimax-m3.1':      { input: 0.15, output: 0.6, cacheRead: 0.015,currency: 'USD', source: '同 minimax-m3.1-flash 官方价', updated: '2026-11-17', released: '2026-07', },
  'minimax-large-4':   { input: 1,   output: 4,   cacheRead: 0.1,  currency: 'USD', source: '按大模型档估算，请校正', updated: '2026-11-17', estimated: true, released: '2025', },

  // ---------- 图中识别到的其他 2026 模型（官网未公开价，估算待校正）----------
  'deepseek-v4.1-flash-1017': { input: 1.5, output: 4.5, cacheRead: 0.05, currency: 'CNY', source: '同 DeepSeek V4.1 Flash 官方价(1017 快照)', updated: '2026-11-17', released: '2026-10-17', },
  'deepseek-v4-pro-0815':     { input: 4.5, output: 13.5, cacheRead: 0.15, currency: 'CNY', source: '同 DeepSeek V4 Pro 官方价(0815 快照)', updated: '2026-11-17', released: '2026-08-15', },
  'deepseek-v4-flash-thinking':{ input: 1.5, output: 4.5, cacheRead: 0.05, currency: 'CNY', source: '同 V4 Flash 档估算(thinking 变体)', updated: '2026-11-17', estimated: true, released: '2026-07-31', },
  'glm-5.1':           { input: 2,   output: 8,   cacheRead: 0.4, currency: 'CNY', source: '按 GLM 5.x 档估算，官网已迭代', updated: '2026-11-17', estimated: true, released: '2026-05', },
  'step-3.5-preview':  { input: 7,   output: 20,  cacheRead: 0.7, currency: 'CNY', source: '按 Step 5 档估算，请校正', updated: '2026-11-17', estimated: true, released: '2026-04', },
  'mimo-v2.5':         { input: 3,   output: 6,   cacheRead: 0.025,currency: 'CNY', source: '同 MiMo V2.6 档估算，请校正', updated: '2026-11-17', estimated: true, released: '2026-07', },
  'ling-2.5-flash':    { input: 0.5, output: 2,   cacheRead: 0.1, currency: 'CNY', source: '按开源 Flash 档估算，请校正', updated: '2026-11-17', estimated: true, released: '2026-04', },
  'muse-wonder':       { input: 4,   output: 20,  cacheRead: 0.2,  currency: 'USD', source: 'Artificial Analysis 榜单价($4/$20/命中0.2)', updated: '2026-11-17', released: '2026-10', },
  'muse-spark':        { input: 1.25,output: 4.25,cacheRead: 0.15, currency: 'USD', source: 'Artificial Analysis 榜单价 Muse Spark 系列($1.25/$4.25)', updated: '2026-11-17', released: '2026-04-08', },
  'infinity':          { input: 1,   output: 4,   cacheRead: 0.25, currency: 'USD', source: '图中模型，官网未查到价，估算待校正', updated: '2026-11-17', estimated: true, released: '2026-09', },
  'command-a':         { input: 2.5, output: 10,  cacheRead: 0.625,currency: 'USD', source: 'Cohere Command A 历史档估算，请校正', updated: '2026-11-17', estimated: true, released: '2025-11', },
  'llama-4-scout':     { input: 0.2, output: 0.6, cacheRead: 0.05, currency: 'USD', source: 'Meta Llama 4 Scout 公开档估算', updated: '2026-11-17', estimated: true, released: '2025-04-05', },
  'gemma-4':           { input: 0,   output: 0,   cacheRead: 0,    currency: 'CNY', source: 'Artificial Analysis 榜标注免费(Gemma 4 31B)', updated: '2026-11-17', released: '2026-04-02', },
  'phi-4':             { input: 0.07,output: 0.28,cacheRead: 0.02, currency: 'USD', source: '微软 Phi-4 开源档估算', updated: '2026-11-17', estimated: true, released: '2024-12', },
  'nemotron':          { input: 0.1, output: 0.4, cacheRead: 0.025,currency: 'USD', source: 'NVIDIA Nemotron 开源档估算', updated: '2026-11-17', estimated: true, released: '2025', },

  'gemini-3.7-flash': { input: 1.5, output: 7.5, cacheRead: 0.15, currency: 'USD', source: 'Artificial Analysis 榜单价($1.5/$7.5/命中0.15)', updated: '2026-11-17', released: '2026-08-13', },
  'gemini-3.5-flash': { input: 1.5, output: 9, cacheRead: 0.15, currency: 'USD', source: 'Artificial Analysis 榜单价($1.5/$9/命中0.15)', updated: '2026-11-17', released: '2026-05-19', },
  'gemini-3.1-flash-lite-preview': { input: 0.25, output: 1.5, cacheRead: 0.025, currency: 'USD', source: 'Artificial Analysis 榜单价($0.25/$1.5/命中0.025)', updated: '2026-11-17', released: '2026-03-03', },
  'muse-ember': { input: 0.1, output: 0.5, cacheRead: 0.004, currency: 'USD', source: 'Artificial Analysis 榜单价($0.1/$0.5/命中0.004)', updated: '2026-11-17', released: '2026-11', },
  'muse-spark-1.3': { input: 1.25, output: 4.25, cacheRead: 0.15, currency: 'USD', source: 'Artificial Analysis 榜单价($1.25/$4.25/命中0.15)', updated: '2026-11-17', released: '2026-09', },
  'muse-spark-1.2': { input: 1.25, output: 4.25, cacheRead: 0.15, currency: 'USD', source: 'Artificial Analysis 榜单价($1.25/$4.25/命中0.15)', updated: '2026-11-17', released: '2026-08', },
  'muse-spark-1.1': { input: 1.25, output: 4.25, cacheRead: 0.15, currency: 'USD', source: 'Artificial Analysis 榜单价($1.25/$4.25/命中0.15)', updated: '2026-11-17', released: '2026-07-09', },
  'grok-4.6': { input: 2, output: 6, cacheRead: 0.5, currency: 'USD', source: 'Artificial Analysis 榜单价($2/$6/命中0.5)', updated: '2026-11-17', released: '2026-08-12', },
  'grok-4.5': { input: 2, output: 6, cacheRead: 0.3, currency: 'USD', source: 'Artificial Analysis 榜单价($2/$6/命中0.3)', updated: '2026-11-17', released: '2026-07-08', },
  'grok-4.3': { input: 1.25, output: 2.5, cacheRead: 0.2, currency: 'USD', source: 'Artificial Analysis 榜单价($1.25/$2.5/命中0.2)', updated: '2026-11-17', released: '2026-05-06', },
  'mistral-large-4': { input: 0.7, output: 2.1, cacheRead: 0.07, currency: 'USD', source: 'Artificial Analysis 榜单价($0.7/$2.1/命中0.07)', updated: '2026-11-17', released: '2026-09', },
  'mistral-large-4-preview': { input: 0.7, output: 2.1, cacheRead: 0.07, currency: 'USD', source: 'Artificial Analysis 榜单价($0.7/$2.1/命中0.07)', updated: '2026-11-17', released: '2026-08', },
  'mistral-medium-3.5': { input: 1.5, output: 7.5, cacheRead: 0.15, currency: 'USD', source: 'Artificial Analysis 榜单价($1.5/$7.5/命中0.15)', updated: '2026-11-17', released: '2026-05-22', },
  'gpt-5.4-mini-2026': { input: 0.75, output: 4.5, cacheRead: 0.075, currency: 'USD', source: 'Artificial Analysis 榜单价($0.75/$4.5/命中0.075)', updated: '2026-11-17', released: '2026-03-17', },
  'gpt-5.4-nano-2026': { input: 0.2, output: 1.25, cacheRead: 0.02, currency: 'USD', source: 'Artificial Analysis 榜单价($0.2/$1.25/命中0.02)', updated: '2026-11-17', released: '2026-03-17', },
  'claude-haiku-4.5-20251001': { input: 1, output: 5, cacheRead: 0.1, currency: 'USD', source: 'Artificial Analysis 榜单价($1/$5/命中0.1)', updated: '2026-11-17', released: '2025-10-01', },
  'qwen4-max': { input: 10, output: 30, cacheRead: 0.5, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥10/¥30/命中0.5)', updated: '2026-11-17', released: '2026-11', },
  'qwen3.8-max-0902': { input: 12, output: 36, cacheRead: 1.5, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥12/¥36/命中1.5)', updated: '2026-11-17', released: '2026-09-02', },
  'qwen3.7-max': { input: 12, output: 36, cacheRead: 2.4, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥12/¥36/命中2.4)', updated: '2026-11-17', released: '2026-07', },
  'qwen3.8-flash-next': { input: 0.8, output: 2.7, cacheRead: 0.1, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥0.8/¥2.7/命中0.1)', updated: '2026-11-17', released: '2026-08-26', },
  'qwen3.8-27b': { input: 3, output: 12, cacheRead: 0.6, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥3/¥12/命中0.6)', updated: '2026-11-17', released: '2026-08-14', },
  'qwen3.6-plus': { input: 2, output: 12, cacheRead: 0.2, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥2/¥12/命中0.2)', updated: '2026-11-17', released: '2026-04-02', },
  'qwen3.6-27b': { input: 3, output: 18, cacheRead: 0, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥3/¥18，缓存未列价)', updated: '2026-11-17', released: '2026-04-22', },
  'qwen3.7-plus': { input: 2, output: 8, cacheRead: 0.4, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥2/¥8/命中0.4)', updated: '2026-11-17', released: '2026-07', },
  'qwen3.8-2.4t-a95b': { input: 12, output: 36, cacheRead: 1.5, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥12/¥36/命中1.5)', updated: '2026-11-17', released: '2026-08-14', },
  'inking-2-small': { input: 2, output: 6.67, cacheRead: 0.2, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥2/¥6.67/命中0.2)', updated: '2026-11-17', released: '2026-08', },
  'inking': { input: 6.67, output: 27, cacheRead: 1.13, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥6.67/¥27/命中1.13)', updated: '2026-11-17', released: '2026-05', },
  'inking-small': { input: 2, output: 8, cacheRead: 0.4, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥2/¥8/命中0.4)', updated: '2026-11-17', released: '2026-05', },
  'deepseek-v4-flash-0731': { input: 1.5, output: 4.5, cacheRead: 0.05, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥1.5/¥4.5/命中0.05)', updated: '2026-11-17', released: '2026-07-31', },
  'deepseek-v4-pro-0813': { input: 4.5, output: 13.5, cacheRead: 0.15, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥4.5/¥13.5/命中0.15)', updated: '2026-11-17', released: '2026-08-13', },
  'deepseek-v4-pro-preview': { input: 3, output: 6, cacheRead: 0.025, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥3/¥6/命中0.025)', updated: '2026-11-17', released: '2026-07', },
  'deepseek-v4-flash-preview': { input: 1, output: 2, cacheRead: 0.02, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥1/¥2/命中0.02)', updated: '2026-11-17', released: '2026-07', },
  'minimax-m3': { input: 2.1, output: 8.4, cacheRead: 0.42, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥2.1/¥8.4/命中0.42)', updated: '2026-11-17', released: '2026-06-01', },
  'mimo-v2.6-flash': { input: 1, output: 2, cacheRead: 0.02, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥1/¥2/命中0.02)', updated: '2026-11-17', released: '2026-10', },
  'hy4-preview': { input: 6, output: 18, cacheRead: 0.3, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥6/¥18/命中0.3)', updated: '2026-11-17', released: '2026-08-28', },
  'ling-3.1-flash': { input: 2, output: 6, cacheRead: 0.4, currency: 'CNY', source: 'Artificial Analysis 榜单价(¥2/¥6/命中0.4)', updated: '2026-11-17', released: '2026-07', },

  // ---------- 其他 ----------
  'qwen':         { input: 2.4, output: 9.6, cacheRead: 0.48, currency: 'CNY', source: '阿里云百炼官方', updated: '2026-11-16', released: '2025', },
  'minimax':      { input: 1,   output: 5,   cacheRead: 0.2,  currency: 'CNY', source: '官方', updated: '2026-11-16', released: '2025', },
  'hunyuan':      { input: 4,   output: 16,  cacheRead: 0.8,  currency: 'CNY', source: '腾讯云官方', updated: '2026-11-16', released: '2025', },
  'hy':           { input: 4,   output: 16,  cacheRead: 0.8,  currency: 'CNY', source: '腾讯云官方', updated: '2026-11-16', released: '2025', },
}

/** 默认汇率：1 USD = ? CNY（2026-11-17 实时汇率，可在价格页修改） */
export const DEFAULT_USD_CNY = 6.6793

/** 未知模型兜底价 */
export const FALLBACK_PRICE: Price = {
  input: 2, output: 8, cacheRead: 0.4, currency: 'CNY',
  source: '未匹配到模型，使用兜底价，请在价格页校正', updated: '2026-11-16', estimated: true,
}
