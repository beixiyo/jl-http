import type { SSEParserField, SSEParserOptions, SSEParserOutput } from '@jl-org/http'
import { SSEBufferLimitError, SSEParser } from '@jl-org/http'
import { describe, expect, it, vi } from 'vitest'

describe('增量 SSE parser 协议解析', () => {
  it('任意字符切分都保持 UTF-8 文本、标准字段和多行 data 语义', () => {
    const content = [
      '\uFEFF: heartbeat',
      'id: event-1',
      'retry: 2500',
      'event: update',
      'data: {"text":"你🙂",',
      'data: "complete":true}',
      '',
      'data: second',
      '',
      '',
    ].join('\r\n')
    const expected = [
      {
        type: 'message',
        message: {
          data: '{"text":"你🙂",\n"complete":true}',
          dataText: '{"text":"你🙂",\n"complete":true}',
          event: 'update',
          id: 'event-1',
          retry: 2500,
        },
      },
      {
        type: 'message',
        message: {
          data: 'second',
          dataText: 'second',
          event: 'message',
          id: 'event-1',
          retry: 2500,
        },
      },
    ]

    for (let splitAt = 0; splitAt <= content.length; splitAt++) {
      const onComment = vi.fn()
      const parser = new SSEParser({ onComment })
      const outputs = [
        ...parser.processChunk(content.slice(0, splitAt)),
        ...parser.processChunk(content.slice(splitAt)),
      ]

      expect(outputs).toEqual(expected)
      expect(onComment).toHaveBeenCalledExactlyOnceWith('heartbeat')
    }
  })

  it('lF、CRLF 和 CR 都能独立结束行与事件', () => {
    const parser = new SSEParser()
    const outputs = [
      ...parser.processChunk('data: lf\n\ndata: crlf\r\n\r\ndata: cr\r\r'),
    ]

    expect(messageTexts(outputs)).toEqual(['lf', 'crlf', 'cr'])
  })

  it('遇到 EOF 时丢弃未完成事件，不污染更早已经提交的事件', () => {
    const parser = new SSEParser()
    const outputs = [
      ...parser.processChunk('data: stable\n\ndata: truncated'),
    ]
    parser.finish()

    expect(messageTexts(outputs)).toEqual(['stable'])
  })

  it('只有显式配置的结束载荷才终止流', () => {
    const ordinaryParser = new SSEParser()
    expect([...ordinaryParser.processChunk('data: [DONE]\n\n')]).toMatchObject([
      { type: 'message', message: { dataText: '[DONE]' } },
    ])

    const doneParser = new SSEParser({ doneSignal: '[DONE]' })
    expect([...doneParser.processChunk('data: [DONE]\n\ndata: same-chunk\n\n')]).toEqual([{ type: 'done' }])
    expect([...doneParser.processChunk('data: later-chunk\n\n')]).toEqual([])
  })

  it('单个未完成事件超过显式上限时终止解析', () => {
    const parser = new SSEParser({ maxBufferSize: 8 })

    expect(() => [...parser.processChunk('data: 123')]).toThrow(SSEBufferLimitError)
  })

  it('缓冲上限只约束当前事件，不约束已经逐条产出的响应总量', () => {
    const parser = new SSEParser({ maxBufferSize: 8 })
    const outputs = Array.from(
      { length: 1_000 },
      (_, index) => [...parser.processChunk(`data: ${index % 10}\n\n`)],
    ).flat()

    expect(messageTexts(outputs)).toHaveLength(1_000)
  })

  it('commentPrefix 可以适配非标准心跳前缀', () => {
    const onComment = vi.fn()
    const parser = new SSEParser({ commentPrefix: '#', onComment })

    expect([...parser.processChunk('# ping\n\n')]).toEqual([])
    expect(onComment).toHaveBeenCalledExactlyOnceWith('ping')
  })

  it('自定义字段匹配、字段前缀和精确分隔符在任意切分下保持一致', () => {
    const content = [
      'cursor: event-42\n',
      'again: 1200\n',
      'kind: update\n',
      '[[payload]] 你🙂\n',
      '[[payload]] second<END>',
      'kind: close\n',
      '[[payload]] bye<END>',
    ].join('')
    const options: SSEParserOptions = {
      eventPrefix: 'kind:',
      idPrefix: 'cursor:',
      retryPrefix: 'again:',
      separator: '<END>',
      isDone: message => message.event === 'close' && message.dataText === 'bye',
      matchField: ({ line }): SSEParserField | undefined => {
        const match = /^\[\[payload\]\]\s?(.*)$/.exec(line)
        return match
          ? { type: 'data', value: match[1] }
          : undefined
      },
    }
    const expected: SSEParserOutput[] = [
      {
        type: 'message',
        message: {
          data: '你🙂\nsecond',
          dataText: '你🙂\nsecond',
          event: 'update',
          id: 'event-42',
          retry: 1200,
        },
      },
      { type: 'done' },
    ]

    for (let splitAt = 0; splitAt <= content.length; splitAt++) {
      const parser = new SSEParser(options)
      const outputs = [
        ...parser.processChunk(content.slice(0, splitAt)),
        ...parser.processChunk(content.slice(splitAt)),
      ]

      expect(outputs).toEqual(expected)
    }
  })

  it('matchField 可以覆盖标准 data 前缀的取值规则', () => {
    const standardParser = new SSEParser()
    expect(messageTexts([...standardParser.processChunk('data:  \n\n')])).toEqual([' '])

    const customParser = new SSEParser({
      matchField: ({ line }) =>
        line.startsWith('data:')
          ? { type: 'data', value: line.slice('data:'.length).trim() }
          : undefined,
    })
    expect(messageTexts([...customParser.processChunk('data:  \n\n')])).toEqual([''])
  })

  it('空分隔符回落到标准 SSE 空行语义', () => {
    const parser = new SSEParser({ separator: '' })

    expect(messageTexts([...parser.processChunk('data: standard\n\n')])).toEqual(['standard'])
  })

  it('所有显式 undefined 选项都回落到标准 SSE 默认语义', () => {
    const options: SSEParserOptions = {
      dataPrefix: undefined,
      commentPrefix: undefined,
      eventPrefix: undefined,
      idPrefix: undefined,
      retryPrefix: undefined,
      separator: undefined,
      doneSignal: undefined,
      isDone: undefined,
      maxBufferSize: undefined,
      onComment: undefined,
      matchField: undefined,
    }
    const parser = new SSEParser(options)
    const outputs = [...parser.processChunk([
      ': heartbeat',
      'event: update',
      'id: standard-id',
      'retry: 1000',
      'data: standard',
      '',
      '',
    ].join('\r\n'))]

    expect(outputs).toMatchObject([
      {
        type: 'message',
        message: {
          dataText: 'standard',
          event: 'update',
          id: 'standard-id',
          retry: 1000,
        },
      },
    ])
  })
})

function messageTexts(outputs: SSEParserOutput[]) {
  return outputs.flatMap(output =>
    output.type === 'message'
      ? [output.message.dataText]
      : [],
  )
}
