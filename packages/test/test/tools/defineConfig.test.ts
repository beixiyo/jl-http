import { defineConfig } from '@jl-org/http'
import type { Config } from '@jl-org/http'
import { describe, expect, it } from 'vitest'

describe('defineConfig', () => {
  it('应该返回传入的配置对象', () => {
    const config: Config = {
      importPath: '@/api/http',
      className: 'UserApi',
      requestFnName: 'http',
      fns: [
        {
          name: 'getUser',
          url: '/user/:id',
          method: 'get',
          comment: '获取用户信息',
        },
      ],
    }

    const result = defineConfig(config)
    expect(result).toBe(config)
    expect(result).toEqual(config)
  })

  it('应该支持完整的配置选项', () => {
    const config: Config = {
      importPath: '@/utils/request',
      className: 'ApiService',
      requestFnName: 'request',
      fns: [
        {
          name: 'createUser',
          isAsync: true,
          url: '/users',
          method: 'post',
          args: {
            name: 'string',
            email: 'string',
            age: 'number',
          },
          comment: '创建新用户',
        },
        {
          name: 'updateUser',
          isAsync: true,
          url: '/users/:id',
          method: 'put',
          args: {
            id: 'number',
            data: {
              name: 'string',
              email: 'string',
            },
          },
          comment: '更新用户信息',
        },
        {
          name: 'deleteUser',
          url: '/users/:id',
          method: 'delete',
          args: {
            id: 'number',
          },
          comment: '删除用户',
        },
        {
          name: 'getUserList',
          url: '/users',
          method: 'get',
          args: {
            page: 1,
            size: 10,
            filters: {
              status: 'active',
              role: 'user',
            },
          },
          comment: '获取用户列表',
        },
      ],
    }

    const result = defineConfig(config)
    expect(result).toEqual(config)
    expect(result.fns).toHaveLength(4)
  })

  it('应该支持不同的 HTTP 方法', () => {
    const config: Config = {
      importPath: '@/api',
      className: 'RestApi',
      requestFnName: 'http',
      fns: [
        {
          name: 'getData',
          url: '/data',
          method: 'get',
        },
        {
          name: 'createData',
          url: '/data',
          method: 'post',
        },
        {
          name: 'updateData',
          url: '/data/:id',
          method: 'put',
        },
        {
          name: 'patchData',
          url: '/data/:id',
          method: 'patch',
        },
        {
          name: 'deleteData',
          url: '/data/:id',
          method: 'delete',
        },
        {
          name: 'headData',
          url: '/data',
          method: 'head',
        },
        {
          name: 'optionsData',
          url: '/data',
          method: 'options',
        },
      ],
    }

    const result = defineConfig(config)
    expect(result.fns.map(fn => fn.method)).toEqual([
      'get', 'post', 'put', 'patch', 'delete', 'head', 'options'
    ])
  })

  it('应该支持复杂的参数类型', () => {
    const config: Config = {
      importPath: '@/api',
      className: 'ComplexApi',
      requestFnName: 'http',
      fns: [
        {
          name: 'complexRequest',
          url: '/complex',
          method: 'post',
          args: {
            // 基本类型
            id: 'number',
            name: 'string',
            active: 'boolean',

            // 数组类型
            tags: ['string'],
            numbers: ['number'],

            // 嵌套对象
            user: {
              id: 'number',
              profile: {
                name: 'string',
                avatar: 'string',
              },
            },

            // 混合类型
            metadata: {
              created: 'Date',
              updated: 'Date',
              version: 'number',
              features: ['string'],
            },
          },
          comment: '复杂参数请求',
        },
      ],
    }

    const result = defineConfig(config)
    expect(result.fns[0].args).toBeDefined()
    expect(typeof result.fns[0].args).toBe('object')
  })

  it('应该支持可选的配置字段', () => {
    const minimalConfig: Config = {
      importPath: '@/api',
      className: 'MinimalApi',
      requestFnName: 'http',
      fns: [
        {
          name: 'simpleGet',
          url: '/simple',
          method: 'get',
          // 没有 isAsync, args, comment
        },
      ],
    }

    const result = defineConfig(minimalConfig)
    expect(result.fns[0].isAsync).toBeUndefined()
    expect(result.fns[0].args).toBeUndefined()
    expect(result.fns[0].comment).toBeUndefined()
  })

  it('应该返回相同的配置对象引用', () => {
    const originalConfig: Config = {
      importPath: '@/api',
      className: 'TestApi',
      requestFnName: 'http',
      fns: [
        {
          name: 'test',
          url: '/test',
          method: 'get',
        },
      ],
    }

    const result = defineConfig(originalConfig)

    // defineConfig 应该返回相同的对象引用（这是设计行为）
    expect(result).toBe(originalConfig)
    expect(result.className).toBe('TestApi')
  })

  it('应该支持 RESTful API 模式', () => {
    const restConfig: Config = {
      importPath: '@/api/rest',
      className: 'UserRestApi',
      requestFnName: 'httpClient',
      fns: [
        {
          name: 'index',
          url: '/users',
          method: 'get',
          comment: '获取用户列表',
        },
        {
          name: 'show',
          url: '/users/:id',
          method: 'get',
          args: { id: 'number' },
          comment: '获取单个用户',
        },
        {
          name: 'store',
          url: '/users',
          method: 'post',
          args: {
            name: 'string',
            email: 'string',
          },
          comment: '创建用户',
        },
        {
          name: 'update',
          url: '/users/:id',
          method: 'put',
          args: {
            id: 'number',
            name: 'string',
            email: 'string',
          },
          comment: '更新用户',
        },
        {
          name: 'destroy',
          url: '/users/:id',
          method: 'delete',
          args: { id: 'number' },
          comment: '删除用户',
        },
      ],
    }

    const result = defineConfig(restConfig)
    expect(result.fns).toHaveLength(5)
    expect(result.fns.map(fn => fn.name)).toEqual([
      'index', 'show', 'store', 'update', 'destroy'
    ])
  })
})
