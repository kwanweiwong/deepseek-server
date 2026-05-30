import { LocalIndex, IndexItem, MetadataFilter, QueryResult } from 'vectra';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface DocMetadata {
  docId: number;
  title: string;
  chunkIndex: number;
  totalChunks: number;
  userId: number;
  text: string;
  [key: string]: number | string | boolean;
}

const indexPath = path.join(__dirname, '../../vectra-data');
const index = new LocalIndex<DocMetadata>(indexPath);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

async function initIndex(): Promise<void> {
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
    console.log('向量数据库索引已创建:', indexPath);
  }
}

async function getEmbedding(text: string): Promise<number[] | null> {
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

    return response.data.data[0].embedding as number[];
  } catch (error: any) {
    console.error('获取 Embedding 失败:', error.message);
    return null;
  }
}

function splitText(text: string, chunkSize = 500, chunkOverlap = 50): string[] {
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - chunkOverlap;
  }

  return chunks;
}

async function addDocument(docId: number, title: string, content: string, userId: number) {
  await initIndex();

  const chunks = splitText(content);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await getEmbedding(chunk);

    const item: Partial<IndexItem<DocMetadata>> = {
      vector: embedding || [],
      metadata: {
        docId,
        title,
        chunkIndex: i,
        totalChunks: chunks.length,
        userId,
        text: chunk
      }
    };

    if (embedding) {
      await index.insertItem(item);
    } else {
      await index.insertItem({ ...item, vector: [] });
    }
  }

  return { success: true, chunkCount: chunks.length };
}

async function searchDocuments(query: string, userId: number, topK = 3) {
  await initIndex();

  const queryEmbedding = await getEmbedding(query);

  if (queryEmbedding) {
    const filter: MetadataFilter = { userId: { '$eq': userId } };
    const results = await index.queryItems(queryEmbedding, query, topK, filter);

    return results.map((r: QueryResult<DocMetadata>) => ({
      text: r.item.metadata.text,
      title: r.item.metadata.title,
      score: r.score
    }));
  } else {
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

async function deleteDocument(docId: number) {
  const allItems = await index.listItems();
  const itemsToDelete = allItems.filter(item => item.metadata.docId === docId);

  for (const item of itemsToDelete) {
    await index.deleteItem(item.id);
  }

  return { success: true, deletedCount: itemsToDelete.length };
}

async function updateDocument(docId: number, title: string, content: string, userId: number) {
  await deleteDocument(docId);
  return addDocument(docId, title, content, userId);
}

function buildRAGPrompt(query: string, contextDocs: { title: string; text: string; score: number }[]): string | null {
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

export default {
  addDocument,
  searchDocuments,
  deleteDocument,
  updateDocument,
  buildRAGPrompt,
  splitText
};
