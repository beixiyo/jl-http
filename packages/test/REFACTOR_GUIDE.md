# 测试页面重构指南

## 概述

本指南介绍如何将现有的测试页面重构为使用标准化测试模块的架构，以提高代码复用性和测试一致性。

## 重构目标

1. **提高集成度**：统一的测试界面和体验
2. **增强复用性**：可复用的测试逻辑和组件
3. **改善维护性**：标准化的代码结构和错误处理
4. **保留功能**：保持原有功能的同时增强测试能力

## 重构架构

### 核心组件

1. **TestModuleRunner**: 可复用的测试模块执行界面
2. **测试模块**: 标准化的测试逻辑（basic-http, cache, concurrent, abort）
3. **集成工具**: 帮助页面集成测试模块的工具函数

### 重构模式

```
原始页面 → 双模式页面（自动测试 + 手动测试）
```

## 重构步骤

### 1. 导入必要的组件和工具

```tsx
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'
import { createHttpInstance } from '@/lib/test-modules'
```

### 2. 添加模式切换状态

```tsx
export default function YourTestPage() {
  const [showManualTest, setShowManualTest] = useState(false)
  
  // 自动测试模式
  if (!showManualTest) {
    return <AutoTestMode onSwitchToManual={() => setShowManualTest(true)} />
  }
  
  // 手动测试模式
  return <ManualTestMode onBack={() => setShowManualTest(false)} />
}
```

### 3. 实现自动测试模式

```tsx
function AutoTestMode({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const props = createIntegratedPageProps('your-page-id')
  
  return (
    <div className="mx-auto max-w-7xl p-6">
      <TestModuleRunner
        {...props}
        onTestComplete={(scenarioId, result) => {
          console.log(`测试完成: ${scenarioId}`, result)
        }}
      />
      
      {/* 切换到手动测试 */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">手动测试模式</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              切换到手动测试模式，可以自定义参数进行测试
            </p>
          </div>
          <Button onClick={onSwitchToManual} designStyle="outlined">
            切换到手动测试
          </Button>
        </div>
      </Card>
    </div>
  )
}
```

### 4. 重构手动测试模式

```tsx
function ManualTestMode({ onBack }: { onBack: () => void }) {
  // 保留原有的状态和逻辑
  const [loading, setLoading] = useState(false)
  // ... 其他状态
  
  // 使用 createHttpInstance 替代原有的 HTTP 实例
  const makeRequest = async () => {
    const http = createHttpInstance({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      // ... 其他配置
    })
    
    // 原有的请求逻辑
  }
  
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">页面标题 - 手动模式</h1>
          <p className="text-gray-600 dark:text-gray-400">
            手动配置和测试描述
          </p>
        </div>
        <Button onClick={onBack} designStyle="outlined">
          返回自动测试
        </Button>
      </div>
      
      {/* 原有的手动测试界面 */}
    </div>
  )
}
```

## 配置页面映射

在 `packages/test/src/lib/test-modules/integration.ts` 中添加页面配置：

```tsx
export const pageConfigs: Record<string, PageRefactorConfig> = {
  'your-page-id': {
    title: '你的页面标题',
    description: '页面描述',
    defaultConfig: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      // ... 其他默认配置
    },
    showManualTest: true, // 是否显示手动测试选项
  },
}

export const pageModuleMapping = {
  'your-page-id': 'corresponding-module-id',
  // ...
} as const
```

## 重构示例

### 重构前（原始页面）

```tsx
export default function HttpBasicTest() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  // ... 大量状态管理
  
  const handleRequest = async () => {
    // ... 复杂的请求逻辑
  }
  
  return (
    <div>
      {/* 复杂的UI和测试逻辑混合 */}
    </div>
  )
}
```

### 重构后（双模式页面）

