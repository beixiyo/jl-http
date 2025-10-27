export interface SSELog {
  id: number
  timestamp: string
  url: string
  method: string
  status: 'connecting' | 'streaming' | 'completed' | 'error' | 'cancelled'
  duration: number
  messageCount: number
  totalContent: string
  error?: string
  progress: number
}

export interface SSEMessage {
  id: number
  timestamp: string
  content: string
  jsonData?: any
  isComplete?: boolean
  type?: 'connection' | 'message' | 'complete' | 'error' | 'heartbeat'
  role?: 'user' | 'assistant' | 'system'
  progress?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  progress?: number
}
