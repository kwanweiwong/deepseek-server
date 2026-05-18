const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const vectorDB = require('../services/vectorDB');
const authMiddleware = require('../middleware/auth');

// 获取用户的所有知识库文档
router.get('/', authMiddleware, async (req, res) => {
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
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content, docType = 'text' } = req.body;

    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: '标题和内容不能为空' 
      });
    }

    // 1. 保存到 MySQL
    const [result] = await pool.query(
      'INSERT INTO knowledge_documents (user_id, title, doc_type, content, chunk_count) VALUES (?, ?, ?, ?, 0)',
      [req.userId, title, docType, content]
    );
    const docId = result.insertId;

    // 2. 添加到向量数据库
    const vectorResult = await vectorDB.addDocument(
      docId,
      title,
      content,
      req.userId
    );

    // 3. 更新分块数量
    await pool.query(
      'UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?',
      [vectorResult.chunkCount, docId]
    );

    res.json({
      success: true,
      message: '文档添加成功',
      document: {
        id: docId,
        title,
        docType,
        chunkCount: vectorResult.chunkCount
      }
    });
  } catch (error) {
    console.error('添加文档失败:', error);
    res.status(500).json({ success: false, message: '添加文档失败' });
  }
});

// 更新知识库文档
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const { title, content, docType = 'text' } = req.body;

    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: '标题和内容不能为空' 
      });
    }

    // 1. 检查文档是否属于当前用户
    const [docs] = await pool.query(
      'SELECT * FROM knowledge_documents WHERE id = ? AND user_id = ?',
      [docId, req.userId]
    );

    if (docs.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '文档不存在或无权限' 
      });
    }

    // 2. 更新 MySQL
    await pool.query(
      'UPDATE knowledge_documents SET title = ?, doc_type = ?, content = ?, chunk_count = 0 WHERE id = ?',
      [title, docType, content, docId]
    );

    // 3. 更新向量数据库
    const vectorResult = await vectorDB.updateDocument(
      docId,
      title,
      content,
      req.userId
    );

    // 4. 更新分块数量
    await pool.query(
      'UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?',
      [vectorResult.chunkCount, docId]
    );

    res.json({
      success: true,
      message: '文档更新成功',
      document: {
        id: docId,
        title,
        docType,
        chunkCount: vectorResult.chunkCount
      }
    });
  } catch (error) {
    console.error('更新文档失败:', error);
    res.status(500).json({ success: false, message: '更新文档失败' });
  }
});

// 删除知识库文档
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);

    // 1. 检查文档是否属于当前用户
    const [docs] = await pool.query(
      'SELECT * FROM knowledge_documents WHERE id = ? AND user_id = ?',
      [docId, req.userId]
    );

    if (docs.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '文档不存在或无权限' 
      });
    }

    // 2. 从向量数据库删除
    await vectorDB.deleteDocument(docId);

    // 3. 从 MySQL 删除
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

// 搜索知识库（测试用）
router.post('/search', authMiddleware, async (req, res) => {
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

module.exports = router;
