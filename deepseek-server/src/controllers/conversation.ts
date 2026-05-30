import ConversationModel from '../models/conversation';
import MessageModel from '../models/message';
import { Request, Response } from 'express';

const ConversationController = {
  async create(req: Request, res: Response) {
    try {
      const { title } = req.body;
      const conversationId = await ConversationModel.create(
        req.userId,
        title || '新对话'
      );
      res.status(201).json({
        message: '对话创建成功',
        conversation: {
          id: conversationId,
          title: title || '新对话',
          user_id: req.userId
        }
      });
    } catch (error) {
      console.error('创建对话错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      const conversations = await ConversationModel.findByUserId(req.userId);
      res.json({ conversations });
    } catch (error) {
      console.error('获取对话列表错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const conversation = await ConversationModel.findById(id);

      if (!conversation) {
        return res.status(404).json({ message: '对话不存在' });
      }

      if (conversation.user_id !== req.userId) {
        return res.status(403).json({ message: '无权访问此对话' });
      }

      const messages = await MessageModel.findByConversationId(id);
      res.json({ conversation, messages });
    } catch (error) {
      console.error('获取对话详情错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { title } = req.body;

      const conversation = await ConversationModel.findById(id);

      if (!conversation) {
        return res.status(404).json({ message: '对话不存在' });
      }

      if (conversation.user_id !== req.userId) {
        return res.status(403).json({ message: '无权修改此对话' });
      }

      const success = await ConversationModel.updateTitle(id, title || '新对话');
      if (success) {
        res.json({
          message: '对话更新成功',
          conversation: {
            id: conversation.id,
            title: title || '新对话',
            user_id: req.userId
          }
        });
      } else {
        res.status(500).json({ message: '更新失败' });
      }
    } catch (error) {
      console.error('更新对话错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const conversation = await ConversationModel.findById(id);

      if (!conversation) {
        return res.status(404).json({ message: '对话不存在' });
      }

      if (conversation.user_id !== req.userId) {
        return res.status(403).json({ message: '无权删除此对话' });
      }

      const success = await ConversationModel.delete(id, req.userId);
      if (success) {
        res.json({ message: '对话删除成功' });
      } else {
        res.status(500).json({ message: '删除失败' });
      }
    } catch (error) {
      console.error('删除对话错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
};

export default ConversationController;
