/**
 * 测试模块入口文件
 */

/**
 * 导出类型
 * 创建默认的测试执行器实例
 */
import { TestExecutor } from './executor'
import { abortModule } from './modules/abort'
import { basicHttpModule } from './modules/basic-http'
import { cacheModule } from './modules/cache'
import { concurrentModule } from './modules/concurrent'

/** 导出核心类 */
export { TestExecutor } from './executor'

/** 导出辅助工具 */
export * from './helpers'

export { abortModule } from './modules/abort'

/** 导出测试模块 */
export { basicHttpModule } from './modules/basic-http'

export { cacheModule } from './modules/cache'
export { concurrentModule } from './modules/concurrent'
export * from './types'
/** 导出工具函数 */
export * from './utils'

/** 创建并配置默认的测试执行器 */
export function createTestExecutor(): TestExecutor {
  const executor = new TestExecutor()

  /** 注册所有测试模块 */
  executor.registerModule(basicHttpModule)
  executor.registerModule(cacheModule)
  executor.registerModule(concurrentModule)
  executor.registerModule(abortModule)

  return executor
}

/** 默认测试执行器实例 */
export const defaultTestExecutor = createTestExecutor()
