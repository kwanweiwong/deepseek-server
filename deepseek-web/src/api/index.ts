// 导入封装好的 Axios 实例
import request from './request'
import type {
LoginRequest,
RegisterRequest,
AuthResponse,
Conversation,
Message
} from '@/types'

// ==================== 认证相关 API ====================
export const authApi = {
/**
* 用户注册
* @param data - 注册数据
* @returns 返回注册结果，包含 token 和用户信息
*/
register(data: RegisterRequest): Promise<AuthResponse> {
return request.post('/auth/register', data)
},

/**
* 用户登录
* @param data - 登录数据
* @returns 返回登录结果，包含 token 和用户信息
*/
login(data: LoginRequest): Promise<AuthResponse> {
return request.post('/auth/login', data)
},

/**
* 获取当前登录用户的信息
* @returns 返回用户详细信息
*/
getProfile(): Promise<{ user: any }> {
return request.get('/auth/profile')
}
}

// ==================== 对话管理相关 API ====================
export const conversationApi = {
/**
* 获取当前用户的所有对话列表
* @returns 返回对话数组，按创建时间倒序排列
*/
getAll(): Promise<{ conversations: Conversation[] }> {
return request.get('/conversations')
},

/**
* 创建新对话
* @param data - 对话数据
* @returns 返回创建的对话信息
*/
create(data: { title?: string }): Promise<{ conversation: Conversation }> {
return request.post('/conversations', data)
},

/**
* 根据 ID 获取单个对话及其消息历史
* @param id - 对话 ID
* @returns 返回对话详情和消息列表
*/
getById(id: number): Promise<{ conversation: Conversation; messages: Message[] }> {
return request.get(`/conversations/${id}`)
},

/**
* 更新指定对话标题
* @param id - 对话 ID
* @param data - 更新数据
* @returns 返回更新结果
*/
update(id: number, data: { title: string }): Promise<any> {
return request.put(`/conversations/${id}`, data)
},

/**
* 删除指定对话
* @param id - 对话 ID
* @returns 返回删除结果
*/
delete(id: number): Promise<any> {
return request.delete(`/conversations/${id}`)
}
}

// ==================== 知识库管理相关 API ====================
export const knowledgeApi = {
/**
* 获取当前用户的所有知识库文档
* @returns 返回文档数组
*/
getAll(): Promise<{ documents: any[] }> {
return request.get('/knowledge')
},

/**
* 添加文档到知识库
* @param data - 文档数据
* @returns 返回添加结果
*/
add(data: { title: string; content: string; docType?: string }): Promise<any> {
return request.post('/knowledge', data)
},

/**
* 更新知识库文档
* @param id - 文档 ID
* @param data - 更新数据
* @returns 返回更新结果
*/
update(id: number, data: { title: string; content: string; docType?: string }): Promise<any> {
return request.put(`/knowledge/${id}`, data)
},

/**
* 删除知识库文档
* @param id - 文档 ID
* @returns 返回删除结果
*/
delete(id: number): Promise<any> {
return request.delete(`/knowledge/${id}`)
},

/**
* 搜索知识库（测试用）
* @param data - 搜索数据
* @returns 返回搜索结果
*/
search(data: { query: string; topK?: number }): Promise<any> {
return request.post('/knowledge/search', data)
}
}
