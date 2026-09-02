/**
 * 标准 SSE 文本的单遍增量解析器
 *
 * 解析器只保存当前尚未被空行完整终止的事件。已经提交的事件会立即释放，不保存原始
 * 历史、JSON 历史或累计内容
 */
import type { ParsedSSEMessage, SSEParserOutput } from './types'

const DEFAULT_DATA_PREFIX = 'data:'
const DEFAULT_COMMENT_PREFIX = ':'
const DEFAULT_EVENT_PREFIX = 'event:'
const DEFAULT_ID_PREFIX = 'id:'
const DEFAULT_RETRY_PREFIX = 'retry:'
const STANDARD_SSE_EVENT_BOUNDARY = Symbol('standard SSE event boundary')

export class SSEParser {
  private readonly config: NormalizedSSEParserOptions

  private dataLines: string[] = []
  private eventType = ''
  private lastEventId = ''
  private retry: number | undefined
  private lineFragments: string[] = []
  private separatedEventBuffer = ''
  private bufferedSize = 0
  private skipLeadingLF = false
  private isFirstChunk = true
  private finished = false

  /**
   * 创建标准 SSE 解析器
   *
   * 所有选项都可省略；省略或显式传入 `undefined` 时使用对应的标准 SSE 语义
   * @param options 字段前缀、结束载荷和未完成事件缓冲限制
   */
  constructor(options: SSEParserOptions = {}) {
    this.config = {
      dataPrefix: options.dataPrefix ?? DEFAULT_DATA_PREFIX,
      commentPrefix: options.commentPrefix ?? DEFAULT_COMMENT_PREFIX,
      eventPrefix: options.eventPrefix ?? DEFAULT_EVENT_PREFIX,
      idPrefix: options.idPrefix ?? DEFAULT_ID_PREFIX,
      retryPrefix: options.retryPrefix ?? DEFAULT_RETRY_PREFIX,
      separator: options.separator || STANDARD_SSE_EVENT_BOUNDARY,
      doneSignal: options.doneSignal,
      isDone: options.isDone,
      maxBufferSize: options.maxBufferSize,
      onComment: options.onComment ?? (() => {}),
      matchField: options.matchField,
    }
  }

  /**
   * 增量解析一个已经按 UTF-8 解码的文本块
   *
   * 返回 generator 是为了在一个传输 chunk 含有大量事件时逐条交回控制权，避免先把
   * 整个 chunk 转成事件数组。产出 `done` 或调用 `finish()` 之后，解析器进入终止态，
   * 后续输入会被忽略
   */
  * processChunk(chunk: string): Generator<SSEParserOutput> {
    if (this.finished)
      return

    const currentChunk = this.stripLeadingBOM(chunk)

    if (this.config.separator !== STANDARD_SSE_EVENT_BOUNDARY) {
      yield* this.processSeparatedChunk(currentChunk, this.config.separator)
      return
    }

    let segmentStart = 0

    for (let index = 0; index < currentChunk.length; index++) {
      const char = currentChunk[index]

      if (this.skipLeadingLF) {
        this.skipLeadingLF = false
        if (char === '\n') {
          segmentStart = index + 1
          continue
        }
      }

      if (char !== '\r' && char !== '\n')
        continue

      this.appendLineFragment(currentChunk.slice(segmentStart, index))
      const output = this.processCompleteLine()
      if (output)
        yield output
      if (this.finished)
        return

      this.skipLeadingLF = char === '\r'
      segmentStart = index + 1
    }

    this.appendLineFragment(currentChunk.slice(segmentStart))
  }

  /**
   * 结束输入并丢弃未被事件边界终止的数据
   *
   * WHATWG SSE 规定 EOF 不提交未完成事件，因此这里不会返回数据
   */
  finish() {
    this.finished = true
    this.clearPendingEvent()
    this.lineFragments = []
    this.separatedEventBuffer = ''
    this.bufferedSize = 0
    this.skipLeadingLF = false
  }

  /** 使用调用方提供的精确分隔符解析非标准事件流。 */
  private* processSeparatedChunk(chunk: string, separator: string): Generator<SSEParserOutput> {
    this.separatedEventBuffer += chunk

    while (true) {
      const separatorIndex = this.separatedEventBuffer.indexOf(separator)
      if (separatorIndex === -1)
        break

      const eventBlock = this.separatedEventBuffer.slice(0, separatorIndex)
      this.separatedEventBuffer = this.separatedEventBuffer.slice(separatorIndex + separator.length)
      this.assertSeparatedBufferLimit(eventBlock.length)

      this.bufferedSize = 0
      for (const line of splitLines(eventBlock))
        this.processFieldLine(line)

      const output = this.dispatchEvent()
      if (output)
        yield output
      if (this.finished)
        return
    }

    this.bufferedSize = this.separatedEventBuffer.length
    this.assertBufferLimit()
  }

