import { LocalIndex, IndexItem, MetadataFilter, QueryResult } from 'vectra';
import path from 'path';
import axios from 'axios';

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

/**
 * 将文本按指定大小分割成多个片段，并允许片段之间存在重叠。
 * 
 * @param text - 需要分割的原始文本字符串
 * @param chunkSize - 每个片段的字符长度，默认为 500
 * @param chunkOverlap - 相邻片段之间的重叠字符数，默认为 50
 * @returns 分割后的文本片段数组
 */
function splitText(text: string, chunkSize = 500, chunkOverlap = 50): string[] {
  const chunks: string[] = [];
  let i = 0;

  // 遍历文本，按步长提取片段直至覆盖全文
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - chunkOverlap;
  }

  return chunks;
}

/**
 * 提取字符串中的所有二元组（bigram）
 * 
 * @param s - 输入字符串
 * @returns 包含所有唯一二元组的集合
 */
function bigram(s: string): Set<string> {
  const bgs = new Set<string>();
  // 遍历字符串，提取每个相邻字符对并添加到集合中
  for (let i = 0; i < s.length - 1; i++) {
    bgs.add(s.slice(i, i + 2));
  }
  return bgs;
}

/**
 * 计算查询字符串与文本之间的双字符重叠得分（Bigram Overlap Score）。
 * 
 * 该函数通过将字符串转换为小写并提取双字符集合（bigrams），
 * 计算查询字符串中有多少比例的双字符也出现在文本中。
 * 
 * @param query - 查询字符串，用于提取参考双字符集合
 * @param text - 待比较的文本字符串，用于检查双字符是否存在
 * @returns 返回一个介于 0 到 1 之间的数值，表示查询字符串中双字符在文本中的覆盖比例；
 *          如果查询字符串无法生成任何双字符，则返回 0
 */
function bigramOverlapScore(query: string, text: string): number {
  const q = bigram(query.toLowerCase());
  const t = bigram(text.toLowerCase());

  // 如果查询字符串没有生成任何双字符，则直接返回 0，避免除以零错误
  if (q.size === 0) return 0;

  let overlap = 0;
  for (const bg of q) {
    if (t.has(bg)) overlap++;
  }

  // 计算重叠双字符数量占查询字符串总双字符数量的比例
  return overlap / q.size;
}

/**
 * 向索引中添加文档。该函数会将文档内容分割成多个片段，为每个片段生成嵌入向量，
 * 并将片段及其元数据插入到索引中。
 *
 * @param docId - 文档的唯一标识ID
 * @param title - 文档的标题
 * @param content - 文档的文本内容
 * @param userId - 所属用户的ID
 * @returns 包含操作成功状态和生成的片段数量的对象
 */
async function addDocument(docId: number, title: string, content: string, userId: number) {
  await initIndex();

  // 将文档内容分割为多个文本片段
  const chunks = splitText(content);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // 为当前文本片段生成嵌入向量
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

    // 根据是否成功生成嵌入向量，将片段插入索引
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

    const scored = userItems.map(item => ({
      item,
      score: bigramOverlapScore(query, item.metadata.text)
    }));

    const results = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => ({
        text: s.item.metadata.text,
        title: s.item.metadata.title,
        score: Math.round(s.score * 100) / 100
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
