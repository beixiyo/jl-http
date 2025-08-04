import { SSEStreamProcessor } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const EVENT_KEY = '__internal__event'
const ID_KEY = '__internal__id'
const RETRY_KEY = '__internal__retry'

describe('sSEStreamProcessor', () => {
  let processor: SSEStreamProcessor
  let onMessageSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onMessageSpy = vi.fn()
    processor = new SSEStreamProcessor({
      onMessage: onMessageSpy,
    })
  })

  describe('构造函数', () => {
    it('应该使用默认配置', () => {
      const defaultProcessor = new SSEStreamProcessor()
      expect(defaultProcessor).toBeInstanceOf(SSEStreamProcessor)
    })

    it('应该合并自定义配置', () => {
      const customProcessor = new SSEStreamProcessor({
        needParseData: false,
        separator: '\n',
        dataPrefix: 'event:',
        doneSignal: 'END',
      })
      expect(customProcessor).toBeInstanceOf(SSEStreamProcessor)
    })
  })

  describe('processChunk', () => {
    it('应该处理简单的 SSE 数据', () => {
      const chunk = 'data: {"message": "hello"}\n\n'
      const result = processor.processChunk(chunk)

      expect(result.currentRawPayload).toBe('{"message": "hello"}')
      expect(result.currentJson).toEqual([{ message: 'hello' }])
      expect(result.allRawPayloadsString).toBe('{"message": "hello"}')
      expect(result.isEnd).toBe(false)
      expect(onMessageSpy).toHaveBeenCalledTimes(1)
    })

    it('应该处理多个数据块', () => {
      processor.processChunk('data: {"id": 1}\n\n')
      const result = processor.processChunk('data: {"id": 2}\n\n')

      expect(result.allJson).toHaveLength(2)
      expect(result.allJson[0]).toEqual({ id: 1 })
      expect(result.allJson[1]).toEqual({ id: 2 })
      expect(onMessageSpy).toHaveBeenCalledTimes(2)
    })

    it('应该处理 DONE 信号', () => {
      const result = processor.processChunk('data: [DONE]\n\n')

      expect(result.isEnd).toBe(true)
      expect(result.currentRawPayload).toBe('')
      expect(onMessageSpy).toHaveBeenCalledTimes(0)
    })

    it('应该在流结束后拒绝新数据', () => {
      processor.processChunk('data: [DONE]\n\n')
      const result = processor.processChunk('data: {"new": "data"}\n\n')

      expect(result.currentRawPayload).toBe('')
      expect(result.currentJson).toEqual([])
    })

    it('应该处理非 SSE 模式', () => {
      const nonSSEProcessor = new SSEStreamProcessor({
        needParseData: false,
        onMessage: onMessageSpy,
      })

      const result = nonSSEProcessor.processChunk('{"direct": "json"}')

      expect(result.currentRawPayload).toBe('{"direct": "json"}')
      expect(result.currentJson).toEqual([{ direct: 'json' }])
    })

    it('应该处理 JSON 解析错误', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      processor.processChunk('data: invalid json\n\n')

      expect(consoleSpy).toHaveBeenCalled()
      expect(onMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentContent: 'invalid json',
          currentJson: [],
        }),
      )
    })
  })

  describe('handleRemainingBuffer', () => {
    it('应该在流结束时返回 null', () => {
      processor.processChunk('data: [DONE]\n\n')
      const result = processor.handleRemainingBuffer()

      expect(result).toBeNull()
    })

    it('应该在缓冲区为空时返回 null', () => {
      const result = processor.handleRemainingBuffer()
      expect(result).toBeNull()
    })
  })

  describe('parseSSEPrefix', () => {
    it('应该解析标准 data: 前缀', () => {
      const result = SSEStreamProcessor.parseSSEPrefix({
        content: 'data: hello world',
      })
      expect(result).toBe('hello world')
    })

    it('应该解析无空格的 data: 前缀', () => {
      const result = SSEStreamProcessor.parseSSEPrefix({
        content: 'data:hello',
      })
      expect(result).toBe('hello')
    })

    it('应该处理自定义前缀', () => {
      const result = SSEStreamProcessor.parseSSEPrefix({
        content: 'event: test',
        dataPrefix: 'event:',
      })
      expect(result).toBe('test')
    })

    it('应该返回不匹配前缀的原始内容', () => {
      const result = SSEStreamProcessor.parseSSEPrefix({
        content: 'other: content',
      })
      expect(result).toBe('other: content')
    })

    it('应该处理 trim 选项', () => {
      const result = SSEStreamProcessor.parseSSEPrefix({
        content: 'data: spaced  ',
        trim: false,
      })
      expect(result).toBe('spaced  ')
    })
  })

  describe('parseSSEMessages', () => {
    it('应该解析多个 SSE 消息', () => {
      const content = 'data: message1\n\ndata: message2\n\n'
      const messages: any[] = []

      SSEStreamProcessor.parseSSEMessages({
        content,
        onMessage: data => messages.push(data),
      })

      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('message1')
      expect(messages[1].content).toBe('message2')
    })

    it('应该处理事件名', () => {
      const content = 'event: test\ndata: message\n\n'
      const messages: any[] = []

      SSEStreamProcessor.parseSSEMessages({
        content,
        onMessage: data => messages.push(data),
      })

      expect(messages[0].event).toBe('test')
      expect(messages[0].content).toBe('message')
    })

    it('应该处理事件名、ID 和重试字段', () => {
      const content = 'event: custom-event\nid: msg-123\nretry: 5000\ndata: {"type": "notification"}\n\n'
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })

      const result = processor.processChunk(content)

      expect(result.currentJson).toEqual([{
        type: 'notification',
        [EVENT_KEY]: 'custom-event',
        [ID_KEY]: 'msg-123',
        [RETRY_KEY]: '5000'
      }])
      expect(onMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentJson: [{
            type: 'notification',
            [EVENT_KEY]: 'custom-event',
            [ID_KEY]: 'msg-123',
            [RETRY_KEY]: '5000'
          }]
        })
      )
    })

    it('应该在多个对象中都添加内部字段', () => {
      const content = 'event: batch\nid: batch-001\ndata: [{"item": 1}, {"item": 2}]\n\n'
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })

      const result = processor.processChunk(content)

      expect(result.currentJson).toEqual([
        { item: 1, [EVENT_KEY]: 'batch', [ID_KEY]: 'batch-001' },
        { item: 2, [EVENT_KEY]: 'batch', [ID_KEY]: 'batch-001' }
      ])
    })

    it('应该只在对象类型中添加内部字段，不在数组中添加', () => {
      const content = 'event: test\ndata: "simple string"\n\n'
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })

      const result = processor.processChunk(content)

      // 字符串类型不应该被添加内部字段
      expect(result.currentJson).toEqual(['simple string'])
    })

    it('应该处理缺少某些字段的情况', () => {
      const content = 'event: partial\ndata: {"value": 42}\n\n'
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })

      const result = processor.processChunk(content)

      expect(result.currentJson).toEqual([{
        value: 42,
        [EVENT_KEY]: 'partial'
        // 注意：没有 ID_KEY 和 RETRY_KEY，因为原始消息中没有提供
      }])
    })

    it('应该处理空事件名的情况', () => {
      const content = 'data: {"test": true}\n\n'
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })

      const result = processor.processChunk(content)

      expect(result.currentJson).toEqual([{
        test: true
        // 注意：没有事件名时不会添加 __internal__event 字段
      }])
    })

    it('应该处理多行数据', () => {
      const content = 'data: line1\ndata: line2\n\n'
      const messages: any[] = []

      SSEStreamProcessor.parseSSEMessages({
        content,
        onMessage: data => messages.push(data),
      })

      expect(messages[0].content).toBe('line1line2')
    })

    it('应该处理自定义分隔符', () => {
      const content = 'data: msg1||data: msg2||'
      const messages: any[] = []

      SSEStreamProcessor.parseSSEMessages({
        content,
        separator: '||',
        onMessage: data => messages.push(data),
      })

      expect(messages).toHaveLength(2)
    })

    it('应该忽略无效数据前缀', () => {
      const content = 'invalid: line\ndata: valid\n\n'
      const messages: any[] = []

      SSEStreamProcessor.parseSSEMessages({
        content,
        onMessage: data => messages.push(data),
      })

      expect(messages[0].content).toBe('valid')
    })

    it('应该处理 handleData 函数', () => {
      const content = 'data: test\n\n'
      const messages: any[] = []

      SSEStreamProcessor.parseSSEMessages({
        content,
        handleData: data => data.toUpperCase(),
        onMessage: data => messages.push(data),
      })

      expect(messages[0].content).toBe('TEST')
    })
  })

  describe('边界情况', () => {
    it('应该处理空字符串', () => {
      const result = processor.processChunk('')
      expect(result.currentRawPayload).toBe('')
      expect(result.currentJson).toEqual([])
    })

    it('应该处理只有空白字符的数据', () => {
      const result = processor.processChunk('   \n\n  ')
      expect(result.currentRawPayload).toBe('')
    })

    it('应该处理数组类型的 JSON', () => {
      const chunk = 'data: [{"id": 1}, {"id": 2}]\n\n'
      const result = processor.processChunk(chunk)

      expect(result.currentJson).toEqual([{ id: 1 }, { id: 2 }])
    })

    it('应该冻结返回的 JSON 数组', () => {
      const chunk = 'data: {"test": true}\n\n'
      const result = processor.processChunk(chunk)

      expect(Object.isFrozen(result.currentJson)).toBe(true)
      expect(Object.isFrozen(result.allJson)).toBe(true)
    })
  })
})
