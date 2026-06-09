# RAG 全流程技术详解

整个 RAG 管道分为 **三大阶段**：文档入库 → 开启知识库开关 → 知识增强对话。

---

## 阶段一：文档入库（添加 RAG 文档）

### 1.1 前端触发：`KnowledgeManager.vue` → `saveDocument()`

文件：`deepseek-web/src/components/KnowledgeManager.vue:129-151`

用户填写标题、类型（text/doc）、内容后点击"添加"按钮，`saveDocument()` 被调用：

```ts
// 第129行
async function saveDocument() {
  if (!formData.value.title || !formData.value.content) {
    ElMessage.warning('请填写标题和内容')
    return
  }
  saving.value = true
  try {
    if (isEdit.value) {
      await knowledgeApi.update(editingId.value, formData.value)
    } else {
      await knowledgeApi.add(formData.value)  // ← 初次添加走这里
    }
    showDialog.value = false
    await loadDocuments()  // 刷新列表
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '添加失败')
  }
}
```

`formData` 结构为 `{ title, docType: 'text'|'doc', content }`，通过 `knowledgeApi.add()` 发出 HTTP 请求。

### 1.2 API 层：`knowledgeApi.add()`

文件：`deepseek-web/src/api/index.ts:103-105`

```ts
add(data: { title: string; content: string; docType?: string }): Promise<any> {
  return request.post('/knowledge', data)
}
```

`request` 是 Axios 实例（`api/request.ts`），baseURL 为 `/api`，自动在请求头注入 JWT token。所以实际请求为：

> **`POST /api/knowledge`**，Header: `Authorization: Bearer <JWT>`，Body: `{ title, content, docType }`

### 1.3 后端路由：`POST /api/knowledge`

文件：`deepseek-server/src/routes/knowledge.ts:22-73`

流程如下：

**Step 1 — 参数校验（第27-32行）：**

```ts
const { title, content, docType = 'text' } = req.body
if (!title || !content) {
  return res.status(400).json({ success: false, message: '标题和内容不能为空' })
}
```

**Step 2 — MySQL 入库（第34-38行）：**

```ts
const [result] = await pool.query(
  'INSERT INTO knowledge_documents (user_id, title, doc_type, content, chunk_count) VALUES (?, ?, ?, ?, 0)',
  [req.userId, title, docType, content]
) as any[]
const docId = result.insertId  // 获取自增ID
```

此时 `chunk_count` 先填 0，后续向量化完成后回填真实值。`req.userId` 由 `authMiddleware` 从 JWT 中解析注入。

**Step 3 — 向量化入库（第40-52行）：**

```ts
try {
  const vectorResult = await vectorDB.addDocument(docId, title, content, req.userId)
  chunkCount = vectorResult.chunkCount
} catch (vectorError) {
  // 向量化失败 → 回滚MySQL记录
  await pool.query('DELETE FROM knowledge_documents WHERE id = ?', [docId])
  throw vectorError
}
```

**Step 4 — 回填块数（第54-57行）：**

```ts
await pool.query('UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?', [chunkCount, docId])
```

这里有一个**事务性保障设计**：先写 MySQL，再写向量库；如果向量库写入失败，回滚 MySQL 记录，保证两边数据一致。

### 1.4 核心：`vectorDB.addDocument()` — 文档分块、向量化、索引存储

文件：`deepseek-server/src/services/vectorDB.ts:131-163`

```ts
async function addDocument(docId: number, title: string, content: string, userId: number) {
  await initIndex()                    // ① 初始化 Vectra 索引
  const chunks = splitText(content)    // ② 文本分块

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = await getEmbedding(chunk)  // ③ 生成向量

    const item = {
      vector: embedding || [],
      metadata: {
        docId, title, chunkIndex: i,
        totalChunks: chunks.length, userId, text: chunk
      }
    }

    if (embedding) {
      await index.insertItem(item)     // ④ 写入向量索引
    } else {
      await index.insertItem({ ...item, vector: [] })
    }
  }

  return { success: true, chunkCount: chunks.length }
}
```

下面逐一拆解这四个子步骤。

---

#### ① `initIndex()` — 初始化 Vectra 本地索引（第22-27行）

```ts
async function initIndex(): Promise<void> {
  if (!(await index.isIndexCreated())) {
    await index.createIndex()
    console.log('向量数据库索引已创建:', indexPath)
  }
}
```

`indexPath` 指向项目 `deepseek-server/vectra-data/` 目录。`LocalIndex` 是 Vectra 提供的基于文件系统的轻量级向量数据库，底层使用 **HNSW（Hierarchical Navigable Small World）** 近似最近邻搜索算法。首次运行时创建索引目录，后续复用。

---

#### ② `splitText()` — 滑动窗口分块算法（第65-77行）

```ts
function splitText(text: string, chunkSize = 500, chunkOverlap = 50): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize)
    chunks.push(chunk)
    i += chunkSize - chunkOverlap  // 步长 = 500 - 50 = 450
  }
  return chunks
}
```

**算法解析**：使用 **滑动窗口 + 重叠分块** 策略：

- 每个块 500 个字符
- 相邻块之间重叠 50 个字符
- 步长 = 500 - 50 = 450 个字符

