/**
 * SSE 自动测试模块
 *
 * 这些场景通过测试页 Vite 服务提供的同源端点验证生产 fetchSSE 的解析、终止、
 * 取消和错误契约。场景结果只保留计数、首尾摘要或错误摘要，不累计完整流
 */

import type { SSEMessage, SSEStream } from '@jl-org/http'
import type { SSETestConfig, TestContext, TestLogEntry, TestModule, TestResult } from '../types'
import { createErrorResult, createHttpInstance, createSuccessResult, createTestLog } from '../utils'

const DONE_SIGNAL = '[DONE]'
const DEFAULT_COUNTER_URL = '/api/sse/counter?max=3&interval=10'
const CANCEL_COUNTER_URL = '/api/sse/counter?max=20&interval=10'
const NON_2XX_URL = '/api/sse/chat'
const INVALID_CONTENT_TYPE_URL = '/api/mock/progress?size=1&chunkSize=1&delay=0'
const DEFAULT_EXPECTED_EVENTS = 3

interface CounterPayload {
  count: number
  max: number
  percentage: number
}

interface ErrorSummary {
  name: string
  message: string
  status?: number
  statusText?: string
  contentType?: string
}

/** SSE 测试模块。 */
export const sseModule: TestModule = {
  id: 'sse',
  name: 'SSE 流式数据',
  description: '使用生产 fetchSSE 验证 SSE 增量解析、结束信号、取消和错误契约',

  scenarios: [
    {
      id: 'default-json',
      name: '默认 JSON 解析与顺序计数',
      description: '验证默认 JSON.parse 逐条解析快速计数流，并保持完整顺序与数量',
      features: ['fetchSSE', '默认 JSON.parse', '事件顺序', '事件计数', 'doneSignal'],
      category: 'sse',
      priority: 1,
    },
    {
      id: 'raw-identity',
      name: '原始数据与结束信号',
      description: '验证 parseData 原样返回每条 data 文本，并由 [DONE] 结束流',
      features: ['parseData', '原文恒等', 'doneSignal', '增量迭代'],
      category: 'sse',
      priority: 1,
    },
    {
      id: 'cancel',
      name: '主动取消停止消费',
      description: '验证首个事件后主动取消不会继续向消费者交付事件',
      features: ['主动取消', 'reader 清理', '消费停止'],
      category: 'sse',
      priority: 1,
    },
    {
      id: 'error-contract',
      name: '错误响应契约',
      description: '验证非 2xx Response 与错误 Content-Type 均能被 fetchSSE 读出并识别',
      features: ['非 2xx', 'status/statusText', 'Content-Type 校验', '错误归一化'],
      category: 'error',
      priority: 2,
    },
  ],

  getDefaultConfig(): SSETestConfig {
    return {
      baseUrl: '',
      url: DEFAULT_COUNTER_URL,
      timeout: 5000,
      expectedEvents: DEFAULT_EXPECTED_EVENTS,
    }
  },

  validateConfig(config: SSETestConfig) {
    return !!(
      typeof config.url === 'string'
      && config.url.trim().length > 0
      && (config.baseUrl === undefined || typeof config.baseUrl === 'string')
      && typeof config.timeout === 'number'
      && Number.isFinite(config.timeout)
      && config.timeout > 0
      && typeof config.expectedEvents === 'number'
      && Number.isInteger(config.expectedEvents)
      && config.expectedEvents > 0
    )
  },

  async execute(context: TestContext): Promise<TestResult> {
    const { scenario, config } = context
    const testConfig = config as SSETestConfig
    const logs: TestLogEntry[] = []
    const startedAt = Date.now()
    const http = createHttpInstance(testConfig)

    try {
      const data = await executeScenario(scenario.id, http, testConfig, logs)
      const duration = Date.now() - startedAt
      logs.push(createTestLog('success', `SSE 场景通过: ${scenario.name}`))
      return createSuccessResult(data, duration, logs, {
        scenario: scenario.id,
      })
    }
    catch (error) {
      const normalized = normalizeError(error)
      const duration = Date.now() - startedAt
      logs.push(createTestLog('error', `SSE 场景失败: ${normalized.message}`))
      return createErrorResult(normalized.message, duration, logs, {
        scenario: scenario.id,
      })
    }
  },
}

