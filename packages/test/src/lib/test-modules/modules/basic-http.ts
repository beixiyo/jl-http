/**
 * 基础 HTTP 功能测试模块
 */

import type { TestContext, TestModule, TestResult } from '../types'
import { createErrorResult, createHttpInstance, createSuccessResult, createTestLog, measureTime } from '../utils'

export const basicHttpModule: TestModule = {
  id: 'basic-http',
  name: '基础 HTTP 功能',
  description: '测试基础的 HTTP 请求方法，包括 GET、POST、PUT、DELETE 等',

  scenarios: [
    {
      id: 'get-single',
      name: 'GET 获取单个资源',
      description: '测试 GET 方法获取单个资源',
      features: ['GET 请求', '单个资源', '响应解析'],
      category: 'basic',
      priority: 1,
    },
    {
      id: 'get-list',
      name: 'GET 获取资源列表',
      description: '测试 GET 方法获取资源列表',
      features: ['GET 请求', '列表数据', '数组响应'],
      category: 'basic',
      priority: 1,
    },
    {
      id: 'post-create',
      name: 'POST 创建资源',
      description: '测试 POST 方法创建新资源',
      features: ['POST 请求', '创建资源', '请求体'],
      category: 'basic',
      priority: 2,
    },
    {
      id: 'put-update',
      name: 'PUT 更新资源',
      description: '测试 PUT 方法更新现有资源',
      features: ['PUT 请求', '更新资源', '完整替换'],
      category: 'basic',
      priority: 2,
    },
    {
      id: 'delete-resource',
      name: 'DELETE 删除资源',
      description: '测试 DELETE 方法删除资源',
      features: ['DELETE 请求', '删除资源', '状态确认'],
      category: 'basic',
      priority: 2,
    },
    {
      id: 'error-handling',
      name: '错误处理测试',
      description: '测试各种错误情况的处理',
      features: ['错误处理', '404 错误', '网络错误'],
      category: 'error',
      priority: 3,
    },
  ],

  getDefaultConfig() {
    return {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      retry: 2,
    }
  },

  validateConfig(config) {
    return !!(config.baseUrl && config.timeout > 0)
  },

  async execute(context: TestContext): Promise<TestResult> {
    const { scenario, config } = context
    const logs: any[] = []
    const http = createHttpInstance(config)

    try {
      const { result, duration } = await measureTime(async () => {
        switch (scenario.id) {
          case 'get-single':
            return await testGetSingle(http, logs)
          case 'get-list':
            return await testGetList(http, logs)
          case 'post-create':
            return await testPostCreate(http, logs)
          case 'put-update':
            return await testPutUpdate(http, logs)
          case 'delete-resource':
            return await testDeleteResource(http, logs)
          case 'error-handling':
            return await testErrorHandling(http, logs)
          default:
            throw new Error(`未知的测试场景: ${scenario.id}`)
        }
      })

      return createSuccessResult(result, duration, logs, {
        scenario: scenario.id,
        requestCount: logs.filter(log => log.level === 'info').length,
      })
    }
    catch (error: any) {
      const duration = Date.now()
      logs.push(createTestLog('error', `测试失败: ${error.message}`, error))
      return createErrorResult(error.message, duration, logs)
    }
  },
}

/** 测试 GET 单个资源 */
async function testGetSingle(http: any, logs: any[]) {
  logs.push(createTestLog('info', '开始测试 GET 单个资源'))

  const post = await http.get('/posts/1') as any
  logs.push(createTestLog('success', `获取文章成功: ${post.title}`))

  /** 验证响应结构 */
  if (!post.id || !post.title || !post.body) {
    throw new Error('响应数据结构不正确')
  }

  return { post, validation: 'passed' }
}

/** 测试 GET 资源列表 */
async function testGetList(http: any, logs: any[]) {
  logs.push(createTestLog('info', '开始测试 GET 资源列表'))

  const posts = await http.get('/posts') as any[]
  logs.push(createTestLog('success', `获取文章列表成功: ${posts.length} 篇文章`))

  /** 验证响应是数组 */
  if (!Array.isArray(posts)) {
    throw new TypeError('响应数据应该是数组')
  }

  if (posts.length === 0) {
    throw new Error('文章列表不应该为空')
  }

  return { posts: posts.slice(0, 5), total: posts.length }
}

/** 测试 POST 创建资源 */
async function testPostCreate(http: any, logs: any[]) {
  logs.push(createTestLog('info', '开始测试 POST 创建资源'))

  const newPost = {
    title: '测试文章标题',
    body: '这是一篇测试文章的内容',
    userId: 1,
  }

  const createdPost = await http.post('/posts', newPost) as any
  logs.push(createTestLog('success', `创建文章成功: ID ${createdPost.id}`))

  /** 验证创建的资源 */
  if (!createdPost.id) {
    throw new Error('创建的资源应该有 ID')
  }

  return { originalData: newPost, createdPost }
}

/** 测试 PUT 更新资源 */
async function testPutUpdate(http: any, logs: any[]) {
  logs.push(createTestLog('info', '开始测试 PUT 更新资源'))

  const updateData = {
    id: 1,
    title: '更新后的文章标题',
    body: '更新后的文章内容',
    userId: 1,
  }

  const updatedPost = await http.put('/posts/1', updateData) as any
  logs.push(createTestLog('success', `更新文章成功: ${updatedPost.title}`))

  /** 验证更新结果 */
  if (updatedPost.title !== updateData.title) {
    logs.push(createTestLog('warning', '标题可能未正确更新（模拟API限制）'))
  }

  return { updateData, updatedPost }
}

/** 测试 DELETE 删除资源 */
async function testDeleteResource(http: any, logs: any[]) {
  logs.push(createTestLog('info', '开始测试 DELETE 删除资源'))

  const result = await http.delete('/posts/1') as any
  logs.push(createTestLog('success', '删除文章成功'))

  return { deleted: true, result }
}

/** 测试错误处理 */
async function testErrorHandling(http: any, logs: any[]) {
  logs.push(createTestLog('info', '开始测试错误处理'))

  const errors: any[] = []

  /** 测试 404 错误 */
  try {
    await http.get('/posts/99999')
  }
  catch (error: any) {
    logs.push(createTestLog('info', '成功捕获 404 错误'))
    errors.push({ type: '404', message: error.message })
  }

  /** 测试无效 URL */
  try {
    await http.get('/invalid-endpoint-that-does-not-exist')
  }
  catch (error: any) {
    logs.push(createTestLog('info', '成功捕获无效端点错误'))
    errors.push({ type: 'invalid-endpoint', message: error.message })
  }

  if (errors.length === 0) {
    throw new Error('错误处理测试失败：没有捕获到预期的错误')
  }

  logs.push(createTestLog('success', `错误处理测试完成，捕获 ${errors.length} 个错误`))

  return { errors, errorCount: errors.length }
}