**为什么要有重叠？** 如果严格按 500 字符硬切，语义边界可能被切断（一个句子的前半段在块 A，后半段在块 B）。50 字符的重叠形成"语义缓冲区"，保证语义的连贯性，提高检索召回率。

---

#### ③ `getEmbedding()` — OpenAI Embedding API 调用（第29-55行）

```ts
async function getEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.warn('未配置 OPENAI_API_KEY，使用简单关键词匹配')
    return null  // 降级方案
  }

  const response = await axios.post(
    'https://api.openai.com/v1/embeddings',
    {
      model: 'text-embedding-3-small',  // OpenAI 最新轻量 embedding 模型
      input: text
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    }
  )

  return response.data.data[0].embedding as number[]
}
```

**技术细节**：

- 使用 OpenAI 的 `text-embedding-3-small` 模型，输出 **1536 维**浮点向量
- 该模型支持中英文，最大输入 8191 token，对于 500 字符的中文文本绰绰有余
- 如果不配置 API Key，返回 `null`，后续走 **Bigram 降级方案**

---

#### ④ `index.insertItem()` — 写入 Vectra 向量索引

每个分块的 `IndexItem` 包含：

| 字段 | 说明 |
|------|------|
| `vector` | 1536 维浮点向量，用于相似度计算 |
| `metadata.docId` | 原始文档 ID，关联 MySQL 记录 |
| `metadata.title` | 文档标题 |
| `metadata.chunkIndex` | 当前块在文档中的序号（从 0 开始） |
| `metadata.totalChunks` | 该文档的总块数 |
| `metadata.userId` | 所属用户，用于**多租户隔离** |
| `metadata.text` | 原始文本，检索时返回给 LLM |

Vectra 的 `insertItem` 将向量和元数据一起存入本地索引文件。**注意：** 存储原始 `text` 意味着检索时可以直接返回文本内容，无需回查 MySQL。

---

### 1.5 数据存储架构总结

```
┌─────────────────────────────────────────────────┐
│                   MySQL                          │
│  knowledge_documents 表                          │
│  id | user_id | title | doc_type | content       │
│     | chunk_count | created_at                   │
│  ↑ 存储原始文档，用于管理（编辑/删除/列表）      │
└─────────────────────────────────────────────────┘
                      ↕ docId 关联
┌─────────────────────────────────────────────────┐
│              Vectra Local Index                   │
│  vectra-data/ 目录                               │
│  HNSW 图索引 + 每个 chunk 的向量 + metadata       │
│  ↑ 存储向量和分块文本，用于语义检索               │
└─────────────────────────────────────────────────┘
```

---

## 阶段二：开启知识库开关

### 2.1 前端 UI：`Sidebar.vue`

文件：`deepseek-web/src/components/Sidebar.vue`

侧边栏有一个 `el-switch` 开关，绑定了 `chatStore.useRAG`：

```html
<el-switch v-model="useRAG" @change="chatStore.setUseRAG($event)" />
<span>启用知识库</span>
```

### 2.2 Store 状态：`chatStore.setUseRAG()`

文件：`deepseek-web/src/stores/chat.ts:144-146`

```ts
function setUseRAG(value: boolean): void {
  useRAG.value = value
}
```

仅修改一个 `ref<boolean>` 变量，后续发送消息时读取该值。

---

## 阶段三：RAG 增强对话（核心流程）

### 3.1 前端发送消息：`chatStore.sendMessage()`

文件：`deepseek-web/src/stores/chat.ts:118-142`

```ts
function sendMessage(message: string): void {
  // 1. 本地乐观插入用户消息
  messages.value.push({ id: nextMessageId(), role: 'user', content: message })

  // 2. 插入占位 AI 消息（用于流式追加）
  messages.value.push({ id: nextMessageId(), role: 'assistant', content: '', isStreaming: true })

  isTyping.value = true

  // 3. 通过 Socket.IO 发送到后端
  socket.value.emit('chat-message', {
    conversationId: currentConversationId.value,
    message,
    model: currentModel.value,
    useRAG: useRAG.value   // ← 关键字段
  })
}
```

Socket.IO 事件 `chat-message` 的 payload 包含 `useRAG: boolean`，后端根据此字段决定是否走 RAG 流程。

### 3.2 后端 Socket 处理：`socket/index.ts`

文件：`deepseek-server/src/socket/index.ts:37-77`

```ts
socket.on('chat-message', async (data: {
  conversationId: number; message: string; model?: string; useRAG?: boolean;
}) => {
  const { conversationId, message, model, useRAG = false } = data
  const userId = socket.data.userId

  // Step 1: 保存用户消息到 MySQL
  await MessageModel.create(conversationId, 'user', message)

  // Step 2: 获取历史消息（最近50条），格式化为 LLM 消息格式
  const historyMessages = await MessageModel.findByConversationId(conversationId, 50)
  const formattedMessages = historyMessages.map(msg => ({
    role: msg.role, content: msg.content
  }))

  // Step 3: 调用 DeepSeek 流式服务，传入 useRAG 和 userId
  let aiResponse = ''
  const stream = deepseekService.chatStream(formattedMessages, model, userId, useRAG)

  // Step 4: 逐块推送回前端
  for await (const chunk of stream) {
    aiResponse += chunk
    socket.emit('chat-chunk', { conversationId, chunk })
  }

  // Step 5: 保存完整 AI 回复
  await MessageModel.create(conversationId, 'assistant', aiResponse)

  // Step 6: 自动生成对话标题（取首条消息前30字符）
  socket.emit('chat-complete', { conversationId, content: aiResponse })
})
```