async function executeScenario(
  scenarioId: string,
  http: ReturnType<typeof createHttpInstance>,
  config: SSETestConfig,
  logs: TestLogEntry[],
) {
  switch (scenarioId) {
    case 'default-json':
      return testDefaultJson(http, config, logs)
    case 'raw-identity':
      return testRawIdentity(http, config, logs)
    case 'cancel':
      return testCancel(http, logs)
    case 'error-contract':
      return testErrorContract(http, logs)
    default:
      throw new Error(`未知的 SSE 测试场景: ${scenarioId}`)
  }
}

async function testDefaultJson(
  http: ReturnType<typeof createHttpInstance>,
  config: SSETestConfig,
  logs: TestLogEntry[],
) {
  const expectedEvents = config.expectedEvents!
  logs.push(createTestLog('info', `开始默认 JSON 解析: ${config.url}`))

  /** 不传 parseData，直接验证生产 API 的默认 JSON.parse。 */
  const stream = await http.fetchSSE<CounterPayload>(config.url, {
    doneSignal: DONE_SIGNAL,
  })
  const messages = await collectMessages(stream)
  const counts = validateCounterMessages(messages, expectedEvents, '默认 JSON')

  for (const [index, message] of messages.entries()) {
    if (typeof message.data !== 'object' || message.data === null) {
      throw new Error(`默认 JSON 第 ${index + 1} 条事件未解析为对象`)
    }
  }

  logs.push(createTestLog('info', `默认 JSON 解析完成: ${messages.length} 条事件`))
  return {
    endpoint: config.url,
    eventCount: messages.length,
    counts,
    sample: summarizeCounterSamples(messages),
  }
}

async function testRawIdentity(
  http: ReturnType<typeof createHttpInstance>,
  config: SSETestConfig,
  logs: TestLogEntry[],
) {
  const expectedEvents = config.expectedEvents!
  logs.push(createTestLog('info', '开始原始 data 文本与结束信号测试'))

  const stream = await http.fetchSSE<string>(config.url, {
    doneSignal: DONE_SIGNAL,
    parseData: dataText => dataText,
  })
  const messages = await collectMessages(stream)
  const counts: number[] = []

  for (const [index, message] of messages.entries()) {
    if (message.data !== message.dataText) {
      throw new Error(`原始 data 第 ${index + 1} 条事件不是恒等返回`)
    }

    const payload = parseCounterPayload(message.dataText, index, '原始 data')
    validateCounterMessageMetadata(message, payload, index, '原始 data')
    counts.push(payload.count)
  }

  if (messages.length !== expectedEvents) {
    throw new Error(`原始 data 事件数量不正确: 期望 ${expectedEvents}，实际 ${messages.length}`)
  }

  for (const [index, count] of counts.entries()) {
    if (count !== index + 1) {
      throw new Error(`原始 data 事件顺序不正确: 第 ${index + 1} 条 count=${count}`)
    }
  }

  logs.push(createTestLog('info', `原始 data 测试完成: ${messages.length} 条事件，结束信号未交付`))
  return {
    endpoint: config.url,
    eventCount: messages.length,
    counts,
    identity: true,
    sample: messages.slice(0, 2).map(summarizeRawMessage),
  }
}

async function testCancel(
  http: ReturnType<typeof createHttpInstance>,
  logs: TestLogEntry[],
) {
  logs.push(createTestLog('info', `开始主动取消测试: ${CANCEL_COUNTER_URL}`))

  const cancelReason = new Error('SSE test cancelled after first event')
  let stream: SSEStream<CounterPayload> | undefined
  let receivedCount = 0
  let postCancelState: 'done' | 'rejected' = 'done'
  let firstMessage: SSEMessage<CounterPayload> | undefined

  try {
    stream = await http.fetchSSE<CounterPayload>(CANCEL_COUNTER_URL, {
      doneSignal: DONE_SIGNAL,
    })

    const first = await stream.next()
    if (first.done || !first.value) {
      throw new Error('主动取消测试未收到首个事件')
    }

    receivedCount = 1
    firstMessage = first.value
    const firstPayload = validateCounterPayload(first.value.data, 0, '主动取消')
    if (firstPayload.count !== 1) {
      throw new Error(`主动取消首个事件 count 不正确: ${firstPayload.count}`)
    }

    stream.cancel(cancelReason)

    try {
      const afterCancel = await stream.next()
      if (!afterCancel.done) {
        throw new Error(`主动取消后仍收到第 ${firstPayload.count + 1} 条事件`)
      }
    }
    catch (error) {
      if (!isCancellationError(error, cancelReason)) {
        throw error
      }
      postCancelState = 'rejected'
    }

    logs.push(createTestLog('info', `主动取消完成: 取消前 ${receivedCount} 条，之后无事件`))
    return {
      endpoint: CANCEL_COUNTER_URL,
      receivedBeforeCancel: receivedCount,
      receivedAfterCancel: 0,
      postCancelState,
      first: firstMessage
        ? summarizeCounterMessage(firstMessage, firstPayload)
        : undefined,
    }
  }
  finally {
    /** cancel 幂等，确保异常和正常路径都释放 SSE reader。 */
    stream?.cancel(cancelReason)
  }
}

