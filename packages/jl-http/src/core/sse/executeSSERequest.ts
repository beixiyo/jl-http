import type { BaseReqConfig, BaseReqConstructorConfig, SSEOptions, SSEReopenOptions } from '../abs/AbsBaseReqType'
import type { ParsedSSEMessage, SSEMessage, SSEStream } from './types'
/**
 * SSE 增量请求执行器
 *
 * 负责请求准备、错误拦截器显式重新建连、reader 生命周期和增量解析。完整事件直接交给
 * AsyncIterator；除当前未完成事件外不保留任何响应历史
 */
import { mergeHeaders } from '@/tools/headers'
import { getReqConfig } from '@/tools/requestPreparation'
import { handleRespErrInterceptor } from '@/tools/responseError'
import { normalizeSSEConfig, resolveInterceptors } from '../requestConfig'
import { SSEParser } from './SSEParser'

/** 创建一次只能消费一次的 SSE 增量流 */
export async function executeSSERequest<T = unknown>(options: ExecuteSSERequestOptions<T>): Promise<SSEStream<T>> {
  const { url, config, defaultConfig } = options
  const formatConfig = normalizeSSEConfig(url, config, defaultConfig)
  const requestConfig: BaseReqConfig = formatConfig
  const fetchOption = defaultConfig.fetchOption || {}
  const { reqInterceptor, respErrInterceptor } = resolveInterceptors(formatConfig, defaultConfig)
  const operationAbort = new AbortController()
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const cancelledReaders = new WeakSet<object>()
  const initialResponse = await openResponse()
  let started = false

  const generator = iterate() as unknown as SSEStream<T>
  generator.cancel = (reason?: unknown) => {
    if (operationAbort.signal.aborted)
      return

    operationAbort.abort(reason)
    if (activeReader) {
      void cancelReader(activeReader, reason)
      return
    }

    if (!started)
      void Promise.resolve(initialResponse.body?.cancel(reason)).catch(() => {})
  }

  return generator

  async function* iterate(): AsyncGenerator<SSEMessage<T>> {
    started = true
    let response = initialResponse

    while (true) {
      try {
        yield* consumeResponse(response)
        return
      }
      catch (error) {
        if (isCancellation(error, formatConfig.signal, operationAbort.signal)) {
          throw resolveCancellationReason(error, formatConfig.signal, operationAbort.signal)
        }

        if (error instanceof SSEDataParseError)
          throw error

        const shouldReopen = await recoverFromError(error, 'stream', response)
        if (!shouldReopen)
          throw error

        response = await openResponse()
      }
    }
  }

  async function* consumeResponse(response: Response): AsyncGenerator<SSEMessage<T>> {
    if (!response.body)
      throw new Error('SSE response body is empty')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parser = new SSEParser({
      dataPrefix: formatConfig.dataPrefix,
      commentPrefix: formatConfig.commentPrefix,
      eventPrefix: formatConfig.eventPrefix,
      idPrefix: formatConfig.idPrefix,
      retryPrefix: formatConfig.retryPrefix,
      separator: formatConfig.separator,
      doneSignal: formatConfig.doneSignal,
      isDone: formatConfig.isDone,
      maxBufferSize: formatConfig.maxBufferSize,
      onComment: formatConfig.onComment,
      matchField: formatConfig.matchField,
    })
    const signal = combineSignals(formatConfig.signal, operationAbort.signal)
    const cancelOnAbort = () => void cancelReader(reader, signal.reason)
    let completed = false
    activeReader = reader
    signal.addEventListener('abort', cancelOnAbort, { once: true })

    try {
      while (true) {
        signal.throwIfAborted()
        const { done, value } = await reader.read()
        signal.throwIfAborted()

        if (done) {
          const remainingText = decoder.decode()
          if (remainingText) {
            const ended = yield* processTextChunk(remainingText)
            if (ended) {
              completed = true
              return
            }
          }

          parser.finish()
          completed = true
          return
        }

        if (value.byteLength > 0)
          formatConfig.onActivity?.({ byteLength: value.byteLength })

        const ended = yield* processTextChunk(decoder.decode(value, { stream: true }))
        if (ended) {
          completed = true
          await cancelReader(reader)
          return
        }
      }
    }
    finally {
      signal.removeEventListener('abort', cancelOnAbort)
      if (!completed)
        await cancelReader(reader)
      if (activeReader === reader)
        activeReader = undefined
      reader.releaseLock?.()
    }

    async function* processTextChunk(text: string): AsyncGenerator<SSEMessage<T>, boolean> {
      for (const output of parser.processChunk(text)) {
        if (output.type === 'done')
          return true

        const message = await transformMessage(output.message)
        /** 同一 chunk 可能含多条事件；取消后不再向消费者交付已解析的剩余事件 */
        signal.throwIfAborted()
        yield message
      }

      return false
    }
  }

  /** 释放不再消费的响应体；拦截器已读取时 body 处于锁定状态，忽略即可 */
  function discardResponse(response: Response) {
    void Promise.resolve(response.body?.cancel()).catch(() => {})
  }

  function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>, reason?: unknown) {
    if (cancelledReaders.has(reader))
      return Promise.resolve()

    cancelledReaders.add(reader)
    return Promise.resolve(reader.cancel(reason)).catch(() => {})
  }

  async function transformMessage(message: ParsedSSEMessage): Promise<SSEMessage<T>> {
    try {
      const data = await formatConfig.parseData(message.dataText)

      return {
        ...message,
        data,
      }
    }
    catch (cause) {
      throw new SSEDataParseError(cause)
    }
  }

  async function openResponse(): Promise<Response> {
    while (true) {
      const signal = combineSignals(formatConfig.signal, operationAbort.signal)
      signal.throwIfAborted()

      let preparedRequest: Awaited<ReturnType<typeof prepareRequest>>
      try {
        preparedRequest = await prepareRequest()
      }
      catch (error) {
        if (signal.aborted)
          throw signal.reason
        if (await recoverFromError(error, 'request'))
          continue
        throw error
      }

      let response: Response
      try {
        response = await fetch(preparedRequest.url, {
          ...fetchOption,
          ...preparedRequest.data,
          signal,
        })
      }
      catch (error) {
        if (signal.aborted)
          throw signal.reason
        if (await recoverFromError(error, 'request'))
          continue
        throw error
      }

      if (!response.ok) {
        if (await recoverFromError(response, 'response', response)) {
          discardResponse(response)
          continue
        }
        throw response
      }

      if (formatConfig.validateContentType) {
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.toLowerCase().startsWith('text/event-stream')) {
          const error = new SSEContentTypeError(contentType, response)
          if (await recoverFromError(error, 'response', response)) {
            discardResponse(response)
            continue
          }
          throw error
        }
      }

      return response
    }
  }

  /**
   * 为单次物理请求创建配置快照
   *
   * 请求拦截器只能影响本次连接；跨连接持久化的修改必须通过 `reopen({ request })` 显式声明
   */
  function prepareRequest() {
    const attemptConfig: BaseReqConfig = {
      ...requestConfig,
      headers: mergeHeaders(requestConfig.headers),
      query: requestConfig.query
        ? { ...requestConfig.query }
        : undefined,
    }

    return getReqConfig(
      attemptConfig,
      reqInterceptor,
      attemptConfig.method ?? formatConfig.method,
      attemptConfig.url,
    )
  }

  async function recoverFromError(error: unknown, phase: SSEErrorPhase, rawResp?: Response) {
    let reopenRequested = false
    await handleRespErrInterceptor(
      {
        error,
        rawResp,
        request: requestConfig,
        transport: 'sse',
        phase,
        reopen: async (options) => {
          applyReopenOptions(requestConfig, options)
          reopenRequested = true
        },
      },
      respErrInterceptor,
    )

    return reopenRequested
  }
}

