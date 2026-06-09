import express, { Request, Response, Router } from 'express';
import pool from '../models/db';
import vectorDB from '../services/vectorDB';
import authMiddleware from '../middleware/auth';

const router: Router = express.Router();

// 获取用户的所有知识库文档
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [docs] = await pool.query(
      'SELECT * FROM knowledge_documents WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ success: true, documents: docs });
  } catch (error) {
    console.error('获取知识库失败:', error);
    res.status(500).json({ success: false, message: '获取知识库失败' });
  }
});

// 添加文档到知识库
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, content, docType = 'text' } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }

    const [result] = await pool.query(
      'INSERT INTO knowledge_documents (user_id, title, doc_type, content, chunk_count) VALUES (?, ?, ?, ?, 0)',
      [req.userId, title, docType, content]
    ) as any[];
    const docId = result.insertId;

    let chunkCount = 0;
    try {
      const vectorResult = await vectorDB.addDocument(
        docId,
        title,
        content,
        req.userId
      );
      chunkCount = vectorResult.chunkCount;
    } catch (vectorError) {
      await pool.query('DELETE FROM knowledge_documents WHERE id = ?', [docId]);
      throw vectorError;
    }

    await pool.query(
      'UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?',
      [chunkCount, docId]
    );

    res.json({
      success: true,
      message: '文档添加成功',
      document: {
        id: docId,
        title,
        docType,
        chunkCount
      }
    });
  } catch (error) {
    console.error('添加文档失败:', error);
    res.status(500).json({ success: false, message: '添加文档失败' });
  }
});

// 更新知识库文档
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const docId = parseInt(req.params.id);
    if (isNaN(docId)) {
      return res.status(400).json({ success: false, message: '无效的文档ID' });
    }
    const { title, content, docType = 'text' } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }

    const [docs] = await pool.query(
      'SELECT * FROM knowledge_documents WHERE id = ? AND user_id = ?',
      [docId, req.userId]
    ) as any[];

    if (docs.length === 0) {
      return res.status(404).json({
        success: false,
        message: '文档不存在或无权限'
      });
    }

    const oldDoc = docs[0] as { title: string; content: string };

    await pool.query(
      'UPDATE knowledge_documents SET title = ?, doc_type = ?, content = ?, chunk_count = 0 WHERE id = ?',
      [title, docType, content, docId]
    );

    let chunkCount = 0;
    try {
      const vectorResult = await vectorDB.updateDocument(
        docId,
        title,
        content,
        req.userId
      );
      chunkCount = vectorResult.chunkCount;
    } catch (vectorError) {
      await pool.query(
        'UPDATE knowledge_documents SET title = ?, content = ? WHERE id = ?',
        [oldDoc.title, oldDoc.content, docId]
      );
      throw vectorError;
    }

    await pool.query(
      'UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?',
      [chunkCount, docId]
    );

    res.json({
      success: true,
      message: '文档更新成功',
      document: {
        id: docId,
        title,
        docType,
        chunkCount
      }
    });
  } catch (error) {
    console.error('更新文档失败:', error);
    res.status(500).json({ success: false, message: '更新文档失败' });
  }
});

// 删除知识库文档
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const docId = parseInt(req.params.id);
    if (isNaN(docId)) {
      return res.status(400).json({ success: false, message: '无效的文档ID' });
    }

    const [docs] = await pool.query(
      'SELECT * FROM knowledge_documents WHERE id = ? AND user_id = ?',
      [docId, req.userId]
    ) as any[];

    if (docs.length === 0) {
      return res.status(404).json({
        success: false,
        message: '文档不存在或无权限'
      });
    }

    await vectorDB.deleteDocument(docId);

    await pool.query(
      'DELETE FROM knowledge_documents WHERE id = ?',
      [docId]
    );

    res.json({ success: true, message: '文档删除成功' });
  } catch (error) {
    console.error('删除文档失败:', error);
    res.status(500).json({ success: false, message: '删除文档失败' });
  }
});

// 搜索知识库
router.post('/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query, topK = 3 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: '搜索词不能为空'
      });
    }

    const results = await vectorDB.searchDocuments(query, req.userId, topK);
    const ragPrompt = vectorDB.buildRAGPrompt(query, results);

    res.json({
      success: true,
      results,
      ragPrompt
    });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ success: false, message: '搜索失败' });
  }
});

export default router;
