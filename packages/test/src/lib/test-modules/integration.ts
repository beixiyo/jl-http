/**
 * 测试模块集成工具 - 帮助现有测试页面集成测试模块
 */

import type { TestModule } from './types'
import { abortModule } from './modules/abort'
import { basicHttpModule } from './modules/basic-http'
import { cacheModule } from './modules/cache'
import { concurrentModule } from './modules/concurrent'

/** 所有可用的测试模块 */
export const availableModules = {
  'basic-http': basicHttpModule,
  'cache': cacheModule,
  'concurrent': concurrentModule,
  'abort': abortModule,
} as const

/** 模块ID类型 */
export type ModuleId = keyof typeof availableModules

/** 获取测试模块 */
export function getTestModule(moduleId: ModuleId): TestModule {
  return availableModules[moduleId]
}

/** 获取所有测试模块 */
export function getAllTestModules(): TestModule[] {
  return Object.values(availableModules)
}

/** 页面到模块的映射 */
export const pageModuleMapping = {
  'http-basic': 'basic-http',
  'http-cache': 'cache',
  'http-concurrent': 'concurrent',
  'http-abort': 'abort',
  'http-interceptors': 'basic-http', // 拦截器功能在基础模块中
  'http-retry': 'basic-http', // 重试功能在基础模块中
  'http-sse': 'basic-http', // SSE 可以作为基础模块的扩展
} as const

/** 根据页面路径获取对应的测试模块 */
export function getModuleByPagePath(pagePath: string): TestModule | undefined {
  const moduleId = pageModuleMapping[pagePath as keyof typeof pageModuleMapping]
  return moduleId
    ? availableModules[moduleId]
    : undefined
}

/** 测试页面重构配置 */
export interface PageRefactorConfig {
  /** 页面标题 */
  title: string
  /** 页面描述 */
  description: string
  /** 默认配置 */
  defaultConfig: Record<string, any>
  /** 是否显示手动测试选项 */
  showManualTest?: boolean
  /** 自定义测试完成回调 */
  onTestComplete?: (scenarioId: string, result: any) => void
}

/** 预定义的页面配置 */
export const pageConfigs: Record<string, PageRefactorConfig> = {
  'http-basic': {
    title: 'HTTP 基础功能测试',
    description: '使用标准化测试模块测试 jl-http 的基础 HTTP 请求功能，包括 GET、POST、PUT、DELETE 等方法',
    defaultConfig: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      retry: 2,
    },
    showManualTest: true,
  },
  'http-cache': {
    title: '缓存功能测试',
    description: '测试 jl-http 的请求缓存功能，包括缓存命中、缓存超时、缓存隔离等',
    defaultConfig: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      cacheTimeout: 5000,
      testUrl: '/posts/1',
    },
  },
  'http-concurrent': {
    title: '并发请求测试',
    description: '测试 jl-http 的并发请求功能，包括并发控制、任务调度、结果聚合等',
    defaultConfig: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      taskCount: 5,
      maxConcurrency: 3,
      includeFailures: false,
      requestType: 'posts',
    },
  },
  'http-abort': {
    title: '请求中断测试',
    description: '测试 jl-http 的请求中断功能，包括手动中断、超时中断、信号管理等',
    defaultConfig: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      abortDelay: 2000,
      testUrl: '/posts',
    },
  },
  'http-interceptors': {
    title: '拦截器功能测试',
    description: '测试 jl-http 的拦截器功能，包括请求拦截器、响应拦截器、错误拦截器等',
    defaultConfig: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      retry: 2,
      headers: {
        'X-Test-Mode': 'interceptor',
      },
    },
  },
  'http-retry': {
    title: '重试机制测试',
    description: '测试 jl-http 的重试机制，包括自动重试、重试策略、重试限制等',
    defaultConfig: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 5000,
      retry: 3,
    },
  },
  'http-sse': {
    title: 'SSE 流式数据测试',
    description: '测试 jl-http 的 SSE 流式数据功能，包括事件监听、连接管理、错误处理等',
    defaultConfig: {
      url: 'https://httpbin.org/stream/10',
      timeout: 30000,
      expectedEvents: 10,
    },
  },
}

/** 获取页面配置 */
export function getPageConfig(pagePath: string): PageRefactorConfig | undefined {
  return pageConfigs[pagePath]
}

/** 创建集成的测试页面组件属性 */
export function createIntegratedPageProps(pagePath: string) {
  const module = getModuleByPagePath(pagePath)
  const config = getPageConfig(pagePath)

  if (!module || !config) {
    throw new Error(`未找到页面 ${pagePath} 的模块或配置`)
  }

  return {
    module,
    ...config,
  }
}

/** 重构指南 */
export const refactorGuide = {
  steps: [
    '1. 导入 TestModuleRunner 组件和对应的测试模块',
    '2. 使用 createIntegratedPageProps 获取页面属性',
    '3. 将原有的测试逻辑替换为 TestModuleRunner 组件',
    '4. 保留原有的手动测试功能作为可选项',
    '5. 添加模式切换按钮（自动测试 vs 手动测试）',
  ],

  benefits: [
    '✅ 统一的测试界面和体验',
    '✅ 可复用的测试逻辑',
    '✅ 详细的测试报告和日志',
    '✅ 标准化的错误处理',
    '✅ 更好的可维护性',
    '✅ 保留原有功能的同时增强测试能力',
  ],

  example: `
// 重构前
export default function HttpBasicTest() {
  // 大量的状态管理和测试逻辑
  return <div>...</div>
}

// 重构后
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'

export default function HttpBasicTest() {
  const [showManualTest, setShowManualTest] = useState(false)
  const props = createIntegratedPageProps('http-basic')
  
  if (!showManualTest) {
    return <TestModuleRunner {...props} />
  }
  
  // 保留原有的手动测试功能
  return <div>手动测试界面...</div>
}
  `,
}

/** 验证页面是否可以重构 */
export function canRefactorPage(pagePath: string): boolean {
  return !!(getModuleByPagePath(pagePath) && getPageConfig(pagePath))
}

/** 获取可重构的页面列表 */
export function getRefactorablePages(): string[] {
  return Object.keys(pageModuleMapping)
}

/** 重构统计信息 */
export function getRefactorStats() {
  const totalPages = Object.keys(pageModuleMapping).length
  const availableModulesCount = Object.keys(availableModules).length
  const configuredPages = Object.keys(pageConfigs).length

  return {
    totalPages,
    availableModulesCount,
    configuredPages,
    refactorProgress: (configuredPages / totalPages) * 100,
  }
}