  private appendLineFragment(fragment: string) {
    if (fragment === '')
      return

    this.lineFragments.push(fragment)
    this.bufferedSize += fragment.length
    this.assertBufferLimit()
  }

  private processCompleteLine(): SSEParserOutput | undefined {
    const line = this.consumeLine()
    if (line === '')
      return this.dispatchEvent()

    this.processFieldLine(line)
  }

  /** 将一条完整字段行转换为当前事件状态。 */
  private processFieldLine(line: string) {
    const customField = this.config.matchField?.({ line })
    if (customField) {
      this.applyField(customField)
      return
    }

    if (this.config.commentPrefix !== '') {
      const commentField = readPrefixedValue(line, this.config.commentPrefix)
      if (commentField.matched) {
        this.applyField({ type: 'comment', value: commentField.value })
        return
      }
    }

    const dataField = readPrefixedValue(line, this.config.dataPrefix)
    if (dataField.matched) {
      this.applyField({ type: 'data', value: dataField.value })
      return
    }

    const eventField = readPrefixedValue(line, this.config.eventPrefix)
    if (eventField.matched) {
      this.applyField({ type: 'event', value: eventField.value })
      return
    }

    const idField = readPrefixedValue(line, this.config.idPrefix)
    if (idField.matched) {
      this.applyField({ type: 'id', value: idField.value })
      return
    }

    const retryField = readPrefixedValue(line, this.config.retryPrefix)
    if (retryField.matched)
      this.applyField({ type: 'retry', value: retryField.value })
  }

  /** 应用内置或调用方匹配出的字段。 */
  private applyField(field: SSEParserField) {
    if (field.type === 'ignore')
      return

    if (field.type === 'comment') {
      this.config.onComment(field.value)
      return
    }

    if (field.type === 'data') {
      if (this.dataLines.length > 0)
        this.bufferedSize++
      this.dataLines.push(field.value)
      this.bufferedSize += field.value.length
      this.assertBufferLimit()
      return
    }

    if (field.type === 'event') {
      this.bufferedSize -= this.eventType.length
      this.eventType = field.value
      this.bufferedSize += field.value.length
      this.assertBufferLimit()
      return
    }

    if (field.type === 'id') {
      if (!field.value.includes('\0'))
        this.lastEventId = field.value
      return
    }

    if (field.type === 'retry' && /^\d+$/.test(field.value))
      this.retry = Number(field.value)
  }

  private dispatchEvent(): SSEParserOutput | undefined {
    const dataText = this.dataLines.join('\n')
    const hasData = this.dataLines.length > 0
    const event = this.eventType || 'message'

    this.clearPendingEvent()
    if (!hasData)
      return

    const message: ParsedSSEMessage = {
      data: dataText,
      dataText,
      event,
      id: this.lastEventId,
      retry: this.retry,
    }

    if (
      (this.config.doneSignal !== undefined && dataText === this.config.doneSignal)
      || this.config.isDone?.(message)
    ) {
      this.finished = true
      return {
        type: 'done',
      }
    }

    return {
      type: 'message',
      message,
    }
  }

  private consumeLine() {
    const line = this.lineFragments.length === 0
      ? ''
      : this.lineFragments.length === 1
        ? this.lineFragments[0]
        : this.lineFragments.join('')

    this.lineFragments = []
    this.bufferedSize -= line.length
    return line
  }

  private clearPendingEvent() {
    this.dataLines = []
    this.eventType = ''
    this.bufferedSize = 0
  }

  private assertBufferLimit() {
    const { maxBufferSize } = this.config
    if (maxBufferSize === undefined || this.bufferedSize <= maxBufferSize)
      return

    throw new SSEBufferLimitError(maxBufferSize)
  }

  private assertSeparatedBufferLimit(size: number) {
    const { maxBufferSize } = this.config
    if (maxBufferSize === undefined || size <= maxBufferSize)
      return

    throw new SSEBufferLimitError(maxBufferSize)
  }

  private stripLeadingBOM(chunk: string) {
    if (!this.isFirstChunk || chunk === '')
      return chunk

    this.isFirstChunk = false
    return chunk.startsWith('\uFEFF')
      ? chunk.slice(1)
      : chunk
  }
}

/** 当前未完成 SSE 事件超过调用方上限。 */
export class SSEBufferLimitError extends Error {
  override readonly name = 'SSEBufferLimitError'

