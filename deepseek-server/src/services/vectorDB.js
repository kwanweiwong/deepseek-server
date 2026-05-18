const { LocalIndex } = require('vectra');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// 初始化向量数据库索引
const indexPath = path.join(__dirname, '../../vectra-data');
const index = new LocalIndex(indexPath);

// OpenAI Embedding API 配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

// 初始化向量数据库
async function initIndex() {
  if (!await index.isIndexCreated()) {
    await index.createIndex();
    console.log('向量数据库索引已创建:', indexPath);
  }
}

// 生成文本向量
async function getEmbedding(text) {
  if (!OPENAI_API_KEY) {
    console.warn('未配置 OPENAI_API_KEY，使用简单关键词匹配');
    return null;
  }

  try {
    const response = await axios.post(
      OPENAI_EMBEDDING_URL,
      {
        model: EMBEDDING_MODEL,
        input: text
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    return response.data.data[0].embedding;
  } catch (error) {
    console.error('获取 Embedding 失败:', error.message);
    return null;
  }
}

// 文本分块函数
function splitText(text, chunkSize = 500, chunkOverlap = 50) {
  const chunks = [];
  let i = 0;

  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - chunkOverlap;
  }

  return chunks;
}

// 添加文档到向量数据库
async function addDocument(docId, title, content, userId) {
  await initIndex();

  const chunks = splitText(content);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await getEmbedding(chunk);

    if (embedding) {
      await index.insertItem({
        vector: embedding,
        metadata: {
          docId: docId,
          title: title,
          chunkIndex: i,
          totalChunks: chunks.length,
          userId: userId,
          text: chunk
        }
      });
    } else {
      // 如果没有 Embedding，也存储原始文本用于关键词匹配
      await index.insertItem({
        vector: [],
        metadata: {
          docId: docId,
          title: title,
          chunkIndex: i,
          totalChunks: chunks.length,
          userId: userId,
          text: chunk
        }
      });
    }
  }

  return { success: true, chunkCount: chunks.length };
}

// 从向量数据库检索相关文档
async function searchDocuments(query, userId, topK = 3) {
  await initIndex();

  const queryEmbedding = await getEmbedding(query);

  if (queryEmbedding) {
    // 使用向量检索
    const results = await index.queryItems(
      queryEmbedding,
      topK,
      (item) => item.metadata.userId === userId
    );

    return results.map(r => ({
      text: r.item.metadata.text,
      title: r.item.metadata.title,
      score: r.score
    }));
  } else {
    // 降级到关键词匹配
    const allItems = await index.listItems();
    const userItems = allItems.filter(item => item.metadata.userId === userId);
    
    const results = userItems
      .filter(item => 
        item.metadata.text.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, topK)
      .map(item => ({
        text: item.metadata.text,
        title: item.metadata.title,
        score: 1
      }));

    return results;
  }
}

// 从向量数据库删除文档
async function deleteDocument(docId) {
  const allItems = await index.listItems();
  const itemsToDelete = allItems.filter(item => item.metadata.docId === docId);

  for (const item of itemsToDelete) {
    await index.deleteItem(item.id);
  }

  return { success: true, deletedCount: itemsToDelete.length };
}

// 更新向量数据库中的文档（先删除旧的再添加新的）
async function updateDocument(docId, title, content, userId) {
  // 1. 删除旧文档
  await deleteDocument(docId);
  
  // 2. 添加新文档
  const result = await addDocument(docId, title, content, userId);
  
  return result;
}

// 构建 RAG 提示词
function buildRAGPrompt(query, contextDocs) {
  if (!contextDocs || contextDocs.length === 0) {
    return null;
  }

  const contextText = contextDocs
    .map((doc, i) => `【参考 ${i + 1}】\n标题：${doc.title}\n内容：${doc.text}`)
    .join('\n\n');

  return `请基于以下参考内容回答用户问题。如果参考内容中没有相关信息，请直接说明，不要编造。

【参考内容】
${contextText}

【用户问题】
${query}

请用简洁清晰的语言回答。`;
}

module.exports = {
  addDocument,
  searchDocuments,
  deleteDocument,
  updateDocument,
  buildRAGPrompt,
  splitText
};