### 3.3 核心：`DeepSeekService.chatStream()` — RAG 检索与增强

文件：`deepseek-server/src/services/deepseek.ts:208-296`

这是 **整个 RAG 流程的大脑**，负责检索知识库、构建增强提示词、调用 LLM。

#### Step 1 — RAG 检索（第214-229行）

```ts
if (useRAG && userId && messages.length > 0) {
  // 找到最后一条用户消息（从尾部反向查找）
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (lastUserMessage) {
    // 用用户的问题去向量库搜索相关知识
    const searchResults = await vectorDB.searchDocuments(
      lastUserMessage.content,  // 查询文本
      userId,                    // 多租户过滤
      3                          // Top-K = 3
    )

    if (searchResults.length > 0) {
      // 将检索结果构造成 RAG 提示词
      ragPromptContent = vectorDB.buildRAGPrompt(
        lastUserMessage.content,
        searchResults
      ) || ''
    }
  }
}
```

#### Step 2 — `vectorDB.searchDocuments()` 向量检索（`vectorDB.ts:165-200`）

```ts
async function searchDocuments(query: string, userId: number, topK = 3) {
  await initIndex()

  const queryEmbedding = await getEmbedding(query)  // ① 将用户问题转为向量

  if (queryEmbedding) {
    // ② 带用户过滤的向量检索
    const filter: MetadataFilter = { userId: { '$eq': userId } }
    const results = await index.queryItems(queryEmbedding, query, topK, filter)

    return results.map(r => ({
      text: r.item.metadata.text,    // 块文本
      title: r.item.metadata.title,  // 文档标题
      score: r.score                 // 相似度分数（余弦相似度）
    }))
  } else {
    // ③ 降级方案：Bigram 字符重叠匹配
    const allItems = await index.listItems()
    const userItems = allItems.filter(item => item.metadata.userId === userId)

    const scored = userItems.map(item => ({
      item,
      score: bigramOverlapScore(query, item.metadata.text)
    }))

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => ({
        text: s.item.metadata.text,
        title: s.item.metadata.title,
        score: Math.round(s.score * 100) / 100
      }))
  }
}
```

**检索机制详解**：

1. **向量检索路径**（有 OpenAI API Key）：
   - 将用户查询 `query` 通过 `text-embedding-3-small` 转成 1536 维向量
   - 调用 `index.queryItems(queryEmbedding, topK, filter)` 在 Vectra 的 HNSW 索引中做**近似最近邻搜索**
   - `filter: { userId: { '$eq': userId } }` 保证只检索该用户的文档（多租户隔离）
   - 返回的 `score` 是**余弦相似度**，值接近 1 表示高度相关

2. **Bigram 降级路径**（无 API Key）：
   - 遍历该用户所有已索引的块
   - 使用 `bigramOverlapScore()` 计算查询与每个块的**双字符重叠率**
   - 过滤 `score > 0`，按分数降序排列，取 Top-K

**Bigram 算法原理**（`vectorDB.ts:105-119`）：

```
输入：query = "什么是RAG", text = "RAG是检索增强生成技术"
1. query的bigram集合: {"什么", "么是", "是R", "RA", "AG"}
2. text的bigram集合:  {"RA", "AG", "G是", "是检", "检索", ...}
3. 重叠: {"RA", "AG"} = 2个
4. 得分: 2/5 = 0.4
```

本质是一个**字符级的 Jaccard 相似度**近似，比纯关键词匹配更鲁棒（"RAG" 和 "RAG技术" 有重叠）。

#### Step 3 — `buildRAGPrompt()` 构建增强提示词（`vectorDB.ts:218-236`）

```ts
function buildRAGPrompt(query: string, contextDocs: { title: string; text: string; score: number }[]): string | null {
  if (!contextDocs || contextDocs.length === 0) return null

  // 将检索到的知识块格式化为"参考内容"
  const contextText = contextDocs
    .map((doc, i) => `【参考 ${i + 1}】\n标题：${doc.title}\n内容：${doc.text}`)
    .join('\n\n')

  // 返回完整的提示词模板
  return `请基于以下参考内容回答用户问题。如果参考内容中没有相关信息，请直接说明，不要编造。

【参考内容】
${contextText}

【用户问题】
${query}

请用简洁清晰的语言回答。`
}
```

**关键设计**：

- 明确指令："如果参考内容中没有相关信息，请直接说明，不要编造"——这是 **反幻觉（Anti-Hallucination）** 的核心策略
- 将检索到的知识块编号为"参考1、参考2、参考3"，让模型结构化理解
- 保留原始 `query`，模型可以结合检索内容 + 自身知识综合回答

#### Step 4 — 系统提示词组装（`deepseek.ts:232-246`）

```ts
let systemContent = `当前使用的模型是: ${modelToUse}。当前完整时间是: ${currentTimeInfo.full_datetime}。...`

if (ragPromptContent) {
  systemContent = `当前使用的模型是: ${modelToUse}。当前完整时间是: ${currentTimeInfo.full_datetime}。

