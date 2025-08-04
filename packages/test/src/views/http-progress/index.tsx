import { useState, useRef } from 'react'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { NumberInput } from '@/components/Input'
import { ProgressBar } from '@/components/Progress'
import { Message } from '@/components/Message'

export default function HttpProgressTest() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadInfo, setDownloadInfo] = useState<{
    totalSize: number
    downloadedSize: number
    speed: number
    estimatedTime: number
  } | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  // 配置参数
  const [totalSize, setTotalSize] = useState(10240) // 10KB
  const [chunkSize, setChunkSize] = useState(1024) // 1KB
  const [delay, setDelay] = useState(200) // 200ms

  const abortControllerRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const calculateSpeed = (downloadedBytes: number, elapsedTime: number): number => {
    if (elapsedTime === 0) return 0
    return downloadedBytes / (elapsedTime / 1000) // bytes per second
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}秒`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}分${remainingSeconds}秒`
  }

  const startDownload = async () => {
    setLoading(true)
    setProgress(0)
    setDownloadInfo(null)
    setError(null)
    setResult(null)
    setLogs([])

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()
    startTimeRef.current = Date.now()

    addLog(`开始下载数据...`)
    addLog(`总大小: ${formatBytes(totalSize)}, 块大小: ${formatBytes(chunkSize)}, 延迟: ${delay}ms`)

    try {
      const url = `/api/mock/progress?size=${totalSize}&chunkSize=${chunkSize}&delay=${delay}`

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : totalSize

      addLog(`服务器返回 Content-Length: ${formatBytes(total)}`)

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      let downloadedBytes = 0
      let chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          addLog('数据传输完成')
          break
        }

        if (value) {
          chunks.push(value)
          downloadedBytes += value.length

          const currentProgress = Math.round((downloadedBytes / total) * 100)
          setProgress(currentProgress)

          const elapsedTime = Date.now() - startTimeRef.current
          const speed = calculateSpeed(downloadedBytes, elapsedTime)
          const remainingBytes = total - downloadedBytes
          const estimatedTime = speed > 0 ? remainingBytes / speed : 0

          setDownloadInfo({
            totalSize: total,
            downloadedSize: downloadedBytes,
            speed,
            estimatedTime
          })

          addLog(`接收数据块: ${formatBytes(value.length)}, 总进度: ${currentProgress}% (${formatBytes(downloadedBytes)}/${formatBytes(total)})`)
        }
      }

      // 合并所有数据块
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }

      const finalData = new TextDecoder().decode(result)
      setResult(finalData)

      const totalTime = (Date.now() - startTimeRef.current) / 1000
      addLog(`✅ 下载完成! 总用时: ${formatTime(totalTime)}, 平均速度: ${formatSpeed(downloadedBytes / totalTime)}`)

      Message.success('数据下载完成!')

    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog('❌ 下载已取消')
        Message.warning('下载已取消')
      } else {
        const errorMsg = error instanceof Error ? error.message : '未知错误'
        setError(errorMsg)
        addLog(`❌ 下载失败: ${errorMsg}`)
        Message.error('下载失败: ' + errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      addLog('正在取消下载...')
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* 页头 */ }
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">HTTP 进度下载测试</h1>
        <p className="text-gray-600 dark:text-gray-400">
          测试带有 Content-Length 的分块数据传输和进度监控
        </p>
      </div>

      {/* 配置区域 */ }
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">下载配置</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium">
              总大小 (bytes)
            </label>
            <NumberInput
              value={ totalSize }
              onChange={ setTotalSize }
              disabled={ loading }
              placeholder="10240"
            />
            <p className="mt-1 text-xs text-gray-500">
              当前: { formatBytes(totalSize) }
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              块大小 (bytes)
            </label>
            <NumberInput
              value={ chunkSize }
              onChange={ setChunkSize }
              disabled={ loading }
              placeholder="1024"
            />
            <p className="mt-1 text-xs text-gray-500">
              当前: { formatBytes(chunkSize) }
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              延迟 (ms)
            </label>
            <NumberInput
              value={ delay }
              onChange={ setDelay }
              disabled={ loading }
              placeholder="200"
            />
            <p className="mt-1 text-xs text-gray-500">
              每块间隔时间
            </p>
          </div>
        </div>
      </Card>

      {/* 控制区域 */ }
      <Card className="mb-6 p-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={ startDownload }
            disabled={ loading }
          >
            { loading ? '下载中...' : '开始下载' }
          </Button>

          { loading && (
            <Button
              onClick={ cancelDownload }
              designStyle="outlined"
              variant={ 'danger' }
            >
              取消下载
            </Button>
          ) }

          <Button
            onClick={ clearLogs }
            designStyle="outlined"
            disabled={ loading }
            variant={ 'danger' }
          >
            清空日志
          </Button>
        </div>
      </Card>

      {/* 进度显示 */ }
      { (loading || progress > 0) && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-xl font-semibold">下载进度</h2>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">进度</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                { progress }%
              </span>
            </div>
            <ProgressBar value={ progress / 100 } />
          </div>

          { downloadInfo && (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="font-medium text-gray-600 dark:text-gray-400">已下载</div>
                <div className="text-lg font-semibold">
                  { formatBytes(downloadInfo.downloadedSize) }
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 dark:text-gray-400">总大小</div>
                <div className="text-lg font-semibold">
                  { formatBytes(downloadInfo.totalSize) }
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 dark:text-gray-400">下载速度</div>
                <div className="text-lg font-semibold">
                  { formatSpeed(downloadInfo.speed) }
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 dark:text-gray-400">预计剩余</div>
                <div className="text-lg font-semibold">
                  { downloadInfo.estimatedTime > 0 ? formatTime(downloadInfo.estimatedTime) : '--' }
                </div>
              </div>
            </div>
          ) }
        </Card>
      ) }

      {/* 错误显示 */ }
      { error && (
        <Card className="mb-6 border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h2 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-400">
            错误信息
          </h2>
          <p className="text-red-600 dark:text-red-300">{ error }</p>
        </Card>
      ) }

      {/* 结果显示 */ }
      { result && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-xl font-semibold">下载结果</h2>
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            数据大小: { formatBytes(new Blob([result]).size) }
          </div>
          <div className="max-h-40 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs dark:bg-gray-800">
            { result.length > 500 ? (
              <>
                <div>前 250 个字符:</div>
                <div className="mb-2 text-gray-600 dark:text-gray-400">
                  { result.substring(0, 250) }
                </div>
                <div>... (省略 { result.length - 500 } 个字符) ...</div>
                <div>后 250 个字符:</div>
                <div className="text-gray-600 dark:text-gray-400">
                  { result.substring(result.length - 250) }
                </div>
              </>
            ) : (
              result
            ) }
          </div>
        </Card>
      ) }

      {/* 日志区域 */ }
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">下载日志</h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            { logs.length } 条记录
          </span>
        </div>

        <div className="max-h-60 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs dark:bg-gray-800">
          { logs.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400">
              暂无日志记录
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={ index } className="mb-1">
                { log }
              </div>
            ))
          ) }
        </div>
      </Card>
    </div>
  )
}