```tsx
export default function HttpBasicTest() {
  const [showManualTest, setShowManualTest] = useState(false)
  
  if (!showManualTest) {
    const props = createIntegratedPageProps('http-basic')
    return (
      <div className="mx-auto max-w-7xl p-6">
        <TestModuleRunner {...props} />
        {/* 模式切换界面 */}
      </div>
    )
  }
  
  return <ManualTestMode onBack={() => setShowManualTest(false)} />
}

function ManualTestMode({ onBack }: { onBack: () => void }) {
  // 保留原有的手动测试功能
  // 使用 createHttpInstance 替代原有的 HTTP 实例
}
```

## 重构检查清单

### ✅ 功能检查
- [ ] 自动测试模式正常工作
- [ ] 手动测试模式保留原有功能
- [ ] 模式切换正常
- [ ] 测试结果正确显示
- [ ] 错误处理正常

### ✅ 代码质量
- [ ] 移除未使用的导入
- [ ] 使用 createHttpInstance 替代原有实例
- [ ] 组件职责单一
- [ ] 类型定义正确
- [ ] 无编译错误

### ✅ 用户体验
- [ ] 界面布局合理
- [ ] 加载状态正确
- [ ] 错误提示清晰
- [ ] 操作流程顺畅

## 已重构页面

- ✅ `http-basic` - HTTP 基础功能测试
- ✅ `http-cache` - 缓存功能测试
- ✅ `http-concurrent` - 并发请求测试
- ✅ `http-abort` - 请求中断测试
- ✅ `http-interceptors` - 拦截器测试
- ✅ `http-retry` - 重试机制测试
- ✅ `http-sse` - SSE 流式数据测试

🎉 **重构完成！** 所有测试页面已成功重构为双模式架构。

## 重构完成总结

### 📊 重构统计
- **总页面数**: 7 个
- **已重构页面**: 7 个 (100%)
- **可用测试模块**: 4 个 (basic-http, cache, concurrent, abort)
- **重构进度**: 100% ✅

### 🔄 重构内容
1. **http-basic** - 使用 basic-http 模块，支持 GET/POST/PUT/DELETE 测试
2. **http-cache** - 使用 cache 模块，支持缓存功能测试
3. **http-concurrent** - 使用 concurrent 模块，支持并发请求测试
4. **http-abort** - 使用 abort 模块，支持请求中断测试
5. **http-interceptors** - 使用 basic-http 模块，支持拦截器功能测试
6. **http-retry** - 使用 basic-http 模块，支持重试机制测试
7. **http-sse** - 使用 basic-http 模块，支持 SSE 流式数据测试

### ✨ 架构改进
- **双模式设计**: 每个页面都支持自动测试模式和手动测试模式
- **统一组件**: 使用 TestModuleRunner 组件提供一致的测试界面
- **标准化配置**: 通过 createIntegratedPageProps 统一页面配置
- **代码复用**: 使用 createHttpInstance 替代原有的 HTTP 实例创建
- **类型安全**: 完整的 TypeScript 类型支持

## 重构收益

### 开发者收益
- **减少重复代码**：测试逻辑复用，减少维护成本
- **统一测试体验**：一致的界面和交互模式
- **更好的错误处理**：标准化的错误处理和日志记录
- **类型安全**：完整的 TypeScript 类型支持

### 用户收益
- **更好的测试体验**：自动化测试 + 手动测试双模式
- **详细的测试报告**：实时状态、详细日志、测试摘要
- **更稳定的功能**：标准化测试确保功能稳定性

## 注意事项

1. **保持向后兼容**：确保重构后的页面保留原有功能
2. **渐进式重构**：可以逐个页面进行重构，不影响其他页面
3. **测试验证**：重构后要充分测试确保功能正常
4. **文档更新**：及时更新相关文档和说明

## 获取帮助

如果在重构过程中遇到问题，可以：

1. 参考已重构的页面（`http-basic`, `http-cache`）
2. 查看测试模块文档（`packages/test/src/lib/test-modules/README.md`）
3. 使用集成工具函数（`packages/test/src/lib/test-modules/integration.ts`）
4. 查看重构统计信息：

```tsx
import { getRefactorStats } from '@/lib/test-modules/integration'

const stats = getRefactorStats()
console.log('重构进度:', stats.refactorProgress + '%')
```