你有一个知识库供参考。请优先基于【参考内容】回答用户问题，参考内容中没有的信息再结合你的知识补充。不要对参考内容中已有答案的问题调用 web_search 工具。

${ragPromptContent}`  // ← 将 RAG 提示词注入系统消息
}

const systemPrompt: ChatMessage = { role: 'system', content: systemContent }
```

**消息结构最终形态**：

```
[system]     当前模型是 deepseek-v4-pro。当前时间...
             你有一个知识库供参考。请优先基于【参考内容】回答...
             【参考1】标题：xxx  内容：xxx...
             【参考2】标题：yyy  内容：yyy...
             【参考3】标题：zzz  内容：zzz...
             【用户问题】xxx
             请用简洁清晰的语言回答。

[user]       用户的历史消息1
[assistant]  AI的历史回复1
[user]       用户的历史消息2
[assistant]  AI的历史回复2
...
[user]       当前用户问题  ← 实际最新问题
```

#### Step 5 — 流式调用 DeepSeek API

```ts
const response = await axios.post(
  'https://api.deepseek.com/v1/chat/completions',
  {
    model: modelToUse,
    messages: [systemPrompt, ...historyMessages],
    temperature: 0.7,
    tools: TOOLS,           // 支持 Function Calling (模型信息/时间/搜索)
    tool_choice: 'auto',
    stream: true             // SSE 流式响应
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    responseType: 'stream',
    timeout: 120000
  }
)
```

然后逐行解析 SSE 流：

```ts
for await (const chunk of response.data) {
  // 解析 "data: {...}" 格式的 SSE 行
  // 提取 delta.content 累积到 content 变量
  // 提取 delta.tool_calls 累积到 toolCallMap
}
yield content  // 通过 AsyncGenerator 逐块产出
```

### 3.4 前端接收流式响应

文件：`deepseek-web/src/stores/chat.ts:39-46`

```ts
socket.value.on('chat-chunk', (data: { conversationId: number; chunk: string }) => {
  if (data.conversationId === currentConversationId.value) {
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      lastMessage.content += data.chunk  // 逐块追加显示
    }
  }
})
```

前端每收到一个 `chat-chunk` 事件，就追加到 AI 消息的 `content` 中。Vue 的响应式系统自动更新 UI，实现**逐字打字效果**。

---

## 完整数据流时序图

```
用户操作              前端 Vue              后端 Express            Vectra              OpenAI              DeepSeek API
   │                    │                      │                     │                   │                     │
   │ 1.填写文档点击添加  │                      │                     │                   │                     │
   ├───────────────────>│                      │                     │                   │                     │
   │                    │ 2.POST /api/knowledge│                     │                   │                     │
   │                    ├─────────────────────>│                     │                   │                     │
   │                    │                      │ 3.MySQL INSERT      │                   │                     │
   │                    │                      │ 4.addDocument()     │                   │                     │
   │                    │                      ├────────────────────>│                   │                     │
   │                    │                      │                     │ 5.splitText()     │                     │
   │                    │                      │                     │ 6.getEmbedding()  │                     │
   │                    │                      │                     ├──────────────────>│                     │
   │                    │                      │                     │<──────────────────┤                     │
   │                    │                      │                     │  1536维向量        │                     │
   │                    │                      │                     │ 7.insertItem()    │                     │
   │                    │                      │<────────────────────┤                     │                     │
   │                    │<─────────────────────┤                     │                     │                     │
   │                    │ 8.返回成功            │                     │                     │                     │
   │                    │                      │                     │                     │                     │
   │ 9.开启知识库开关    │                      │                     │                     │                     │
   ├───────────────────>│ chatStore.useRAG=true│                     │                     │                     │
   │                    │                      │                     │                     │                     │
   │ 10.发送聊天消息     │                      │                     │                     │                     │
   ├───────────────────>│                      │                     │                     │                     │
   │                    │ 11.socket.emit       │                     │                     │                     │
   │                    │   'chat-message'     │                     │                     │                     │
   │                    ├─────────────────────>│                     │                     │                     │
   │                    │                      │ 12.searchDocuments()│                     │                     │
   │                    │                      ├────────────────────>│                     │                     │
   │                    │                      │                     │ 13.getEmbedding()  │                     │
   │                    │                      │                     ├──────────────────>│                     │
   │                    │                      │                     │<──────────────────┤                     │
   │                    │                      │                     │ 14.queryItems()    │                     │
   │                    │                      │<────────────────────┤ Top-3 chunks       │                     │
   │                    │                      │ 15.buildRAGPrompt() │                     │                     │
   │                    │                      │ 16.DeepSeek API     │                     │                     │
   │                    │                      ├──────────────────────────────────────────────────────────>│
   │                    │                      │<──────────────────────────────────────────────────────────┤
   │                    │<─────────────────────┤ SSE stream                                     │
   │                    │ 17.chat-chunk × N    │                     │                     │                     │
   │<───────────────────┤ 逐字显示              │                     │                     │                     │
   │                    │<─────────────────────┤                     │                     │                     │
   │                    │ 18.chat-complete      │                     │                     │                     │
```

---

## API 接口汇总

### 知识库管理（均需 JWT 认证）

