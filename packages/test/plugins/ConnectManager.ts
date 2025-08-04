import type { ServerResponse, IncomingMessage } from 'http'

export class ConnectionManager {
  private connections = new Map<string, {
    res: ServerResponse<IncomingMessage>
    req: IncomingMessage
    heartbeatTimer?: NodeJS.Timeout
    dataTimer?: NodeJS.Timeout
    timeoutTimer?: NodeJS.Timeout
    createdAt: number
    lastActivity: number
  }>()

  private readonly CONNECTION_TIMEOUT = 5 * 60 * 1000 // 5分钟超时

  addConnection(id: string, req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
    const now = Date.now()

    // 设置连接超时定时器
    const timeoutTimer = setTimeout(() => {
      console.log(`[SSE] 连接超时，自动清理: ${id}`)
      this.removeConnection(id)
    }, this.CONNECTION_TIMEOUT)

    this.connections.set(id, {
      req,
      res,
      createdAt: now,
      lastActivity: now,
      timeoutTimer
    })
    console.log(`[SSE] 新连接建立: ${id}, 当前连接数: ${this.connections.size}`)
  }

  // 更新连接活动时间
  updateActivity(id: string) {
    const conn = this.connections.get(id)
    if (conn) {
      conn.lastActivity = Date.now()

      // 重置超时定时器
      if (conn.timeoutTimer) {
        clearTimeout(conn.timeoutTimer)
      }
      conn.timeoutTimer = setTimeout(() => {
        console.log(`[SSE] 连接超时，自动清理: ${id}`)
        this.removeConnection(id)
      }, this.CONNECTION_TIMEOUT)
    }
  }

  removeConnection(id: string) {
    const conn = this.connections.get(id)
    if (conn) {
      // 清理所有定时器
      if (conn.heartbeatTimer) {
        clearInterval(conn.heartbeatTimer)
        conn.heartbeatTimer = undefined
      }
      if (conn.dataTimer) {
        clearInterval(conn.dataTimer)
        conn.dataTimer = undefined
      }
      if (conn.timeoutTimer) {
        clearTimeout(conn.timeoutTimer)
        conn.timeoutTimer = undefined
      }

      // 安全关闭响应 - 修复 SSE 连接关闭逻辑
      if (!conn.res.destroyed) {
        try {
          // 对于 SSE 连接，即使 headersSent 为 true 也需要关闭
          if (!conn.res.writableEnded) {
            conn.res.end()
          }
        } catch (error) {
          console.error(`[SSE] 关闭连接时出错: ${error}`)
        }
      }

      this.connections.delete(id)
      console.log(`[SSE] 连接已断开: ${id}, 剩余连接数: ${this.connections.size}`)
    }
  }

  getConnection(id: string) {
    return this.connections.get(id)
  }

  getAllConnections() {
    return Array.from(this.connections.entries())
  }

  // 清理所有连接
  cleanup() {
    for (const [id] of this.connections) {
      this.removeConnection(id)
    }
  }
}