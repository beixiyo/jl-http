import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/Input/NumberInput'
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { basicHttpModule, createHttpInstance } from '@/lib/test-modules'

export default function HttpBasicTest() {
  const [showManualTest, setShowManualTest] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [url, setUrl] = useState('/posts/1')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET')
  const [requestBody, setRequestBody] = useState('{"title": "测试标题", "body": "测试内容", "userId": 1}')
  const [timeout, setTimeoutValue] = useState(5000)
  const [respType, setRespType] = useState<'json' | 'text' | 'blob'>('json')

  const handleRequest = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const http = createHttpInstance({
        baseUrl: 'https://jsonplaceholder.typicode.com',
        timeout,
      })

      let response
      const config = {
        timeout,
        respType,
      }

      switch (method) {
        case 'GET':
          response = await http.get(url, config)
          break
        case 'POST':
          response = await http.post(url, JSON.parse(requestBody || '{}'), config)
          break
        case 'PUT':
          response = await http.put(url, JSON.parse(requestBody || '{}'), config)
          break
        case 'DELETE':
          response = await http.delete(url, JSON.parse(requestBody || '{}'), config)
          break
      }

      setResult(response)
    }
    catch (err: any) {
      setError(err.message || '请求失败')
    }
    finally {
      setLoading(false)
    }
  }

  const testCases = [
    {
      name: 'GET 获取单个文章',
      method: 'GET' as const,
      url: '/posts/1',
      body: '',
    },
    {
      name: 'GET 获取所有文章',
      method: 'GET' as const,
      url: '/posts',
      body: '',
    },
    {
      name: 'POST 创建文章',
      method: 'POST' as const,
      url: '/posts',
      body: '{"title": "新文章标题", "body": "新文章内容", "userId": 1}',
    },
    {
      name: 'PUT 更新文章',
      method: 'PUT' as const,
      url: '/posts/1',
      body: '{"id": 1, "title": "更新的标题", "body": "更新的内容", "userId": 1}',
    },
    {
      name: 'DELETE 删除文章',
      method: 'DELETE' as const,
      url: '/posts/1',
      body: '',
    },
  ]

  const loadTestCase = (testCase: typeof testCases[0]) => {
    setMethod(testCase.method)
    setUrl(testCase.url)
    setRequestBody(testCase.body)
  }

  if (!showManualTest) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <TestModuleRunner
          module={basicHttpModule}
          title="HTTP 基础功能测试"
          description="使用标准化测试模块测试 jl-http 的基础 HTTP 请求功能，包括 GET、POST、PUT、DELETE 等方法"
          defaultConfig={{
            baseUrl: 'https://jsonplaceholder.typicode.com',
            timeout: 10000,
            retry: 2,
          }}
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
                切换到手动测试模式，可以自定义请求参数进行测试
              </p>
            </div>
            <Button
              onClick={() => setShowManualTest(true)}
              designStyle="outlined"
            >
              切换到手动测试
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">HTTP 基础功能测试 - 手动模式</h1>
          <p className="text-gray-600 dark:text-gray-400">
            手动配置和测试 jl-http 的基础 HTTP 请求功能
          </p>
        </div>
        <Button
          onClick={() => setShowManualTest(false)}
          designStyle="outlined"
        >
          返回自动测试
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 配置面板 */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">请求配置</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">请求方法</label>
              <Select
                value={ method }
                onChange={ value => setMethod(value as any) }
                options={ [
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                  { label: 'PUT', value: 'PUT' },
                  { label: 'DELETE', value: 'DELETE' },
                ] }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">请求 URL</label>
              <Input
                value={ url }
                onChange={ setUrl }
                placeholder="输入请求路径"
              />
            </div>

            {(method === 'POST' || method === 'PUT' || method === 'DELETE') && (
              <div>
                <label className="mb-2 block text-sm font-medium">请求体 (JSON)</label>
                <textarea
                  value={ requestBody }
                  onChange={ e => setRequestBody(e.target.value) }
                  className="h-24 w-full resize-none border rounded-lg p-3 text-sm font-mono"
                  placeholder="输入 JSON 格式的请求体"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">超时时间 (ms)</label>
              <NumberInput
                value={ timeout }
                onChange={ setTimeoutValue }
                placeholder="超时时间"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">响应类型</label>
              <Select
                value={ respType }
                onChange={ value => setRespType(value as any) }
                options={ [
                  { label: 'JSON', value: 'json' },
                  { label: 'Text', value: 'text' },
                  { label: 'Blob', value: 'blob' },
                ] }
              />
            </div>

            <Button
              onClick={ handleRequest }
              loading={ loading }
              className="w-full"
            >
              发送请求
            </Button>
          </div>
        </Card>

        {/* 结果面板 */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">响应结果</h2>

          <div className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin border-b-2 border-blue-500 rounded-full"></div>
                <span className="ml-2">请求中...</span>
              </div>
            )}

            {error && (
              <div className="border border-red-200 rounded-lg bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <h3 className="mb-2 text-red-800 font-medium dark:text-red-200">请求失败</h3>
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              </div>
            )}

            {result && (
              <div className="border border-green-200 rounded-lg bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <h3 className="mb-2 text-green-800 font-medium dark:text-green-200">请求成功</h3>
                <pre className="max-h-64 overflow-auto text-sm text-green-600 dark:text-green-300">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 快速测试用例 */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">快速测试用例</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 md:grid-cols-2">
          {testCases.map((testCase, index) => (
            <Button
              key={ index }
              designStyle="outlined"
              onClick={ () => loadTestCase(testCase) }
              className="justify-start text-left"
            >
              <div>
                <div className="font-medium">{testCase.name}</div>
                <div className="text-sm text-gray-500">
                  {testCase.method}
                  {' '}
                  {testCase.url}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </Card>

      {/* 功能说明 */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">功能说明</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>支持多种 HTTP 方法</strong>
              ：GET、POST、PUT、DELETE 等
            </li>
            <li>
              <strong>灵活的配置选项</strong>
              ：超时时间、响应类型、请求头等
            </li>
            <li>
              <strong>自动错误处理</strong>
              ：网络错误、超时错误、HTTP 状态码错误
            </li>
            <li>
              <strong>拦截器支持</strong>
              ：请求拦截器、响应拦截器、错误拦截器
            </li>
            <li>
              <strong>TypeScript 支持</strong>
              ：完整的类型定义和类型推断
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
