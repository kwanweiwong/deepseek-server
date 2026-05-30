// 用户相关类型
export interface User {
  id: number
  username: string
  email: string
  created_at?: string
}

export interface UserState {
  user: User | null
  token: string | null
}

// 对话相关类型
export interface Conversation {
  id: number
  user_id: number
  title: string
  created_at: string
  updated_at?: string
}

export interface Message {
  id?: number
  conversation_id?: number
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
  created_at?: string
}

// 模型配置
export interface Model {
  value: string
  label: string
  description: string
}

// API 响应类型
export interface ApiResponse<T = any> {
  success?: boolean
  message?: string
  data?: T
  error?: string
}

// 认证相关
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
}

// Socket.IO 事件类型
export interface ChatMessageEvent {
  conversationId: number
  userId: number | undefined
  message: string
  model: string
  useRAG: boolean
}

export interface ChatChunkEvent {
  conversationId: number
  chunk: string
}

export interface ChatCompleteEvent {
  conversationId: number
  content: string
}

export interface ChatErrorEvent {
  message: string
}

// 知识库相关
export interface Document {
  id?: number
  user_id: number
  content: string
  metadata?: Record<string, any>
  created_at?: string
}

export interface SearchResult {
  content: string
  metadata?: Record<string, any>
  score?: number
}
