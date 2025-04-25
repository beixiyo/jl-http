import type { SSEData } from '@/types'

/**
 * 用于处理数据流（支持 SSE 和 JSON 解析配置）
 */
export class SSEStreamProcessor {
  /** 配置 */
  private readonly config: Required<SSEStreamProcessorConfig>
  /** 内部状态 */
  private buffer: string = ''
  private allJsonObjects: any[] = []
  /** 重要：此列表仅存储成功解析为 JSON 的原始字符串，用于构建最终的 JSON 数组字符串 */
  private successfullyParsedRawJson: string[] = []
  private allRawPayloadsString: string = '' // 所有处理过的载荷/块的拼接
  private isEnd: boolean = false

  /**
   * 创建 StreamProcessor 实例
   * @param config 处理器的配置选项
   */
  constructor(config: SSEStreamProcessorConfig = {}) {
    const defaultConfig: Required<SSEStreamProcessorConfig> = {
      needParseData: true,
      needParseJSON: true,
      separator: '\n\n',
      dataPrefix: 'data:',
      doneSignal: '[DONE]',
      onMessage: () => { },
    }

    this.config = {
      ...defaultConfig,
      ...config,
    }
  }

  /**
   * 处理传入的数据块。
   * 如果处理块产生了有效数据，则会触发 onMessage 回调。
   * @param chunk 新的数据块
   * @returns 当前步骤的处理结果
   */
  processChunk(chunk: string): ProcessChunkResult {
    /** 如果流已结束，则不再处理新块 */
    if (this.isEnd) {
      console.warn('流已结束')
      return this.getCurrentStateAsResult('', []) // 返回最终状态
    }

    this.buffer += chunk

    let currentRawPayload = '' // 当前块处理出的原始字符串
    let parsedObjects: any[] = [] // 当前块解析出的 JSON 对象
    let rawJsonPayloads: string[] = []// 当前块的原始 JSON 字符串载荷 (来自 parseBufferSSE)
    let streamEndedThisChunk = false // 标记本轮是否遇到了 DONE 信号

    if (this.config.needParseData) {
      // --- SSE 解析模式 ---
      const result = this.parseBufferSSE() // parseBufferSSE 内部会处理 successfullyParsedRawJson
      parsedObjects = result.parsedObjects
      rawJsonPayloads = result.rawJsonPayloads // 获取本轮解析出的原始载荷
      streamEndedThisChunk = result.streamEnded
      this.buffer = result.remainingBuffer // 更新剩余缓冲区

      this.isEnd = this.isEnd || streamEndedThisChunk // 更新全局结束状态
      currentRawPayload = rawJsonPayloads.join('') // 拼接本轮的原始载荷
    }
    else {
      // --- 非 SSE 解析模式 ---
      currentRawPayload = chunk // 整个块视为原始载荷

      /** 检查是否为 DONE 信号 (即使非 SSE 模式也可能遇到) */
      if (chunk.trim() === this.config.doneSignal) {
        streamEndedThisChunk = true
        this.isEnd = true
      }
      else if (this.config.needParseJSON && currentRawPayload.trim()) {
        /** 尝试解析非 SSE 块为 JSON */
        try {
          const potentialJson = currentRawPayload.trim()
          /** 基本检查是否像 JSON */
          if ((potentialJson.startsWith('{') && potentialJson.endsWith('}')) || (potentialJson.startsWith('[') && potentialJson.endsWith(']'))) {
            const parsed = JSON.parse(potentialJson)
            const itemsToAdd = Array.isArray(parsed)
              ? parsed
              : [parsed]
            parsedObjects.push(...itemsToAdd)
            /** 非 SSE 模式下，如果解析成功，也加入成功列表 */
            this.successfullyParsedRawJson.push(potentialJson)
          }
        }
        catch (error) {
          console.error(`非 SSE 模式 JSON 解析失败: "${currentRawPayload.substring(0, 100)}..."`, error)
        }
      }
    }

    // --- 更新累积状态 & 触发回调 (如果需要) ---
    const hasNewContent = currentRawPayload.length > 0 || parsedObjects.length > 0

    if (hasNewContent) {
      /** 更新累积状态 */
      this.allRawPayloadsString += currentRawPayload
      this.allJsonObjects.push(...parsedObjects)
      /** 注意：successfullyParsedRawJson 已在 parseBufferSSE 或上面非 SSE 解析成功时更新 */

      /** 触发回调 */
      this.config.onMessage({
        currentContent: currentRawPayload,
        currentJson: Object.freeze([...parsedObjects]), // 传递不可变副本
        allContent: this.allRawPayloadsString,
        allJson: Object.freeze([...this.allJsonObjects]), // 传递不可变副本
      })
    }
    else if (streamEndedThisChunk && !this.isEnd) {
      /** 如果本轮只有被忽略的 DONE 信号，确保 isEnd 状态被正确设置 */
      this.isEnd = true
    }

    return this.getCurrentStateAsResult(currentRawPayload, parsedObjects)
  }

