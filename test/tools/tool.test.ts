import { describe, expect, it } from 'vitest'
import { deepCompare, getType, isObj, wait } from '@/tools'

describe('getType', () => {
  it('应该正确识别基本类型', () => {
    expect(getType('string')).toBe('string')
    expect(getType(123)).toBe('number')
    expect(getType(true)).toBe('boolean')
    expect(getType(null)).toBe('null')
    expect(getType(undefined)).toBe('undefined')
    expect(getType(Symbol('test'))).toBe('symbol')
    // @ts-ignore
    expect(getType(123n)).toBe('bigint')
  })

  it('应该正确识别对象类型', () => {
    expect(getType({})).toBe('object')
    expect(getType([])).toBe('array')
    expect(getType(new Date())).toBe('date')
    expect(getType(/regex/)).toBe('regexp')
    expect(getType(new Map())).toBe('map')
    expect(getType(new Set())).toBe('set')
    expect(getType(() => {})).toBe('function')
  })
})

describe('wait', () => {
  it('应该等待指定时间', async () => {
    const startTime = Date.now()
    await wait(100)
    const endTime = Date.now()

    expect(endTime - startTime).toBeGreaterThanOrEqual(100)
    expect(endTime - startTime).toBeLessThan(150) // 允许一些误差
  })

  it('应该使用默认等待时间 1000ms', async () => {
    const startTime = Date.now()
    await wait()
    const endTime = Date.now()

    expect(endTime - startTime).toBeGreaterThanOrEqual(1000)
  })

  it('应该返回 Promise', () => {
    const result = wait(10)
    expect(result).toBeInstanceOf(Promise)
  })
})

describe('isObj', () => {
  it('应该正确识别对象', () => {
    expect(isObj({})).toBe(true)
    expect(isObj([])).toBe(true)
    expect(isObj(new Date())).toBe(true)
    expect(isObj(/regex/)).toBe(true)
  })

  it('应该正确识别非对象', () => {
    expect(isObj(null)).toBe(false)
    expect(isObj(undefined)).toBe(false)
    expect(isObj('string')).toBe(false)
    expect(isObj(123)).toBe(false)
    expect(isObj(true)).toBe(false)
    expect(isObj(Symbol('test'))).toBe(false)
  })
})

describe('deepCompare', () => {
  it('应该比较基本类型', () => {
    expect(deepCompare(1, 1)).toBe(true)
    expect(deepCompare('a', 'a')).toBe(true)
    expect(deepCompare(true, true)).toBe(true)
    expect(deepCompare(null, null)).toBe(true)
    expect(deepCompare(undefined, undefined)).toBe(true)

    expect(deepCompare(1, 2)).toBe(false)
    expect(deepCompare('a', 'b')).toBe(false)
    expect(deepCompare(true, false)).toBe(false)
  })

  it('应该比较简单对象', () => {
    expect(deepCompare({}, {})).toBe(true)
    expect(deepCompare({ a: 1 }, { a: 1 })).toBe(true)
    expect(deepCompare({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)

    expect(deepCompare({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepCompare({ a: 1 }, { b: 1 })).toBe(false)
    expect(deepCompare({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('应该比较嵌套对象', () => {
    const obj1 = { a: { b: { c: 1 } } }
    const obj2 = { a: { b: { c: 1 } } }
    const obj3 = { a: { b: { c: 2 } } }

    expect(deepCompare(obj1, obj2)).toBe(true)
    expect(deepCompare(obj1, obj3)).toBe(false)
  })

  it('应该比较数组', () => {
    expect(deepCompare([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(deepCompare([1, [2, 3]], [1, [2, 3]])).toBe(true)

    expect(deepCompare([1, 2, 3], [1, 2, 4])).toBe(false)
    expect(deepCompare([1, 2], [1, 2, 3])).toBe(false)
  })

  it('应该处理 Symbol 属性', () => {
    const sym = Symbol('test')
    const obj1 = { [sym]: 'value', normal: 'prop' }
    const obj2 = { [sym]: 'value', normal: 'prop' }
    const obj3 = { [sym]: 'different', normal: 'prop' }

    expect(deepCompare(obj1, obj2)).toBe(true)
    expect(deepCompare(obj1, obj3)).toBe(false)
  })

  it('应该处理不同类型', () => {
    expect(deepCompare({}, [])).toBe(false)
    expect(deepCompare('1', 1)).toBe(false)
    expect(deepCompare(null, undefined)).toBe(false)
  })

  it('应该使用 Object.is 进行严格比较', () => {
    expect(deepCompare(Number.NaN, Number.NaN)).toBe(true)
    // expect(deepCompare(+0, -0)).toBe(false)
  })

  it('应该处理循环引用', () => {
    const obj1: any = { a: 1 }
    obj1.self = obj1

    const obj2: any = { a: 1 }
    obj2.self = obj2

    /** 循环引用应该返回 false 以避免无限递归 */
    expect(deepCompare(obj1, obj2)).toBe(false)
  })
})
