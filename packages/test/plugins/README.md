# SSE 插件说明

这个插件为 Vite 开发服务器提供了模拟的 SSE (Server-Sent Events) 接口，用于测试 jl-http 库的 SSE 功能。

## 可用的 SSE 接口

### 1. 基础数据流 - `/api/sse/stream`
- **方法**: GET
- **描述**: 发送 10 条基础消息，每秒一条
- **数据格式**: JSON
- **示例响应**:
```json
{"type": "connected", "message": "SSE 连接已建立"}
{"id": 1, "type": "message", "content": "这是第 1 条消息", "timestamp": "2024-01-01T00:00:00.000Z", "progress": 0.1}
```

### 2. 聊天对话流 - `/api/sse/chat`
- **方法**: POST
- **描述**: 模拟 AI 聊天的流式回复，逐字符发送
- **请求体**: `{"message": "你的问题"}`
- **数据格式**: JSON
- **示例响应**:
```json
{"type": "start", "message": "开始生成回复"}
{"type": "delta", "content": "针", "index": 0, "total": 100, "progress": 0.01}
{"type": "finish", "message": "回复生成完成"}
```

### 3. 计数器流 - `/api/sse/counter`
- **方法**: GET
- **描述**: 发送计数器数据
- **查询参数**:
  - `max`: 最大计数值 (默认: 20)
  - `interval`: 发送间隔毫秒 (默认: 500)
- **示例**: `/api/sse/counter?max=20&interval=500`
- **数据格式**: JSON
- **示例响应**:
```json
{"count": 1, "max": 20, "percentage": 5, "timestamp": 1640995200000}
```

### 4. 随机数据流 - `/api/sse/random`
- **方法**: GET
- **描述**: 发送随机传感器数据，模拟物联网设备
- **数据格式**: JSON
- **示例响应**:
```json
{
  "id": 1,
  "value": 0.7234567,
  "temperature": 25,
  "humidity": 65,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "streaming"
}
```

## 特性

- ✅ 支持 CORS，可以从前端直接访问
- ✅ 自动处理客户端断开连接
- ✅ 标准的 SSE 格式输出
- ✅ 支持 GET 和 POST 请求
- ✅ 可配置的参数
- ✅ 错误处理

## 使用方法

1. 启动开发服务器: `pnpm dev`
2. 访问 SSE 测试页面: `http://localhost:5173/http-sse`
3. 选择预设的 SSE 端点或输入自定义 URL
4. 点击"开始连接"按钮测试

## 技术实现

插件使用 Vite 的 `configureServer` 钩子来添加中间件，处理 SSE 请求：

- 设置正确的 SSE 响应头
- 使用 `setInterval` 模拟数据流
- 监听客户端断开连接事件
- 支持 CORS 预检请求

## 注意事项

- 这些接口仅在开发环境中可用
- 生产环境需要实现真实的 SSE 服务器
- 所有接口都会自动在数据流结束时发送 `[DONE]` 信号