  constructor(readonly maxBufferSize: number) {
    super(`SSE incomplete event exceeded maxBufferSize (${maxBufferSize})`)
  }
}

function readPrefixedValue(line: string, prefix: string) {
  if (line.startsWith(prefix)) {
    return {
      matched: true,
      value: removeOptionalLeadingSpace(line.slice(prefix.length)),
    }
  }

  if (prefix.endsWith(':') && line === prefix.slice(0, -1)) {
    return {
      matched: true,
      value: '',
    }
  }

  return {
    matched: false,
    value: '',
  }
}

function splitLines(content: string) {
  return content.split(/\r\n|\r|\n/)
}

function removeOptionalLeadingSpace(value: string) {
  return value.startsWith(' ')
    ? value.slice(1)
    : value
}

/** 标准 SSE 增量解析选项。 */
export interface SSEParserOptions {
  /**
   * 数据字段前缀
   * @default 'data:'
   */
  dataPrefix?: string
  /**
   * 注释行前缀
   *
   * 传入空字符串可禁用内置注释匹配；仍可通过 `matchField` 自行处理注释
   * @default ':'
   */
  commentPrefix?: string
  /**
   * 事件类型字段前缀
   * @default 'event:'
   */
  eventPrefix?: string
  /**
   * Last-Event-ID 字段前缀
   * @default 'id:'
   */
  idPrefix?: string
  /**
   * 重连等待时间字段前缀
   * @default 'retry:'
   */
  retryPrefix?: string
  /**
   * 非标准事件流使用的精确事件分隔符
   *
   * 省略或传入空字符串时遵循 SSE 标准：LF、CRLF 或 CR 组成的空行都会提交事件
   * 传入非空字符串后只按该字符串提交事件，并能识别跨 chunk 的分隔符。例如
   * `\n\n` 或 `<END>`
   * @default 标准 SSE 空行
   */
  separator?: string
  /**
   * 非标准的流结束数据；省略时所有完整 data 事件都会正常产出
   * @default 不设置结束载荷；SSE 标准没有结束载荷
   */
  doneSignal?: string
  /**
   * 自定义结束判断
   *
   * 每个完整 data 事件提交后调用；返回 true 时产出 `done` 而非该消息。它与
   * `doneSignal` 是“或”关系，适合按 event、id 或复合载荷判断结束
   * @default 始终为 false；只由连接 EOF 结束
   */
  isDone?: (message: ParsedSSEMessage) => boolean
  /**
   * 当前尚未由空行提交的事件最多允许保存的 UTF-16 code unit 数量
   *
   * 该限制只约束单个未完成事件，不限制整个响应。计数包含已提交字段的值、
   * 尚未结束的原始行以及行内的字段前缀，例如 `data: 12345` 在行结束前按 11 计算
   * 省略时不设置通用上限
   * @default 不限制
   */
  maxBufferSize?: number
  /**
   * 收到完整注释行时触发
   *
   * 内置前缀规则会移除前缀后的一个可选空格；`matchField` 返回的 comment 值会原样传入
   * @default 空操作
   */
  onComment?: (comment: string) => void
  /**
   * 自定义字段匹配策略
   *
   * 该策略先于内置前缀规则执行。返回字段时直接采用；返回 `undefined` 时继续尝试
   * `commentPrefix`、`dataPrefix`、`eventPrefix`、`idPrefix`、`retryPrefix`；返回
   * `{ type: 'ignore' }` 可阻止内置规则处理当前行
   *
   * 解析器只负责协议字段，不在这里解析 JSON 或累计历史
   * @default 内置标准字段匹配
   */
  matchField?: (context: SSEFieldMatcherContext) => SSEParserField | undefined
}

/** 自定义字段匹配器收到的完整行；不包含换行符。 */
export interface SSEFieldMatcherContext {
  /** 当前已经完整接收的字段行。 */
  line: string
}

/** 自定义字段匹配器可以交给解析器的字段。 */
export type SSEParserField =
  | {
    type: 'data' | 'event' | 'id' | 'retry' | 'comment'
    value: string
  }
  | {
    type: 'ignore'
  }

/** 解析器边界统一归一化后的内部配置。 */
type NormalizedSSEParserOptions = Required<Omit<
  SSEParserOptions,
  'doneSignal' | 'isDone' | 'matchField' | 'maxBufferSize' | 'separator'
>>
& Pick<SSEParserOptions, 'doneSignal' | 'isDone' | 'matchField' | 'maxBufferSize'>
& {
  separator: string | typeof STANDARD_SSE_EVENT_BOUNDARY
}
