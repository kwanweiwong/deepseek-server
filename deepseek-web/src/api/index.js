// 导入封装好的 Axios 实例
import request from './request'

// ==================== 认证相关 API ====================
export const authApi = {
  /**
   * 用户注册
   * @param {Object} data - 注册数据
   * @param {string} data.username - 用户名
   * @param {string} data.email - 邮箱
   * @param {string} data.password - 密码
   * @returns {Promise} 返回注册结果，包含 token 和用户信息
   */
  register(data) {
    return request.post('/auth/register', data)
  },

  /**
   * 用户登录
   * @param {Object} data - 登录数据
   * @param {string} data.email - 邮箱
   * @param {string} data.password - 密码
   * @returns {Promise} 返回登录结果，包含 token 和用户信息
   */
  login(data) {
    return request.post('/auth/login', data)
  },

  /**
   * 获取当前登录用户的信息
   * @returns {Promise} 返回用户详细信息
   */
  getProfile() {
    return request.get('/auth/profile')
  }
}

// ==================== 对话管理相关 API ====================
export const conversationApi = {
  /**
   * 获取当前用户的所有对话列表
   * @returns {Promise} 返回对话数组，按创建时间倒序排列
   */
  getAll() {
    return request.get('/conversations')
  },

  /**
   * 创建新对话
   * @param {Object} data - 对话数据
   * @param {string} [data.title] - 对话标题（可选，默认"新对话"）
   * @returns {Promise} 返回创建的对话信息
   */
  create(data) {
    return request.post('/conversations', data)
  },

  /**
   * 根据 ID 获取单个对话及其消息历史
   * @param {number|string} id - 对话 ID
   * @returns {Promise} 返回对话详情和消息列表
   */
  getById(id) {
    return request.get(`/conversations/${id}`)
  },

  /**
   * 更新指定对话标题
   * @param {number|string} id - 对话 ID
   * @param {Object} data - 更新数据
   * @param {string} data.title - 新标题
   * @returns {Promise} 返回更新结果
   */
  update(id, data) {
    return request.put(`/conversations/${id}`, data)
  },

  /**
   * 删除指定对话
   * @param {number|string} id - 对话 ID
   * @returns {Promise} 返回删除结果
   */
  delete(id) {
    return request.delete(`/conversations/${id}`)
  }
}

// ==================== 知识库管理相关 API ====================
export const knowledgeApi = {
  /**
   * 获取当前用户的所有知识库文档
   * @returns {Promise} 返回文档数组
   */
  getAll() {
    return request.get('/knowledge')
  },

  /**
   * 添加文档到知识库
   * @param {Object} data - 文档数据
   * @param {string} data.title - 文档标题
   * @param {string} data.content - 文档内容
   * @param {string} [data.docType] - 文档类型（可选，默认 text）
   * @returns {Promise} 返回添加结果
   */
  add(data) {
    return request.post('/knowledge', data)
  },

  /**
   * 更新知识库文档
   * @param {number|string} id - 文档 ID
   * @param {Object} data - 更新数据
   * @param {string} data.title - 文档标题
   * @param {string} data.content - 文档内容
   * @param {string} [data.docType] - 文档类型（可选，默认 text）
   * @returns {Promise} 返回更新结果
   */
  update(id, data) {
    return request.put(`/knowledge/${id}`, data)
  },

  /**
   * 删除知识库文档
   * @param {number|string} id - 文档 ID
   * @returns {Promise} 返回删除结果
   */
  delete(id) {
    return request.delete(`/knowledge/${id}`)
  },

  /**
   * 搜索知识库（测试用）
   * @param {Object} data - 搜索数据
   * @param {string} data.query - 搜索关键词
   * @param {number} [data.topK] - 返回结果数量（可选，默认 3）
   * @returns {Promise} 返回搜索结果
   */
  search(data) {
    return request.post('/knowledge/search', data)
  }
}