| Method | Path | 功能 | 关键代码 |
|--------|------|------|----------|
| `GET /api/knowledge` | 获取用户所有文档 | `knowledge.ts:9-20` |
| `POST /api/knowledge` | 添加文档（含向量化） | `knowledge.ts:23-73` |
| `PUT /api/knowledge/:id` | 更新文档（删旧向量+重新索引） | `knowledge.ts:76-146` |
| `DELETE /api/knowledge/:id` | 删除文档及向量 | `knowledge.ts:149-180` |
| `POST /api/knowledge/search` | 测试搜索（返回结果+RAG提示词） | `knowledge.ts:183-206` |

### 聊天（Socket.IO）

| Event | 方向 | Payload | 关键代码 |
|-------|------|---------|----------|
| `chat-message` | 客户端→服务端 | `{ conversationId, message, model?, useRAG? }` | `socket/index.ts:37` |
| `chat-chunk` | 服务端→客户端 | `{ conversationId, chunk }` | `socket/index.ts:60` |
| `chat-complete` | 服务端→客户端 | `{ conversationId, content }` | `socket/index.ts:71` |

---

## 降级与容错机制总结

| 组件 | 正常路径 | 降级方案 |
|------|----------|----------|
| Embedding | OpenAI `text-embedding-3-small` 生成 1536 维向量 | Bigram 字符重叠匹配（无需 API） |
| 向量检索 | Vectra HNSW 近似最近邻搜索 | 全量遍历 + Bigram 打分排序 |
| 向量库写入失败 | — | 回滚 MySQL 文档记录，保证数据一致性 |
| RAG 未开启 | 直接调用 LLM，不注入知识库 | — |
| 检索无结果 | `buildRAGPrompt` 返回 null | 系统提示词中不注入 RAG 内容，正常对话 |

---

## 关键技术选型理由

1. **Vectra（而非 Chroma/Milvus/Pinecone）**：轻量级文件型向量库，零部署依赖，适合小型私有部署场景。底层 HNSW 算法在十万级向量规模下检索延迟 < 10ms。

2. **`text-embedding-3-small`（而非 `text-embedding-ada-002`）**：OpenAI 2024 年发布的新一代模型，性能更好（MTEB 基准 62.3%），价格更低（$0.02/1M token），支持维度缩减。

3. **滑动窗口重叠分块（而非语义分块）**：实现简单，500 字符 + 50 重叠是 RAG 领域的经验最佳实践，在中文场景下效果稳定。

4. **多租户隔离（MetadataFilter on userId）**：在向量检索层面就过滤掉其他用户的文档，避免检索污染和数据泄露。

---

## 涉及文件清单

| 文件 | 作用 |
|------|------|
| `deepseek-server/src/services/vectorDB.ts` | RAG 核心：分块、Embedding、向量检索、提示词构建 |
| `deepseek-server/src/services/deepseek.ts` | LLM 服务：集成 RAG 检索结果，流式调用 DeepSeek API |
| `deepseek-server/src/routes/knowledge.ts` | 知识库 CRUD API 路由 |
| `deepseek-server/src/socket/index.ts` | Socket.IO 事件处理，串联 RAG 与聊天 |
| `deepseek-server/src/middleware/auth.ts` | JWT 认证中间件 |
| `deepseek-server/src/init-db.ts` | 数据库初始化（含 `knowledge_documents` 表） |
| `deepseek-web/src/components/KnowledgeManager.vue` | 知识库管理 UI |
| `deepseek-web/src/components/Sidebar.vue` | 侧边栏（含 RAG 开关） |
| `deepseek-web/src/stores/chat.ts` | 聊天状态管理（含 RAG 开关状态和消息发送） |
| `deepseek-web/src/api/index.ts` | 前端 API 封装 |

---

## 面试问答：如何介绍这个项目亮点

### Q1: 介绍一下你这个项目的亮点功能？

**答：** 我实现了一套完整的 **RAG（检索增强生成）私有知识库问答系统**。用户上传自己的文档后，系统会自动做文本分块、向量化存储，当用户提问时，先从知识库中语义检索相关内容，再注入给大模型作为参考上下文，让 AI 基于私有知识回答，有效减少大模型的幻觉问题。

技术栈上用了 **Vectra 轻量级向量数据库**（零部署依赖，基于 HNSW 算法）+ **OpenAI text-embedding-3-small** 做向量化，整个流程从前端上传到向量检索再到 LLM 流式响应全部打通。

---

### Q2: 文档上传后经历了哪些处理？

**答：** 四步处理：

1. **MySQL 入库**：保存文档元信息（标题、内容、用户 ID）
2. **滑动窗口分块**：500 字符一块，相邻块重叠 50 字符，防止语义边界切断
3. **向量化**：每块调用 OpenAI Embedding API 转成 1536 维向量
4. **写入 Vectra 索引**：向量 + 原始文本 + 元数据（用户 ID、文档 ID）一起存入本地索引

如果向量化失败会自动回滚 MySQL 记录，保证两边数据一致。

---

### Q3: 用户提问时怎么检索相关知识的？

**答：** 采用 **嵌入相似度检索**：

1. 把用户问题同样转成 1536 维向量
2. 在 Vectra 索引中做 **HNSW 近似最近邻搜索**，同时用 `userId` 做元数据过滤实现多租户隔离
3. 返回余弦相似度最高的 Top-3 文本块