  /**
   * 处理流结束后缓冲区中可能剩余的数据。
   * 如果处理产生了有效数据，则会触发 onMessage 回调。
   * @returns 如果有剩余数据被处理，返回该部分的处理结果，否则返回 null
   */
  handleRemainingBuffer(): ProcessChunkResult | null {
    if ((this.isEnd) || this.buffer.trim() === '') {
      return null // 流已结束或缓冲区为空
    }

    const remainingChunk = this.buffer
    this.buffer = '' // 清空缓冲区

    console.warn('警告：处理剩余缓冲区内容:', JSON.stringify(`${remainingChunk.substring(0, 100)}...`))

    let currentRawPayload = ''
    const parsedObjects: any[] = []
    let streamEndedInRemainder = false

    // --- 直接处理 remainingChunk ---
    let processedPayload = '' // 存储从 remainingChunk 提取的有效载荷

    if (this.config.needParseData) {
      /** 尝试像处理 SSE 消息一样处理剩余部分 (简化处理) */
      let payloadPart = ''
      const lines = remainingChunk.split('\n')
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith(this.config.dataPrefix)) {
          const prefixLength = trimmedLine.startsWith(`${this.config.dataPrefix} `)
            ? this.config.dataPrefix.length + 1
            : this.config.dataPrefix.length
          const payload = trimmedLine.substring(prefixLength).trim()

          if (payload === this.config.doneSignal) {
            streamEndedInRemainder = true
          }
          payloadPart += payload
        }
      }
      processedPayload = payloadPart.trim()
    }
    else {
      /** 非 SSE 模式，整个剩余部分是载荷 */
      processedPayload = remainingChunk
      if (processedPayload.trim() === this.config.doneSignal) {
        streamEndedInRemainder = true
      }
    }

    /** 尝试解析处理后的载荷 */
    if (processedPayload) {
      currentRawPayload = processedPayload // 这是从剩余缓冲区提取的原始字符串
      if (this.config.needParseJSON) {
        try {
          const parsed = JSON.parse(processedPayload)
          const itemsToAdd = Array.isArray(parsed)
            ? parsed
            : [parsed]
          parsedObjects.push(...itemsToAdd)
          /** 如果成功解析，加入成功列表 */
          this.successfullyParsedRawJson.push(processedPayload)
        }
        catch (error) {
          console.error(`处理剩余缓冲区 JSON 解析失败: "${processedPayload.substring(0, 100)}..."`, error)
        }
      }
    }

    if (streamEndedInRemainder) {
      this.isEnd = true
    }

    // --- 更新状态并触发回调 (如果处理了有效内容) ---
    const hasNewContent = currentRawPayload.length > 0 || parsedObjects.length > 0

    if (hasNewContent) {
      console.log('处理剩余缓冲区数据...')
      this.allRawPayloadsString += currentRawPayload
      this.allJsonObjects.push(...parsedObjects)
      // successfullyParsedRawJson 已在上面解析成功时更新

      this.config.onMessage({
        currentContent: currentRawPayload,
        currentJson: Object.freeze([...parsedObjects]),
        allContent: this.allRawPayloadsString,
        allJson: Object.freeze([...this.allJsonObjects]),
      })

      return this.getCurrentStateAsResult(currentRawPayload, parsedObjects)
    }
    else if (streamEndedInRemainder && !this.isEnd) {
      /** 如果只有 DONE 信号，确保 isEnd 更新 */
      this.isEnd = true
    }

    return null // 没有处理任何有效内容
  }

  /**
   * 获取最终的处理结果汇总。
   * @returns 最终结果对象
   */
  getFinalResult(): Omit<ProcessChunkResult, 'currentRawPayload' | 'currentJson'> & { finalJsonArrayString?: string } {
    /** 确保处理任何剩余缓冲区 */
    this.handleRemainingBuffer()

    const finalResult: any = {
      allRawPayloadsString: this.allRawPayloadsString,
      allJson: Object.freeze([...this.allJsonObjects]),
      isEnd: this.isEnd,
    }

    /** 仅在需要解析 JSON 时尝试构建最终数组字符串 */
    if (this.config.needParseJSON) {
      /** 使用 successfullyParsedRawJson 构建，确保每个元素都是有效的 JSON 字符串 */
      if (this.successfullyParsedRawJson.length > 0) {
        const finalJsonArrayString = `[${this.successfullyParsedRawJson.join(',')}]`
        finalResult.finalJsonArrayString = finalJsonArrayString
        /** 验证最终字符串是否是有效的 JSON */
        try {
          JSON.parse(finalJsonArrayString)
        }
        catch (e: any) {
          console.error('错误：最终构建的 JSON 数组字符串无效:', e.message, finalJsonArrayString)
        }
      }
      else {
        /** 如果没有成功解析的 JSON，则返回空数组字符串 */
        finalResult.finalJsonArrayString = '[]'
      }
    }

    return finalResult
  }

  // --- 内部辅助方法 ---

  /**
   * (内部使用) 解析当前缓冲区，提取 SSE 消息。
   * 会更新 this.successfullyParsedRawJson 列表。
   * @returns 解析结果和剩余缓冲区
   */
  private parseBufferSSE(): InternalParseResult {
    const parsedObjects: any[] = []
    const rawJsonPayloads: string[] = [] // 存储本轮解析出的所有原始载荷
    let remainingBuffer = this.buffer
    let streamEnded = false
    const { separator, dataPrefix, doneSignal, needParseJSON } = this.config

    while (true) {
      const separatorIndex = remainingBuffer.indexOf(separator)
      if (separatorIndex === -1)
        break // 没有完整消息了

      const messageBlock = remainingBuffer.substring(0, separatorIndex)
      remainingBuffer = remainingBuffer.substring(separatorIndex + separator.length)

      const lines = messageBlock.split('\n')
      let currentPayload = '' // 用于拼接当前消息块内的多行 data

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith(dataPrefix)) {
          const prefixLength = trimmedLine.startsWith(`${dataPrefix} `)
            ? dataPrefix.length + 1
            : dataPrefix.length
          const payload = trimmedLine.substring(prefixLength).trim()

          if (payload === doneSignal) {
            streamEnded = true
          }
          currentPayload += payload // 拼接载荷
        }
      }

      /** 处理拼接好的当前消息块载荷 */
      const finalPayloadForBlock = currentPayload.trim()

      if (finalPayloadForBlock) {
        rawJsonPayloads.push(finalPayloadForBlock) // 存储本轮原始载荷

        if (needParseJSON) {
          try {
            const parsed = JSON.parse(finalPayloadForBlock)
            const itemsToAdd = Array.isArray(parsed)
              ? parsed
              : [parsed] // 处理载荷本身是数组的情况
            parsedObjects.push(...itemsToAdd)
            // *** 关键：只有成功解析，才将原始字符串加入用于最终数组构建的列表 ***
            this.successfullyParsedRawJson.push(finalPayloadForBlock)
          }
          catch (error) {
            console.error(`SSE JSON 解析失败: "${finalPayloadForBlock.substring(0, 100)}..."`, error)
            /** 解析失败，不添加到 successfullyParsedRawJson */
          }
        }
      }
    } // while 结束

    return {
      parsedObjects,
      rawJsonPayloads, // 返回本轮解析的所有原始载荷
      streamEnded,
      remainingBuffer,
    }
  }

  /**
   * (内部使用) 根据当前状态生成 ProcessChunkResult。
   */
  private getCurrentStateAsResult(
    currentRawPayload: string,
    currentJson: any[] = [],
  ): ProcessChunkResult {
    return {
      currentRawPayload,
      allRawPayloadsString: this.allRawPayloadsString,
      currentJson: Object.freeze([...currentJson]), // 返回只读副本
      allJson: Object.freeze([...this.allJsonObjects]), // 返回只读副本
      isEnd: this.isEnd,
    }
  }
}