async function testErrorContract(
  http: ReturnType<typeof createHttpInstance>,
  logs: TestLogEntry[],
) {
  logs.push(createTestLog('info', '开始 SSE 错误响应契约测试'))

  const non2xxError = await captureExpectedError(
    () => http.fetchSSE(NON_2XX_URL),
    '非 2xx SSE 请求',
  )
  if (!(non2xxError instanceof Response)) {
    throw new TypeError(`非 2xx 未返回 Response，实际为 ${normalizeError(non2xxError).name}`)
  }

  const non2xx = summarizeError(non2xxError)
  if (non2xx.status !== 405) {
    throw new Error(`非 2xx 状态不正确: 期望 405，实际 ${non2xx.status ?? 'unknown'}`)
  }
  if (typeof non2xx.statusText !== 'string') {
    throw new TypeError('非 2xx Response 缺少 statusText')
  }
  logs.push(createTestLog('info', `非 2xx 已读出: ${non2xx.status} ${non2xx.statusText}`))

  const contentTypeError = await captureExpectedError(
    () => http.fetchSSE(INVALID_CONTENT_TYPE_URL),
    '错误 Content-Type SSE 请求',
  )
  const contentType = summarizeError(contentTypeError)
  if (contentType.name !== 'SSEContentTypeError') {
    throw new Error(`错误 Content-Type 未返回 SSEContentTypeError，实际为 ${contentType.name}`)
  }
  if (contentType.status !== 200) {
    throw new Error(`错误 Content-Type 响应状态不正确: 期望 200，实际 ${contentType.status ?? 'unknown'}`)
  }
  if (!contentType.contentType || contentType.contentType.toLowerCase().startsWith('text/event-stream')) {
    throw new Error(`错误 Content-Type 未被识别: ${contentType.contentType || 'empty'}`)
  }
  if (typeof contentType.statusText !== 'string') {
    throw new TypeError('错误 Content-Type Response 缺少 statusText')
  }
  logs.push(createTestLog('info', `错误 Content-Type 已读出: ${contentType.status} ${contentType.statusText}`))

  return {
    failures: [
      {
        kind: 'non-2xx',
        ...non2xx,
      },
      {
        kind: 'content-type',
        ...contentType,
      },
    ],
  }
}

async function collectMessages<T>(stream: SSEStream<T>): Promise<Array<SSEMessage<T>>> {
  const messages: Array<SSEMessage<T>> = []
  try {
    for await (const message of stream)
      messages.push(message)
    return messages
  }
  finally {
    stream.cancel()
  }
}

function validateCounterMessages(
  messages: Array<SSEMessage<CounterPayload>>,
  expectedEvents: number,
  label: string,
) {
  if (messages.length !== expectedEvents) {
    throw new Error(`${label} 事件数量不正确: 期望 ${expectedEvents}，实际 ${messages.length}`)
  }

  return messages.map((message, index) => {
    const payload = validateCounterPayload(message.data, index, label)
    validateCounterMessageMetadata(message, payload, index, label)
    if (payload.count !== index + 1) {
      throw new Error(`${label} 事件顺序不正确: 第 ${index + 1} 条 count=${payload.count}`)
    }
    if (payload.max !== expectedEvents) {
      throw new Error(`${label} 第 ${index + 1} 条 max 不正确: ${payload.max}`)
    }
    return payload.count
  })
}