还有一个**降级方案**：如果没配 OpenAI API Key，会自动切换成 Bigram 双字符重叠匹配，不依赖任何外部 API 也能跑起来。

---

### Q4: 怎么让大模型基于检索到的知识回答？

**答：** 通过 **提示词工程**。把检索到的知识块格式化为"参考内容"，注入到 System Prompt 里，明确告诉模型"请优先基于参考内容回答，没有的信息不要编造"，这是反幻觉的核心策略。

最终发给 DeepSeek 的消息结构是：System Prompt（含检索知识）+ 历史对话 + 当前问题。整个过程对用户透明，AI 回复时看起来就像它本来就知道这些私有知识。

---

### Q5: 为什么选 Vectra 而不是 Chroma/Milvus？

**答：** Vectra 是**文件型向量数据库**，不需要额外部署服务端，启动成本为零，非常适合小型私有部署场景。底层同样是 HNSW 算法，十万级向量规模下检索延迟 < 10ms。如果以后数据量上来了，可以平滑迁移到 Milvus 等分布式方案。

---

### Q6: 多用户之间数据怎么隔离？

**答：** 两个层面：

1. **MySQL 层面**：`knowledge_documents` 表通过 `user_id` 外键关联用户
2. **向量检索层面**：Vectra 查询时带 `MetadataFilter` 按 `userId` 过滤，保证检索结果不会跨用户泄露

---

### Q7: 这个功能的技术难点在哪？

**答：** 主要有三个：

1. **分块策略**：块太大检索精度低，块太小语义不完整。500 字符 + 50 重叠是实践出的平衡点
2. **数据一致性**：MySQL 和向量库是两套存储，需要保证写入的原子性。我的方案是先写 MySQL 再写向量库，向量库失败则回滚 MySQL
3. **降级兜底**：Embedding API 不可用时不能整个功能挂掉，所以实现了 Bigram 本地匹配作为 fallback

---

## 项目 MySQL 语句全清单与语法讲解

### 数据库连接配置

文件：`deepseek-server/src/models/db.ts`

```ts
import mysql, { Pool } from 'mysql2/promise';

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'deepseek_clone',
  waitForConnections: true,   // 连接池满时排队等待而非报错
  connectionLimit: 10,        // 最大 10 个并发连接
  queueLimit: 0               // 排队不限数量
});
```

> **`mysql2/promise`**：mysql2 的 Promise 版本，所有查询返回 `[rows, fields]` 元组，可以直接 `await`，不需要回调。

---

### 一、DDL（数据定义语言）— 建库建表

#### 1.1 `CREATE DATABASE` — 创建数据库

```sql
CREATE DATABASE IF NOT EXISTS deepseek_clone
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

| 子句 | 作用 |
|------|------|
| `IF NOT EXISTS` | 防止重复创建报错 |
| `CHARACTER SET utf8mb4` | 支持完整 Unicode（含 emoji 和生僻汉字），`utf8` 只支持 3 字节，`utf8mb4` 支持 4 字节 |
| `COLLATE utf8mb4_unicode_ci` | 排序规则，`_ci` 表示 case-insensitive（不区分大小写） |

#### 1.2 `CREATE TABLE` — 用户表

```sql
CREATE TABLE IF NOT EXISTS users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| 约束 | 含义 |
|------|------|
| `PRIMARY KEY` | 主键，唯一且非空，聚簇索引 |
| `AUTO_INCREMENT` | 自增，插入时不指定则自动 +1 |
| `UNIQUE` | 唯一约束，自动创建唯一索引 |
| `NOT NULL` | 非空约束，插入时必须提供值 |
| `DEFAULT CURRENT_TIMESTAMP` | 默认值为插入时的当前时间 |
| `VARCHAR(50)` | 变长字符串，最大 50 字符（不是字节） |

> **为什么 `password_hash` 用 255？** bcrypt 输出固定 60 字符，255 留有足够余量适配其他哈希算法。

#### 1.3 `CREATE TABLE` — 会话表

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  title      VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

| 外键子句 | 含义 |
|----------|------|
| `FOREIGN KEY (user_id)` | 声明 user_id 为外键 |
| `REFERENCES users(id)` | 引用 users 表的 id 列 |
| `ON DELETE CASCADE` | 删除用户时，自动删除其所有会话 |

#### 1.4 `CREATE TABLE` — 消息表

```sql
CREATE TABLE IF NOT EXISTS messages (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  role            ENUM('user', 'assistant') NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

| 特殊类型 | 含义 |
|----------|------|
| `ENUM('user', 'assistant')` | 枚举类型，值只能是列表中的一项，插入其他值报错 |
| `TEXT` | 长文本类型，最大 65535 字节，适合存储对话内容 |

> **为什么 `content` 用 TEXT 而非 VARCHAR？** VARCHAR 最大 65535 字节（整行共享），对话内容可能很长，TEXT 独立存储，不受行大小限制。

#### 1.5 `CREATE TABLE` — 知识库文档表

```sql
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  title       VARCHAR(200) NOT NULL,
  doc_type    VARCHAR(50) DEFAULT 'text',
  content     TEXT NOT NULL,
  chunk_count INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);
