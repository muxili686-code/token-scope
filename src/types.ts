/** 单条token用量记录（统一后的标准结构） */
export interface UsageRecord {
  id: string
  /** 模型原始名，如 claude-opus-4-8 / gpt-5 / doubao-seed-2.0-pro */
  model: string
  /** 归属厂商/平台 */
  vendor: string
  /** 输入token（不含缓存命中） */
  input: number
  /** 输出token */
  output: number
  /** 缓存命中的输入token */
  cacheRead: number
  /** 缓存写入token（Claude写入价1.25x，部分厂商无此项） */
  cacheWrite: number
  /** 推理token（o系列/思考模式，通常并入output计费） */
  reasoning: number
  /** 时间戳（毫秒） */
  ts: number
  /** 会话/工作区标签 */
  tag?: string
  /** 会话ID（用于去重统计会话数） */
  session?: string
  /** 会话中文标题（导入时从首条提问本地识别） */
  sessionTitle?: string
  /** 数据来源 */
  source: DataSource
}

export type DataSource = 'log' | 'bill' | 'api' | 'demo'

/** 价格（每百万token） */
export interface Price {
  /** 输入单价 */
  input: number
  /** 输出单价 */
  output: number
  /** 缓存命中单价 */
  cacheRead: number
  /** 缓存写入单价（默认=input*1.25） */
  cacheWrite?: number
  /** 币种 */
  currency: 'USD' | 'CNY'
  /** 来源（内部维护用，客户界面不显示） */
  source: string
  /** 单价采集日期（内部维护用） */
  updated: string
  /** 模型发布日期（联网核实，展示给客户） */
  released?: string
  /** 是否估算（官网未公开时） */
  estimated?: boolean
}

/** 成本结果 */
export interface Cost {
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  total: number
  currency: 'USD' | 'CNY'
}

/** 聚合到模型维度 */
export interface ModelAgg {
  model: string
  vendor: string
  records: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  totalTokens: number
  costCNY: number
  currency: 'USD' | 'CNY'
  rawCost: number
}

/** 视图枚举 */
export type View = 'analyze' | 'dashboard' | 'estimator' | 'prices'
