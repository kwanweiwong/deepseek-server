# DeepSeek 项目优化问题清单

---

## 严重（建议优先修复）

### 1. WebSocket 完全无鉴权
- **位置**: `deepseek-server/src/socket/index.ts`
- **描述**: Socket.io 连接不做任何身份校验，客户端可自行传入 `userId`，攻击者可读写任意用户的对话和知识库。

### 2. JWT_SECRET 未校验
- **位置**: `deepseek-server/src/controllers/auth.ts:26,61`、`deepseek-server/src/middleware/auth.ts:15`
- **描述**: JWT_SECRET 缺失时不会报错，会用字符串 `"undefined"` 签名和验证，导致所有 token 可被伪造。

### 3. CORS 全开
- **位置**: `deepseek-server/src/index.ts:20`
- **描述**: `app.use(cors())` 无参数，允许任意来源跨域请求。

### 4. 聊天记录无限加载
- **位置**: `deepseek-server/src/socket/index.ts:26`、`deepseek-server/src/models/message.ts:36`
- **描述**: 每次发消息都查全量历史送进 LLM，无 LIMIT 限制，消息多了会撑爆 context window。

---

## 重要

### 5. 双重 API 调用
- **位置**: `deepseek-server/src/services/deepseek.ts:252,301`
- **描述**: 每条消息先非流式调一次检测 tool call，再流式调一次生成回复。大部分情况第一次调用是浪费，延迟翻倍。

### 6. SSE 流解析不完整
- **位置**: `deepseek-server/src/services/deepseek.ts:318-337`
- **描述**: 按换行分割 SSE chunk，但 TCP 分包可能导致一行被截断，content 丢失。

### 7. MySQL 和向量库无事务
- **位置**: `deepseek-server/src/routes/knowledge.ts:34-49`
- **描述**: 文档添加时分三步（MySQL insert → 向量库 insert → MySQL update chunk_count），中途失败会导致数据不一致。

### 8. 缺少关键数据库索引
- **位置**: `deepseek-server/src/init-db.ts`
- **描述**: `conversations.user_id`、`messages.conversation_id`、`users.email` 均无索引，随数据增长性能会持续下降。

### 9. 前端 Socket.io 端口不一致
- **位置**: `deepseek-web/src/stores/chat.ts:28`
- **描述**: Socket 连接地址硬编码，与后端端口不一致时直接断连。

### 10. bigram 回退扫描全量
- **位置**: `deepseek-server/src/services/vectorDB.ts:183-203`
- **描述**: 无 OPENAI_API_KEY 时，RAG 回退到遍历全部文档做 bigram 匹配，O(n) 复杂度，文档多了会非常慢。

---

## 一般

### 11. Token 存 localStorage
- **位置**: `deepseek-web/src/stores/user.ts:27-28`
- **描述**: JWT 存在 localStorage，XSS 攻击可直接窃取。推荐使用 httpOnly cookie。

### 12. 删除对话无确认弹窗
- **位置**: `deepseek-web/src/components/Sidebar.vue:177-179`
- **描述**: 点击删除对话直接执行，无二次确认，误触即丢失。

### 13. 聊天错误无用户提示
- **位置**: `deepseek-web/src/stores/chat.ts:52-55`
- **描述**: 聊天出错只 console.error，不通知用户；流式残留消息也不清理。

### 14. 导入语句散落在文件中间
- **位置**: `deepseek-server/src/index.ts:25-28,37`
- **描述**: import 写在文件中间而非顶部，不符合规范。

### 15. 多处重复 dotenv.config()
- **位置**: `deepseek-server/src/` 下 5 个文件
- **描述**: index.ts、deepseek.ts、vectorDB.ts、auth.ts、auth middleware 各自调用 dotenv.config()，只有入口调用有效。

### 16. v-for 用 index 做 key
- **位置**: `deepseek-web/src/views/ChatView.vue:15`
- **描述**: 消息列表用 index 做 key，列表变化时 Vue 可能复用错误 DOM 导致渲染异常。

### 17. MarkdownIt 每个消息组件都 new 一次
- **位置**: `deepseek-web/src/components/ChatMessage.vue:36`
- **描述**: 每条消息创建一个 MarkdownIt 实例，应设为模块级单例。

### 18. 注册全部 Element Plus 图标
- **位置**: `deepseek-web/src/main.ts:13-15`
- **描述**: 全局注册数百个图标组件，增加打包体积和启动时间。

### 19. 无移动端适配
- **位置**: 全局 CSS/布局
- **描述**: 所有布局使用固定像素宽度，无响应式断点，移动端不可用。

### 20. 未使用的 deleteByConversationId 方法
- **位置**: `deepseek-server/src/models/message.ts:47-49`
- **描述**: 方法定义但未调用（已由 FK ON DELETE CASCADE 自动处理）。

### 21. 输入校验不足
- **位置**: `deepseek-server/src/controllers/auth.ts:12-16`、`deepseek-server/src/routes/knowledge.ts:23-32`
- **描述**: 注册无邮箱格式校验、密码强度校验；知识库文档无标题/内容长度限制，可插入超大文档。

### 22. NaN 解析未处理
- **位置**: `deepseek-server/src/routes/knowledge.ts:71`
- **描述**: `parseInt(req.params.id)` 对非数字返回 NaN，传给 SQL 查询行为不可预期。

### 23. Controller 模式不一致
- **位置**: `deepseek-server/src/routes/knowledge.ts`
- **描述**: auth 和 conversation 路由用独立 controller，knowledge 路由把 handler 全写路由文件里。

---

## 补充说明

- **无上下文窗口管理**: 没有对发送给 LLM 的消息做 token 截断，长对话迟早超限。
- **无请求超时**: DeepSeek API 调用没设 timeout，API 挂起时整个 WebSocket 连接卡死。
- **单例难测试**: DeepSeekService 和 vectorDB 都是模块级单例 + 直接读 process.env，无法注入 mock 做单元测试。
- **无 API 限流**: 没有任何频率限制，容易被滥用。