```

| 新语法 | 含义 |
|--------|------|
| `DEFAULT 'text'` | 插入时不指定 doc_type 则默认为 'text' |
| `DEFAULT 0` | chunk_count 默认为 0，向量化完成后回填真实值 |
| `INDEX idx_user_id (user_id)` | 创建普通索引加速按用户查询，`idx_user_id` 是索引名 |

#### 1.6 `CREATE INDEX` — 运行时补充索引

```sql
CREATE INDEX idx_conversations_user_id ON conversations (user_id);
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_users_email ON users (email);
```

| 语法 | 含义 |
|------|------|
| `CREATE INDEX 索引名 ON 表名 (列名)` | 创建 B+ 树索引，加速 WHERE / JOIN / ORDER BY |

> **为什么要单独建索引而不是在 CREATE TABLE 里写？** 这些是补充的性能索引，用 `try/catch` 包裹，存在就跳过不报错。外键列（user_id, conversation_id）和登录查询列（email）是高频查询条件，加索引避免全表扫描。

---

### 二、DML（数据操纵语言）— 增删改查

---

#### 2.1 `INSERT INTO` — 插入数据

**插入用户：** `user.ts:29-32`
```sql
INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)
```

**插入会话：** `conversation.ts:22-25`
```sql
INSERT INTO conversations (user_id, title) VALUES (?, ?)
```

**插入消息：** `message.ts:23-26`
```sql
INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)
```

**插入知识库文档：** `knowledge.ts:34-37`
```sql
INSERT INTO knowledge_documents (user_id, title, doc_type, content, chunk_count) VALUES (?, ?, ?, ?, 0)
```

| 语法要点 | 说明 |
|----------|------|
| `INSERT INTO 表名 (列1, 列2) VALUES (?, ?)` | 指定列插入，未指定的列使用 DEFAULT 值 |
| `?` 占位符 | **参数化查询，防止 SQL 注入**。用户输入不会与 SQL 语句拼接，而是作为数据单独传递 |
| `result.insertId` | `AUTO_INCREMENT` 列自动生成的值，通过 `ResultSetHeader.insertId` 获取 |

> **为什么用 `pool.execute()` 而非 `pool.query()`？**
> - `execute()` 使用 MySQL 预处理语句（Prepared Statement），性能更好，且参数化更安全
> - `query()` 在驱动层做参数转义，`execute()` 在数据库层做

---

#### 2.2 `SELECT` — 查询数据

**① 基础等值查询 — 根据邮箱查用户：** `user.ts:44-46`
```sql
SELECT * FROM users WHERE email = ?
```
- `*` 返回所有列
- `WHERE email = ?` 等值条件，email 列有唯一索引，走索引查询（O(log n)）

**② 指定列查询 — 根据 ID 查用户（不返回密码）：** `user.ts:61`
```sql
SELECT id, username, email, created_at FROM users WHERE id = ?
```
- 明确列出需要的列，避免返回敏感字段 `password_hash`

**③ ORDER BY 排序 — 查用户的所有会话：** `conversation.ts:34-37`
```sql
SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC
```
- `ORDER BY created_at DESC` 按创建时间降序，最新的在前面
- `ASC` 升序（默认），`DESC` 降序

**④ 查消息历史（不带 limit）：** `message.ts:45-48`
```sql
SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
```
- 按时间升序，保证对话顺序正确

**⑤ 查消息历史（带 limit）+ 子查询翻转：** `message.ts:37-41`
```sql
SELECT * FROM (
  SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?
) sub ORDER BY created_at ASC
```

这是一个**"取最近 N 条，再翻转成正序"**的技巧：

| 步骤 | 说明 |
|------|------|
| 内层查询 | 按时间降序取最近 50 条（`LIMIT ?`），利用了 `conversation_id` 索引 |
| `LIMIT ?` | 限制返回行数，防止历史消息过多 |
| 外层 `ORDER BY ASC` | 把降序结果翻转为升序，保证传给 LLM 的顺序是正确的对话时序 |
| `sub` | 子查询别名，MySQL 要求派生表必须有别名 |

**⑥ 查知识库文档列表：** `knowledge.ts:11-14`
```sql
SELECT * FROM knowledge_documents WHERE user_id = ? ORDER BY created_at DESC
```

---

#### 2.3 `UPDATE` — 更新数据

**更新会话标题：** `conversation.ts:60-64`
```sql
UPDATE conversations SET title = ? WHERE id = ?
```
- `SET 列名 = 新值` 指定要修改的列
- `WHERE id = ?` 限定修改范围，**不加 WHERE 会全表更新，这是严重事故**

**回填知识库块数：** `knowledge.ts:55-56`
```sql
UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?
```

**更新文档内容（含回滚旧值）：** `knowledge.ts:105-108`
```sql
UPDATE knowledge_documents SET title = ?, doc_type = ?, content = ?, chunk_count = 0 WHERE id = ?
```

**回滚更新（向量化失败时恢复旧内容）：** `knowledge.ts:120-123`
```sql
UPDATE knowledge_documents SET title = ?, content = ? WHERE id = ?
```

| 注意点 | 说明 |
|--------|------|
| `WHERE id = ?` | 用主键精确定位，只影响一行 |
| `result.affectedRows` | `ResultSetHeader.affectedRows` 返回受影响行数，> 0 表示更新成功 |
| 更新前先 `SELECT` 查旧值 | 方便失败时回滚（`knowledge.ts:91-103`） |

---

#### 2.4 `DELETE` — 删除数据

**删除会话（带用户校验）：** `conversation.ts:72-75`
```sql
DELETE FROM conversations WHERE id = ? AND user_id = ?
```
- 同时校验 `id` 和 `user_id`，防止用户删别人的会话（横向越权）

**删除会话的所有消息：** `message.ts:57`
```sql
DELETE FROM messages WHERE conversation_id = ?
```

**删除知识库文档（MySQL 部分）：** `knowledge.ts:170-172`
```sql
DELETE FROM knowledge_documents WHERE id = ?
```

| 安全要点 | 说明 |
|----------|------|
| 双重条件 `id AND user_id` | 防止越权删除 |
| `ON DELETE CASCADE` | 会话表的外键级联删除会自动触发消息表级联 |
| 先删向量库再删 MySQL | 删除文档时的顺序（`knowledge.ts:168-172`），避免向量库删除失败导致孤立数据 |

---

### 三、完整语句速查表

| # | SQL 语句 | 文件:行 | 类型 |
|---|----------|---------|------|
| 1 | `CREATE DATABASE IF NOT EXISTS deepseek_clone ...` | `database.sql:2` | DDL |
| 2 | `CREATE TABLE IF NOT EXISTS users (...)` | `database.sql:8-19` | DDL |
| 3 | `CREATE TABLE IF NOT EXISTS conversations (...)` | `database.sql:22-33` | DDL |
| 4 | `CREATE TABLE IF NOT EXISTS messages (...)` | `database.sql:36-49` | DDL |
| 5 | `CREATE TABLE IF NOT EXISTS knowledge_documents (...)` | `database.sql:52-71` | DDL |
| 6 | `CREATE INDEX idx_conversations_user_id ON conversations (...)` | `init-db.ts:64` | DDL |
| 7 | `CREATE INDEX idx_messages_conversation_id ON messages (...)` | `init-db.ts:65` | DDL |
| 8 | `CREATE INDEX idx_users_email ON users (...)` | `init-db.ts:66` | DDL |
| 9 | `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)` | `user.ts:30` | DML |
| 10 | `SELECT * FROM users WHERE email = ?` | `user.ts:45` | DML |
| 11 | `SELECT id, username, email, created_at FROM users WHERE id = ?` | `user.ts:61` | DML |
| 12 | `INSERT INTO conversations (user_id, title) VALUES (?, ?)` | `conversation.ts:23` | DML |
| 13 | `SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC` | `conversation.ts:36` | DML |
| 14 | `SELECT * FROM conversations WHERE id = ?` | `conversation.ts:49` | DML |
| 15 | `UPDATE conversations SET title = ? WHERE id = ?` | `conversation.ts:62` | DML |
| 16 | `DELETE FROM conversations WHERE id = ? AND user_id = ?` | `conversation.ts:74` | DML |
| 17 | `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)` | `message.ts:24` | DML |
| 18 | `SELECT * FROM (SELECT * FROM messages ... LIMIT ?) sub ORDER BY created_at ASC` | `message.ts:38-40` | DML |
| 19 | `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC` | `message.ts:46` | DML |
| 20 | `DELETE FROM messages WHERE conversation_id = ?` | `message.ts:57` | DML |
| 21 | `SELECT * FROM knowledge_documents WHERE user_id = ? ORDER BY created_at DESC` | `knowledge.ts:12` | DML |
| 22 | `INSERT INTO knowledge_documents (...) VALUES (?, ?, ?, ?, 0)` | `knowledge.ts:35` | DML |
| 23 | `UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?` | `knowledge.ts:55` | DML |
| 24 | `UPDATE knowledge_documents SET title = ?, doc_type = ?, content = ?, chunk_count = 0 WHERE id = ?` | `knowledge.ts:106` | DML |
| 25 | `UPDATE knowledge_documents SET title = ?, content = ? WHERE id = ?` | `knowledge.ts:121` | DML |
| 26 | `DELETE FROM knowledge_documents WHERE id = ?` | `knowledge.ts:171` | DML |

---

### 四、核心语法要点回顾

| 概念 | 一句话解释 |
|------|-----------|
| `?` 占位符 | 参数化查询，**防 SQL 注入**的核心手段 |
| `VARCHAR vs TEXT` | VARCHAR 存短字符串（最大 65535 字节），TEXT 存长文本（独立存储） |
| `utf8mb4` | MySQL 真正的 UTF-8，支持 emoji 和生僻字 |
| `AUTO_INCREMENT` | 自动递增主键，插入后通过 `insertId` 获取 |
| `FOREIGN KEY ... ON DELETE CASCADE` | 级联删除，删除父记录时自动删除子记录 |
| `ENUM` | 枚举约束，值必须是预定义列表中的一项 |
| `ORDER BY ... DESC/ASC` | 排序，DESC 降序，ASC 升序 |
| `LIMIT n` | 限制返回行数，常配合 ORDER BY 做 Top-N 查询 |
| `pool.execute() vs pool.query()` | execute 走预处理语句（推荐），query 在驱动层做转义 |
| `affectedRows` | 判断 UPDATE/DELETE 是否实际影响了数据 |
