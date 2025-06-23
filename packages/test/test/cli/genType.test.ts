import { genType } from '../../../jl-http/src/cli/tools'
import { describe, expect, it } from 'vitest'

describe('genType', () => {
  describe('基本类型生成', () => {
    it('应该处理空参数', () => {
      expect(genType()).toBe('')
      expect(genType({})).toBe('{\n\t}')
    })

    it('应该生成基本类型', () => {
      const args = {
        name: 'string',
        age: 'number',
        active: 'boolean',
      }

      const result = genType(args)

      expect(result).toContain('name: string')
      expect(result).toContain('age: number')
      expect(result).toContain('active: boolean')
      expect(result).toMatch(/^\{[\s\S]*\}$/) // 应该被大括号包围
    })

    it('应该生成特殊类型', () => {
      const args = {
        isTrue: 'true',
        isFalse: 'false',
        data: 'any',
        empty: 'null',
        missing: 'undefined',
        fn: 'function',
        bigNum: 'bigInt',
      }

      const result = genType(args)

      expect(result).toContain('isTrue: true')
      expect(result).toContain('isFalse: false')
      expect(result).toContain('data: any')
      expect(result).toContain('empty: null')
      expect(result).toContain('missing: undefined')
      expect(result).toContain('fn: Function')
      expect(result).toContain('bigNum: bigInt')
    })

    it('应该处理数组类型', () => {
      const args = {
        items: 'array',
        tags: 'string[]',
        numbers: 'number[]',
      }

      const result = genType(args)

      expect(result).toContain('items: any[]')
      expect(result).toContain('tags: string[]')
      expect(result).toContain('numbers: number[]')
    })
  })

  describe('字面量值类型推断', () => {
    it('应该从字面量值推断类型', () => {
      const args = {
        stringValue: 'hello',
        numberValue: 123,
        booleanValue: true,
        falseValue: false,
        nullValue: null,
        undefinedValue: undefined,
        arrayValue: [1, 2, 3],
        objectValue: { key: 'value' },
        functionValue: () => {},
        bigintValue: BigInt(123),
      }

      const result = genType(args)

      expect(result).toContain('stringValue: string')
      expect(result).toContain('numberValue: number')
      expect(result).toContain('booleanValue: true') // 字面量值保持原样
      expect(result).toContain('falseValue: false') // 字面量值保持原样
      expect(result).toContain('nullValue: null')
      expect(result).toContain('undefinedValue: undefined')
      expect(result).toContain('arrayValue: any[]')
      expect(result).toContain('objectValue: object')
      expect(result).toContain('functionValue: function')
      expect(result).toContain('bigintValue: bigint')
    })

    it('应该处理复杂数组', () => {
      const args = {
        stringArray: ['a', 'b', 'c'],
        numberArray: [1, 2, 3],
        mixedArray: [1, 'a', true],
        nestedArray: [[1, 2], [3, 4]],
      }

      const result = genType(args)

      expect(result).toContain('stringArray: any[]')
      expect(result).toContain('numberArray: any[]')
      expect(result).toContain('mixedArray: any[]')
      expect(result).toContain('nestedArray: any[]')
    })

    it('应该处理嵌套对象', () => {
      const args = {
        user: {
          id: 'number',
          name: 'string',
          profile: {
            avatar: 'string',
            bio: 'string',
          },
        },
        settings: {
          theme: 'dark',
          notifications: true,
        },
      }

      const result = genType(args)

      expect(result).toContain('user: object')
      expect(result).toContain('settings: object')
    })
  })

  describe('格式化和结构', () => {
    it('应该正确格式化单个属性', () => {
      const args = { name: 'string' }
      const result = genType(args)

      expect(result).toBe('{\n\t\tname: string\n\t}')
    })

    it('应该正确格式化多个属性', () => {
      const args = {
        id: 'number',
        name: 'string',
        active: 'boolean',
      }

      const result = genType(args)

      // 检查基本结构
      expect(result).toMatch(/^\{[\s\S]*\}$/)
      expect(result).toMatch(/\n\t\tid: number/)
      expect(result).toMatch(/\n\t\tname: string/)
      expect(result).toMatch(/\n\t\tactive: boolean/)
      expect(result).toMatch(/\n\t\}$/)
    })

    it('应该保持属性顺序', () => {
      const args = {
        first: 'string',
        second: 'number',
        third: 'boolean',
      }

      const result = genType(args)
      const lines = result.split('\n')

      // 找到包含属性的行
      const propertyLines = lines.filter(line => line.includes(':'))
      expect(propertyLines[0]).toContain('first: string')
      expect(propertyLines[1]).toContain('second: number')
      expect(propertyLines[2]).toContain('third: boolean')
    })
  })

  describe('特殊情况处理', () => {
    it('应该处理特殊字符的属性名', () => {
      const args = {
        'kebab-case': 'string',
        'snake_case': 'number',
        'camelCase': 'boolean',
        'PascalCase': 'string',
        '123numeric': 'number',
        '$special': 'string',
      }

      const result = genType(args)

      expect(result).toContain('kebab-case: string')
      expect(result).toContain('snake_case: number')
      expect(result).toContain('camelCase: boolean')
      expect(result).toContain('PascalCase: string')
      expect(result).toContain('123numeric: number')
      expect(result).toContain('$special: string')
    })

    it('应该处理未知类型字符串', () => {
      const args = {
        custom: 'CustomType',
        unknown: 'SomeUnknownType',
        generic: 'Array<string>',
      }

      const result = genType(args)

      // 未知类型应该被推断为对应的类型
      expect(result).toContain('custom: string') // 'CustomType' 是字符串，应该推断为 string
      expect(result).toContain('unknown: string')
      expect(result).toContain('generic: string')
    })

    it('应该处理数组类型字符串的特殊格式', () => {
      const args = {
        stringArray: 'string[]',
        numberArray: 'number[]',
        booleanArray: 'boolean[]',
        customArray: 'CustomType[]',
      }

      const result = genType(args)

      expect(result).toContain('stringArray: string[]')
      expect(result).toContain('numberArray: number[]')
      expect(result).toContain('booleanArray: boolean[]')
      expect(result).toContain('customArray: CustomType[]')
    })
  })

  describe('复杂场景', () => {
    it('应该处理 RESTful API 参数', () => {
      const args = {
        id: 'number',
        page: 1,
        size: 10,
        sort: 'string',
        filters: {
          status: 'active',
          type: 'user',
        },
        include: ['profile', 'settings'],
      }

      const result = genType(args)

      expect(result).toContain('id: number')
      expect(result).toContain('page: number')
      expect(result).toContain('size: number')
      expect(result).toContain('sort: string')
      expect(result).toContain('filters: object')
      expect(result).toContain('include: any[]')
    })

    it('应该处理表单数据参数', () => {
      const args = {
        username: 'string',
        email: 'string',
        password: 'string',
        confirmPassword: 'string',
        age: 'number',
        terms: 'boolean',
        avatar: 'File',
        preferences: {
          theme: 'string',
          language: 'string',
          notifications: 'boolean',
        },
      }

      const result = genType(args)

      expect(result).toContain('username: string')
      expect(result).toContain('email: string')
      expect(result).toContain('password: string')
      expect(result).toContain('confirmPassword: string')
      expect(result).toContain('age: number')
      expect(result).toContain('terms: boolean')
      expect(result).toContain('avatar: string') // 'File' 被推断为 string
      expect(result).toContain('preferences: object')
    })

    it('应该处理空值和边界情况', () => {
      const args = {
        emptyString: '',
        zero: 0,
        emptyArray: [],
        emptyObject: {},
        whitespace: '   ',
      }

      const result = genType(args)

      expect(result).toContain('emptyString: string')
      expect(result).toContain('zero: number')
      expect(result).toContain('emptyArray: any[]')
      expect(result).toContain('emptyObject: object')
      expect(result).toContain('whitespace: string')
    })
  })
})
