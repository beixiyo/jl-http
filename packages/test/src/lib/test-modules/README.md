# jl-http 测试模块架构

## 概述

这是一个模块化的测试架构，用于测试 jl-http 库的各种功能。该架构提供了统一的测试接口、可复用的测试模块和详细的测试报告。

## 架构特点

### 🏗️ 模块化设计
- **职责单一**：每个测试模块专注于特定功能领域
- **可复用**：测试逻辑与UI展示分离，可在不同场景下复用
- **可扩展**：易于添加新的测试模块和测试场景

### 🔧 统一接口
- **标准化**：所有测试模块实现相同的接口
- **配置化**：支持灵活的测试配置
- **类型安全**：完整的 TypeScript 类型定义

### 📊 详细报告
- **实时状态**：实时显示测试执行状态
- **详细日志**：记录测试执行的详细过程
- **结果聚合**：提供测试结果的统计和分析

## 核心组件

### TestExecutor（测试执行器）
负责管理和执行测试模块的核心类。

**主要功能：**
- 注册和管理测试模块
- 执行单个测试、模块测试或全部测试
- 状态管理和事件通知
- 测试结果收集和报告生成

### TestModule（测试模块）
定义测试模块的标准接口。

**接口定义：**
```typescript
interface TestModule {
  id: string                    // 模块标识
  name: string                  // 模块名称
  description: string           // 模块描述
  scenarios: TestScenario[]     // 支持的测试场景
  execute: (context: TestContext) => Promise<TestResult>
  getDefaultConfig: () => Record<string, any>
  validateConfig: (config: Record<string, any>) => boolean
}
```

### TestScenario（测试场景）
定义具体的测试场景。

**场景属性：**
- `id`: 场景唯一标识
- `name`: 场景名称
- `description`: 场景描述
- `features`: 测试的功能特性
- `category`: 场景分类
- `priority`: 优先级

## 现有测试模块

### 1. basic-http（基础HTTP功能）
测试基础的 HTTP 请求方法。

**测试场景：**
- GET 获取单个资源
- GET 获取资源列表
- POST 创建资源
- PUT 更新资源
- DELETE 删除资源
- 错误处理测试

### 2. cache（缓存功能）
测试 HTTP 请求缓存功能。

**测试场景：**
- 缓存命中测试
- 缓存超时测试
- 缓存隔离测试
- 缓存方法测试

### 3. concurrent（并发请求）
测试并发请求功能。

**测试场景：**
- 基础并发测试
- 高并发测试
- 并发错误处理
- 混合请求测试

### 4. abort（请求中断）
测试请求中断功能。

**测试场景：**
- 手动中断测试
- 超时中断测试
- 多请求中断测试
- 中断恢复测试

## 使用方法

### 基本使用

```typescript
import { defaultTestExecutor } from '@/lib/test-modules'

// 执行单个测试
await defaultTestExecutor.executeTest('basic-http', 'get-single')

// 执行模块的所有测试
await defaultTestExecutor.executeModule('cache')

// 执行所有测试
const report = await defaultTestExecutor.executeAll()
```

### 状态监听

```typescript
// 订阅状态变化
const unsubscribe = defaultTestExecutor.subscribe((state) => {
  console.log('测试状态更新:', state)
})

// 取消订阅
unsubscribe()
```

### 自定义配置

```typescript
// 使用自定义配置执行测试
await defaultTestExecutor.executeTest('cache', 'cache-hit', {
  cacheTimeout: 5000,
  testUrl: '/custom/endpoint'
})
```

## 扩展指南

### 添加新的测试模块

1. **创建模块文件**
```typescript
// modules/my-module.ts
export const myModule: TestModule = {
  id: 'my-module',
  name: '我的测试模块',
  description: '测试特定功能',
  scenarios: [
    // 定义测试场景
  ],
  async execute(context) {
    // 实现测试逻辑
  },
  getDefaultConfig() {
    // 返回默认配置
  },
  validateConfig(config) {
    // 验证配置
  }
}
```

2. **注册模块**
```typescript
// index.ts
import { myModule } from './modules/my-module'

export function createTestExecutor(): TestExecutor {
  const executor = new TestExecutor()
  executor.registerModule(myModule)
  return executor
}
```

### 添加新的测试场景

在现有模块中添加新的测试场景：

```typescript
const newScenario: TestScenario = {
  id: 'new-scenario',
  name: '新测试场景',
  description: '测试新功能',
  features: ['新特性1', '新特性2'],
  category: 'advanced',
  priority: 2
}

// 在模块的 scenarios 数组中添加
// 在 execute 方法中添加对应的处理逻辑
```

## 最佳实践

### 1. 测试设计原则
- **独立性**：每个测试应该独立运行，不依赖其他测试的结果
- **可重复性**：测试结果应该是可重复的，不受外部环境影响
- **清晰性**：测试目的和预期结果应该清晰明确

### 2. 错误处理
- **优雅降级**：测试失败时应该提供有用的错误信息
- **资源清理**：确保测试结束后正确清理资源
- **超时控制**：设置合理的超时时间避免测试卡死

### 3. 日志记录
- **详细记录**：记录测试执行的关键步骤
- **分级日志**：使用不同级别的日志（info、success、warning、error）
- **结构化数据**：在日志中包含有用的结构化数据

### 4. 性能考虑
- **并发控制**：合理控制并发测试的数量
- **资源管理**：避免内存泄漏和资源浪费
- **缓存策略**：合理使用缓存提高测试效率

## 故障排除

### 常见问题

1. **测试执行失败**
   - 检查网络连接
   - 验证测试配置
   - 查看详细错误日志

2. **测试结果不一致**
   - 检查测试环境
   - 确认测试数据
   - 验证测试逻辑

3. **性能问题**
   - 检查并发设置
   - 优化测试逻辑
   - 监控资源使用

### 调试技巧

1. **启用详细日志**
2. **单独运行失败的测试**
3. **检查网络请求和响应**
4. **使用浏览器开发者工具**

## 贡献指南

欢迎贡献新的测试模块和改进建议！

1. Fork 项目
2. 创建功能分支
3. 添加测试
4. 提交 Pull Request

请确保：
- 遵循现有的代码风格
- 添加适当的测试
- 更新相关文档
- 通过所有现有测试
