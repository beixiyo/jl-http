import { SSEStreamProcessor } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('sSEStreamProcessor Coverage Expansion', () => {
  let onMessageSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onMessageSpy = vi.fn()
  })

  describe('non-SSE Mode', () => {
    it('should handle DONE signal in non-SSE mode', () => {
      const processor = new SSEStreamProcessor({
        needParseData: false,
        onMessage: onMessageSpy,
        doneSignal: '[DONE]',
      })

      const result = processor.processChunk('[DONE]')
      expect(result.isEnd).toBe(true)
      /** 在非 SSE 模式下，[DONE] 也会被视为 content 触发 onMessage */
      expect(onMessageSpy).toHaveBeenCalled()
    })

    it('should handle JSON parsing error in non-SSE mode', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
      const processor = new SSEStreamProcessor({
        needParseData: false,
        onMessage: onMessageSpy,
      })

      /** 满足 startsWith('{') && endsWith('}') 但不是合法 JSON */
      processor.processChunk('{ "invalid": }')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('非 SSE 模式 JSON 解析失败'), expect.anything())
    })
  })

  describe('isEnd Edge Cases', () => {
    it('should handle ignored DONE signal update isEnd', () => {
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
        doneSignal: '[DONE]',
      })

      const result = processor.processChunk('data: [DONE]\n\n')
      expect(result.isEnd).toBe(true)
    })
  })

  describe('handleRemainingBuffer', () => {
    it('sSE mode with remaining content', () => {
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })
      processor.processChunk('data: {"a":1}') // No separator, so it stays in buffer
      onMessageSpy.mockClear()

      const result = processor.handleRemainingBuffer()
      expect(result?.currentRawPayload).toBe('{"a":1}')
      expect(result?.currentJson).toEqual([{ a: 1 }])
      expect(onMessageSpy).toHaveBeenCalled()
    })

    it('non-SSE mode with remaining content', () => {
      const processor = new SSEStreamProcessor({
        needParseData: false,
        onMessage: onMessageSpy,
      })

      processor.processChunk('some data')
      // In non-SSE mode, buffer is not cleared, so handleRemainingBuffer will process it again
      const result = processor.handleRemainingBuffer()
      expect(result?.currentRawPayload).toBe('some data')
    })

    it('sSE mode with DONE signal in remainder', () => {
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })
      processor.processChunk('data: [DONE]') // No separator
      const result = processor.handleRemainingBuffer()
      expect(result?.isEnd).toBe(true)
    })

    it('non-SSE mode with DONE signal in remainder', () => {
      const processor = new SSEStreamProcessor({
        needParseData: false,
        onMessage: onMessageSpy,
      })
      // Use a trick to get [DONE] into buffer without triggering isEnd in processChunk
      // In non-SSE mode, processChunk uses 'chunk', not 'buffer'.
      // If we pass '[DO' then 'NE]', buffer will have '[DONE]'.
      processor.processChunk('[DO')
      processor.processChunk('NE]')

      const result = processor.handleRemainingBuffer()
      expect(result?.isEnd).toBe(true)
    })

    it('jSON parsing error in remainder', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
      const processor = new SSEStreamProcessor({
        onMessage: onMessageSpy,
      })
      processor.processChunk('data: { "invalid": ')
      processor.handleRemainingBuffer()
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('处理剩余缓冲区 JSON 解析失败'), expect.anything())
    })

    it('should cover additional lines in parseSSEMessages', () => {
      const messages: any[] = []
      // Line 383: !trimmedLine.startsWith(dataPrefix) && ignoreInvalidDataPrefix
      // Line 398: currentPayload += handleData ? handleData(payloadPart) : payloadPart (else branch)
      // Line 419: collectedPayloads.push(finalPayloadForBlock)

      SSEStreamProcessor.parseSSEMessages({
        content: 'invalid: line\ndata: part1\ndata: part2\n\n',
        onMessage: data => messages.push(data),
        ignoreInvalidDataPrefix: true,
        handleData: undefined, // Trigger the else branch at 398
      })

      expect(messages[0].content).toBe('part1part2')
    })
  })
})