/** 把显式覆盖应用到同一逻辑流的稳定请求对象。 */
function applyReopenOptions(request: BaseReqConfig, options?: SSEReopenOptions) {
  const overrides = options?.request
  if (!overrides)
    return

  const { headers, query, ...otherOverrides } = overrides
  Object.assign(
    request,
    Object.fromEntries(
      Object.entries(otherOverrides).filter(([, value]) => value !== undefined),
    ),
  )

  if (headers !== undefined)
    request.headers = mergeHeaders(request.headers, headers)

  if (query !== undefined) {
    request.query = {
      ...request.query,
      ...query,
    }
  }
}

function combineSignals(externalSignal: AbortSignal | null | undefined, operationSignal: AbortSignal) {
  return externalSignal
    ? AbortSignal.any([externalSignal, operationSignal])
    : operationSignal
}

function isCancellation(error: unknown, externalSignal: AbortSignal | null | undefined, operationSignal: AbortSignal) {
  return operationSignal.aborted || externalSignal?.aborted || error === operationSignal.reason || error === externalSignal?.reason
}

function resolveCancellationReason(error: unknown, externalSignal: AbortSignal | null | undefined, operationSignal: AbortSignal) {
  if (operationSignal.aborted)
    return operationSignal.reason
  if (externalSignal?.aborted)
    return externalSignal.reason
  return error
}

/** `parseData` 无法转换一条已经完整提交的 SSE 数据事件。 */
export class SSEDataParseError extends Error {
  override readonly name = 'SSEDataParseError'

  constructor(override readonly cause: unknown) {
    super('Failed to parse SSE event data', { cause })
  }
}

/** 成功响应不是 `text/event-stream`。 */
export class SSEContentTypeError extends Error {
  override readonly name = 'SSEContentTypeError'

  constructor(readonly contentType: string, readonly response: Response) {
    super(`Expected text/event-stream response, received ${contentType || 'an empty Content-Type'}`)
  }
}

/** SSE 请求执行器依赖。 */
export interface ExecuteSSERequestOptions<T> {
  /** 请求 URL，可为相对地址。 */
  url: string
  /** 请求、解析和传输选项。 */
  config?: SSEOptions<T>
  /** BaseReq 实例级默认配置。 */
  defaultConfig: BaseReqConstructorConfig
}

/** SSE 物理请求失败阶段。 */
type SSEErrorPhase = 'request' | 'response' | 'stream'