export interface SSEStreamProcessorConfig {
  /**
   * 是否按 SSE 格式解析数据，删除以 `data:` 开头等处理
   * @default true
   */
  needParseData?: boolean
  /**
   * 是否尝试将提取的数据解析为 JSON
   * @default true
   */
  needParseJSON?: boolean
  /**
   * SSE 消息分隔符 (needParseData=true 时有效)
   * @default '\n\n'
   */
  separator?: string
  /**
   * SSE 数据负载的前缀 (needParseData=true 时有效)
   * @default 'data:'
   */
  dataPrefix?: string
  /**
   * SSE 流结束信号负载 (needParseData=true 时有效)
   * @default '[DONE]'
   */
  doneSignal?: string
  /**
   * 消息回调函数，在处理完包含有效数据的块或剩余缓冲区后触发。
   */
  onMessage?: (data: SSEData) => void
}

/**
 * processChunk / handleRemainingBuffer 方法的处理结果
 */
interface ProcessChunkResult {
  /** 当前处理块/缓冲区中提取出的原始有效载荷字符串 */
  currentRawPayload: string
  /** 累积的所有原始有效载荷字符串 */
  allRawPayloadsString: string
  /** 当前处理块/缓冲区解析出的 JSON 对象数组 (只读) */
  currentJson: readonly any[]
  /** 累积的所有 JSON 对象数组 (只读) */
  allJson: ReadonlyArray<any>
  /** 流是否已结束的标志 */
  isEnd: boolean
}

/**
 * (内部使用) parseBufferSSE 方法的返回结果
 */
interface InternalParseResult {
  remainingBuffer: string
  parsedObjects: any[]
  /** 存储当前轮次解析出的所有原始载荷字符串 */
  rawJsonPayloads: string[]
  /** 标记在本轮解析中是否遇到了结束信号 */
  streamEnded: boolean
}
