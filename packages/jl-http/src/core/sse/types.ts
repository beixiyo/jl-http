/**
 * SSE 增量流的公共类型
 *
 * 通用层只描述当前已完成事件和当前连接，不提供任何累计历史视图
 */

/** 一条已经由空行完整终止的 SSE 数据事件。 */
export interface SSEMessage<T = unknown> {
  /** 调用方通过 `parseData` 得到的当前事件数据。 */
  data: T
  /** 当前事件全部 `data` 字段按换行符连接后的文本。 */
  dataText: string
  /** 当前事件类型；服务端未声明时为 `message`。 */
  event: string
  /** 当前有效的 Last-Event-ID；可能继承自更早的事件。 */
  id: string
  /** 服务端最近声明的重连等待时间，单位毫秒。 */
  retry?: number
}

/**
 * 单次 SSE 逻辑请求的增量流
 *
 * 流只能消费一次。提前退出 `for await` 会取消当前响应体；解析、网络和协议错误会从
 * `next()` 抛出，不会被转换成正常 EOF
 */
export interface SSEStream<T = unknown> extends AsyncIterableIterator<SSEMessage<T>> {
  /** 幂等取消当前请求以及错误拦截器显式触发的后续重新建连。 */
  cancel: (reason?: unknown) => void
  /**
   * 按传输 chunk 批量消费同一条流
   *
   * 一次底层读取解析出的全部完整事件作为一个数组一次性交付，消费者可以在一个同步
   * 任务里处理整批，渲染层只需为每个网络包更新一次。逐条 `for await` 会把同一个包拆成
   * 多个微任务，高频流下会把宏任务队列（渲染、定时器）饿死
   *
   * 只含注释或未完成事件的 chunk 不产生空数组。与逐条迭代互斥：任一方式开始消费后再
   * 使用另一方式会抛错。提前退出和 `cancel` 语义与逐条迭代一致
   */
  batches: () => AsyncIterableIterator<SSEMessage<T>[]>
}

/** 单次底层读取产生的传输活动。 */
export interface SSETransportActivity {
  /** 本次读取收到的原始字节数。 */
  byteLength: number
}

/** 解析器已完成但尚未经过业务 `parseData` 的事件。 */
export type ParsedSSEMessage = SSEMessage<string>

/** 解析器输出；结束载荷只终止物理流，不作为数据事件交给调用方。 */
export type SSEParserOutput =
  | {
    type: 'message'
    message: ParsedSSEMessage
  }
  | {
    type: 'done'
  }
