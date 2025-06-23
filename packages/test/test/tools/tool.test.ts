import { deepCompare, getType, isObj, wait } from '@jl-org/http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('工具函数', () => {
  describe('getType', () => {
    it('应该正确识别基本类型', () => {
      expect(getType('string')).toBe('string')
      expect(getType(123)).toBe('number')
      expect(getType(true)).toBe('boolean')
      expect(getType(false)).toBe('boolean')
      expect(getType(null)).toBe('null')
      expect(getType(undefined)).toBe('undefined')
      expect(getType(Symbol('test'))).toBe('symbol')
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
      expect(getType(new Error())).toBe('error')
    })

    it('应该正确识别特殊对象', () => {
      expect(getType(new Promise(() => {}))).toBe('promise')
      expect(getType(new WeakMap())).toBe('weakmap')
      expect(getType(new WeakSet())).toBe('weakset')
      expect(getType(new ArrayBuffer(8))).toBe('arraybuffer')
      expect(getType(new Int8Array(8))).toBe('int8array')
    })
  })

  describe('isObj', () => {
    it('应该正确判断对象类型', () => {
      expect(isObj({})).toBe(true)
      expect(isObj([])).toBe(true)
      expect(isObj(new Date())).toBe(true)
      expect(isObj(/regex/)).toBe(true)
      expect(isObj(new Map())).toBe(true)
    })

    it('应该正确判断非对象类型', () => {
      expect(isObj(null)).toBe(false)
      expect(isObj(undefined)).toBe(false)
      expect(isObj('string')).toBe(false)
      expect(isObj(123)).toBe(false)
      expect(isObj(true)).toBe(false)
      expect(isObj(Symbol('test'))).toBe(false)
      expect(isObj(123n)).toBe(false)
      expect(isObj(() => {})).toBe(false) // 函数不是对象类型
    })
  })

  describe('wait', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该等待默认时间（1000ms）', async () => {
      const promise = wait()

      // 在 1000ms 之前，Promise 应该还未 resolve
      vi.advanceTimersByTime(999)
      expect(promise).toBeInstanceOf(Promise)

      // 在 1000ms 时，Promise 应该 resolve
      vi.advanceTimersByTime(1)
      await expect(promise).resolves.toBeUndefined()
    })

    it('应该等待指定时间', async () => {
      const promise = wait(2000)

      // 在 2000ms 之前，Promise 应该还未 resolve
      vi.advanceTimersByTime(1999)
      expect(promise).toBeInstanceOf(Promise)

      // 在 2000ms 时，Promise 应该 resolve
      vi.advanceTimersByTime(1)
      await expect(promise).resolves.toBeUndefined()
    })

    it('应该支持 0 毫秒等待', async () => {
      const promise = wait(0)

      vi.advanceTimersByTime(0)
      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('deepCompare', () => {
    it('应该正确比较基本类型', () => {
      expect(deepCompare(1, 1)).toBe(true)
      expect(deepCompare('test', 'test')).toBe(true)
      expect(deepCompare(true, true)).toBe(true)
      expect(deepCompare(null, null)).toBe(true)
      expect(deepCompare(undefined, undefined)).toBe(true)

      expect(deepCompare(1, 2)).toBe(false)
      expect(deepCompare('test', 'other')).toBe(false)
      expect(deepCompare(true, false)).toBe(false)
      expect(deepCompare(null, undefined)).toBe(false)
    })

    it('应该正确比较简单对象', () => {
      const obj1 = { a: 1, b: 'test' }
      const obj2 = { a: 1, b: 'test' }
      const obj3 = { a: 1, b: 'other' }
      const obj4 = { a: 1, b: 'test', c: 3 }

      expect(deepCompare(obj1, obj2)).toBe(true)
      expect(deepCompare(obj1, obj3)).toBe(false)
      expect(deepCompare(obj1, obj4)).toBe(false)
    })

    it('应该正确比较嵌套对象', () => {
      const obj1 = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 'test'
          }
        }
      }
      const obj2 = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 'test'
          }
        }
      }
      const obj3 = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 'other'
          }
        }
      }

      expect(deepCompare(obj1, obj2)).toBe(true)
      expect(deepCompare(obj1, obj3)).toBe(false)
    })

    it('应该正确比较数组', () => {
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 3]
      const arr3 = [1, 2, 4]
      const arr4 = [1, 2]

      expect(deepCompare(arr1, arr2)).toBe(true)
      expect(deepCompare(arr1, arr3)).toBe(false)
      expect(deepCompare(arr1, arr4)).toBe(false)
    })

    it('应该正确比较复杂嵌套结构', () => {
      const complex1 = {
        users: [
          { id: 1, name: 'Alice', meta: { active: true } },
          { id: 2, name: 'Bob', meta: { active: false } }
        ],
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        }
      }

      const complex2 = {
        users: [
          { id: 1, name: 'Alice', meta: { active: true } },
          { id: 2, name: 'Bob', meta: { active: false } }
        ],
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        }
      }

      expect(deepCompare(complex1, complex2)).toBe(true)
    })

    it('应该处理 Symbol 属性', () => {
      const sym = Symbol('test')
      const obj1 = { a: 1, [sym]: 'symbol' }
      const obj2 = { a: 1, [sym]: 'symbol' }
      const obj3 = { a: 1, [sym]: 'other' }

      expect(deepCompare(obj1, obj2)).toBe(true)
      expect(deepCompare(obj1, obj3)).toBe(false)
    })

    it('应该处理不同类型的比较', () => {
      expect(deepCompare({}, [])).toBe(false)
      expect(deepCompare([], {})).toBe(false)
      expect(deepCompare('123', 123)).toBe(false)
      expect(deepCompare(true, 1)).toBe(false)
    })

    it('应该处理循环引用', () => {
      const obj1: any = { a: 1 }
      obj1.self = obj1

      const obj2: any = { a: 1 }
      obj2.self = obj2

      // 循环引用应该返回 false（为了避免无限递归）
      expect(deepCompare(obj1, obj2)).toBe(false)
    })

    it('应该正确处理相同引用', () => {
      const obj = { a: 1, b: { c: 2 } }
      expect(deepCompare(obj, obj)).toBe(true)
    })

    it('应该处理特殊值', () => {
      expect(deepCompare(NaN, NaN)).toBe(true)
      expect(deepCompare(+0, -0)).toBe(false)
      expect(deepCompare(Infinity, Infinity)).toBe(true)
      expect(deepCompare(-Infinity, -Infinity)).toBe(true)
    })
  })
})
