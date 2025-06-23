/**
 * 示例测试模块 - 展示如何使用辅助工具创建测试模块
 */

import { createTestModule, createTestScenarios, createAssert, TestDataGenerator, PerformanceTracker } from '../helpers'
import { createHttpInstance } from '../utils'

/** 示例测试模块 */
export const exampleModule = createTestModule({
  id: 'example',
  name: '示例测试模块',
  description: '展示如何使用辅助工具创建测试模块',

  scenarios: createTestScenarios([
    {
      id: 'basic-test',
      name: '基础测试示例',
      description: '展示基本的测试功能',
      features: ['HTTP请求', '断言验证', '日志记录'],
      category: 'example',
      priority: 1,
    },
    {
      id: 'performance-test',
      name: '性能测试示例',
      description: '展示性能测试功能',
      features: ['性能监控', '时间测量', '性能断言'],
      category: 'example',
      priority: 2,
    },
    {
      id: 'data-generation-test',
      name: '数据生成示例',
      description: '展示测试数据生成功能',
      features: ['随机数据', '测试数据', '数据验证'],
      category: 'example',
      priority: 3,
    },
  ]),

  defaultConfig: {
    baseUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 10000,
    performanceThreshold: 1000, // 性能阈值（毫秒）
  },

  validateConfig(config) {
    return !!(config.baseUrl && config.timeout > 0)
  },

  async execute(context, helpers) {
    const { scenario, config } = context
    const { log, measure, createSuccess, createError } = helpers

    log('info', `开始执行示例测试: ${scenario.name}`)

    try {
      const { result, duration } = await measure(async () => {
        switch (scenario.id) {
          case 'basic-test':
            return await basicTestExample(config, helpers)
          case 'performance-test':
            return await performanceTestExample(config, helpers)
          case 'data-generation-test':
            return await dataGenerationTestExample(config, helpers)
          default:
            throw new Error(`未知的测试场景: ${scenario.id}`)
        }
      })

      log('success', `测试完成: ${scenario.name}`, { duration, result })
      return createSuccess(result, duration, { scenario: scenario.id })

    } catch (error: any) {
      log('error', `测试失败: ${error.message}`, error)
      return createError(error.message, 0)
    }
  },
})

/** 基础测试示例 */
async function basicTestExample(config: any, helpers: any) {
  const { log } = helpers
  const assert = createAssert(log)

  log('info', '开始基础测试示例')

  // 创建HTTP实例
  const http = createHttpInstance(config)

  // 发送GET请求
  log('info', '发送GET请求获取文章')
  const post = await http.get('/posts/1') as any

  // 使用断言验证结果
  assert.assertTrue(post, '文章数据不能为空')
  assert.assertType(post.id, 'number', '文章ID应该是数字')
  assert.assertType(post.title, 'string', '文章标题应该是字符串')
  assert.assertType(post.body, 'string', '文章内容应该是字符串')

  log('success', '基础测试示例完成', { postId: post.id, title: post.title })

  return {
    post,
    assertions: 4,
    testType: 'basic',
  }
}

/** 性能测试示例 */
async function performanceTestExample(config: any, helpers: any) {
  const { log } = helpers
  const assert = createAssert(log)
  const tracker = new PerformanceTracker()

  log('info', '开始性能测试示例')

  const http = createHttpInstance(config)
  const performanceThreshold = config.performanceThreshold || 1000

  // 测量单个请求性能
  const { result: singleResult, duration: singleDuration } = await tracker.measure(
    'single-request',
    () => http.get('/posts/1')
  )

  log('info', `单个请求耗时: ${singleDuration}ms`)
  assert.assertInRange(
    singleDuration,
    0,
    performanceThreshold,
    `单个请求耗时应在 ${performanceThreshold}ms 内`
  )

  // 测量多个请求性能
  tracker.start('multiple-requests')
  const multipleResults = await Promise.all([
    http.get('/posts/1'),
    http.get('/posts/2'),
    http.get('/posts/3'),
  ])
  const multipleDuration = tracker.end('multiple-requests')

  log('info', `多个请求耗时: ${multipleDuration}ms`)
  assert.assertTrue(multipleResults.length === 3, '应该返回3个结果')

  // 计算平均响应时间
  const avgDuration = multipleDuration / 3
  log('info', `平均响应时间: ${avgDuration.toFixed(2)}ms`)

  return {
    singleDuration,
    multipleDuration,
    avgDuration,
    performanceThreshold,
    testType: 'performance',
  }
}

/** 数据生成测试示例 */
async function dataGenerationTestExample(config: any, helpers: any) {
  const { log } = helpers
  const assert = createAssert(log)

  log('info', '开始数据生成测试示例')

  const http = createHttpInstance(config)

  // 生成测试数据
  const testUser = TestDataGenerator.testUser()
  const testPost = TestDataGenerator.testPost()

  log('info', '生成测试用户数据', testUser)
  log('info', '生成测试文章数据', testPost)

  // 验证生成的数据
  assert.assertType(testUser.id, 'number', '用户ID应该是数字')
  assert.assertType(testUser.name, 'string', '用户名应该是字符串')
  assert.assertType(testUser.email, 'string', '邮箱应该是字符串')
  assert.assertTrue(testUser.email.includes('@'), '邮箱应该包含@符号')

  assert.assertType(testPost.id, 'number', '文章ID应该是数字')
  assert.assertType(testPost.title, 'string', '文章标题应该是字符串')
  assert.assertType(testPost.body, 'string', '文章内容应该是字符串')

  // 使用生成的数据创建文章
  log('info', '使用生成的数据创建文章')
  const createdPost = await http.post('/posts', {
    title: testPost.title,
    body: testPost.body,
    userId: testUser.id,
  }) as any

  assert.assertTrue(createdPost.id, '创建的文章应该有ID')
  log('success', '文章创建成功', { createdId: createdPost.id })

  return {
    testUser,
    testPost,
    createdPost,
    dataValidations: 7,
    testType: 'data-generation',
  }
}

/** 导出示例模块用于演示 */
export default exampleModule
