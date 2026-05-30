import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

// 创建 Axios 实例，配置基础 URL 和请求超时时间
const request: AxiosInstance = axios.create({
baseURL: '/api',
timeout: 30000
})

// 添加请求拦截器：在发送请求前自动从 localStorage 获取 token 并添加到请求头中
request.interceptors.request.use(
(config: InternalAxiosRequestConfig) => {
const token = localStorage.getItem('token')
if (token && config.headers) {
config.headers.Authorization = `Bearer ${token}`
}
return config
},
(error: AxiosError) => {
return Promise.reject(error)
}
)

// 添加响应拦截器：统一处理响应数据和错误情况
// 成功时直接返回 response.data，简化调用方取值逻辑
// 失败时根据状态码进行差异化处理：401 表示未授权，清除本地存储并跳转登录页；其他错误显示通用或后端返回的错误消息
request.interceptors.response.use(
(response) => {
return response.data
},
(error: AxiosError<{ message?: string }>) => {
if (error.response?.status === 401) {
localStorage.removeItem('token')
localStorage.removeItem('user')
window.location.href = '/login'
ElMessage.error('登录已过期，请重新登录')
} else {
ElMessage.error(error.response?.data?.message || error.message || '请求失败')
}
return Promise.reject(error)
}
)

export default request