function validateCounterMessageMetadata(
  message: SSEMessage<unknown>,
  payload: CounterPayload,
  index: number,
  label: string,
) {
  if (message.event !== 'data') {
    throw new Error(`${label} 第 ${index + 1} 条 event 不正确: ${message.event}`)
  }
  if (message.id !== 'counter') {
    throw new Error(`${label} 第 ${index + 1} 条 id 不正确: ${message.id}`)
  }
  if (message.retry !== 1000) {
    throw new Error(`${label} 第 ${index + 1} 条 retry 不正确: ${message.retry ?? 'undefined'}`)
  }
  if (payload.percentage < 0 || payload.percentage > 100) {
    throw new Error(`${label} 第 ${index + 1} 条 percentage 越界: ${payload.percentage}`)
  }
}

function validateCounterPayload(value: unknown, index: number, label: string): CounterPayload {
  if (!isRecord(value)
    || typeof value.count !== 'number'
    || !Number.isInteger(value.count)
    || typeof value.max !== 'number'
    || !Number.isInteger(value.max)
    || typeof value.percentage !== 'number') {
    throw new Error(`${label} 第 ${index + 1} 条不是有效计数 JSON`)
  }

  return {
    count: value.count,
    max: value.max,
    percentage: value.percentage,
  }
}

function parseCounterPayload(dataText: string, index: number, label: string) {
  try {
    return validateCounterPayload(JSON.parse(dataText), index, label)
  }
  catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} 第 ${index + 1} 条`))
      throw error
    throw new Error(`${label} 第 ${index + 1} 条 data 不是有效 JSON`)
  }
}

function summarizeCounterSamples(messages: Array<SSEMessage<CounterPayload>>) {
  const indexes = messages.length > 1
    ? [0, messages.length - 1]
    : [0]
  return indexes.map(index => summarizeCounterMessage(
    messages[index],
    messages[index].data,
  ))
}

function summarizeCounterMessage(message: SSEMessage<unknown>, payload: CounterPayload) {
  return {
    event: message.event,
    id: message.id,
    count: payload.count,
    max: payload.max,
  }
}

function summarizeRawMessage(message: SSEMessage<string>) {
  return {
    event: message.event,
    id: message.id,
    dataText: message.dataText.slice(0, 160),
    truncated: message.dataText.length > 160,
  }
}

async function captureExpectedError(
  operation: () => Promise<unknown>,
  label: string,
) {
  try {
    await operation()
  }
  catch (error) {
    return error
  }

  throw new Error(`${label} 未按预期失败`)
}

function summarizeError(error: unknown): ErrorSummary {
  if (error instanceof Response) {
    return {
      name: 'Response',
      message: `HTTP ${error.status} ${error.statusText}`.trim(),
      status: error.status,
      statusText: error.statusText,
      contentType: error.headers.get('content-type') || undefined,
    }
  }

  const normalized = normalizeError(error)
  const response = isRecord(error) && error.response instanceof Response
    ? error.response
    : undefined
  return {
    ...normalized,
    status: response?.status ?? normalized.status,
    statusText: response?.statusText ?? normalized.statusText,
    contentType: normalized.contentType
      ?? (response?.headers.get('content-type') || undefined),
  }
}

function normalizeError(error: unknown): ErrorSummary {
  if (error instanceof Response) {
    return summarizeError(error)
  }

  if (error instanceof Error) {
    const candidate = error as Error & {
      contentType?: unknown
      response?: unknown
      status?: unknown
      statusText?: unknown
    }
    const response = candidate.response instanceof Response
      ? candidate.response
      : undefined
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      status: response?.status ?? toNumber(candidate.status),
      statusText: response?.statusText ?? toString(candidate.statusText),
      contentType: toString(candidate.contentType)
        ?? (response?.headers.get('content-type') || undefined),
    }
  }

  if (isRecord(error)) {
    return {
      name: toString(error.name) || 'UnknownError',
      message: toString(error.message) || 'Unknown error',
      status: toNumber(error.status),
      statusText: toString(error.statusText),
      contentType: toString(error.contentType),
    }
  }

  return {
    name: 'UnknownError',
    message: error == null
      ? 'Unknown error'
      : String(error),
  }
}

function isCancellationError(error: unknown, reason: Error) {
  if (error === reason)
    return true

  const normalized = normalizeError(error)
  return normalized.name === 'AbortError'
    || normalized.message.toLowerCase().includes('abort')
    || normalized.message.toLowerCase().includes('cancel')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toString(value: unknown): string | undefined {
  return typeof value === 'string'
    ? value
    : undefined
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number'
    ? value
    : undefined
}
