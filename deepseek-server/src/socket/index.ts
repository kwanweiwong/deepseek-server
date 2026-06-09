import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import deepseekService from '../services/deepseek';
import MessageModel from '../models/message';
import ConversationModel from '../models/conversation';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: number;
  };
}

function setupSocket(io: Server) {
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('未提供认证令牌'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('无效的认证令牌'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('用户已连接:', socket.id, 'userId:', socket.data.userId);

    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conv-${conversationId}`);
    });

    socket.on('chat-message', async (data: {
      conversationId: number;
      message: string;
      model?: string;
      useRAG?: boolean;
    }) => {
      const { conversationId, message, model, useRAG = false } = data;
      const userId = socket.data.userId;

      try {
        await MessageModel.create(conversationId, 'user', message);

        const historyMessages = await MessageModel.findByConversationId(conversationId, 50);
        const formattedMessages = historyMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));

        let aiResponse = '';
        const stream = deepseekService.chatStream(formattedMessages, model, userId, useRAG);

        for await (const chunk of stream) {
          aiResponse += chunk;
          socket.emit('chat-chunk', { conversationId, chunk });
        }

        if (!aiResponse.trim()) {
          aiResponse = '抱歉，我暂时无法回答这个问题，请稍后重试。';
          socket.emit('chat-chunk', { conversationId, chunk: aiResponse });
        }

        await MessageModel.create(conversationId, 'assistant', aiResponse);

        const conversation = await ConversationModel.findById(conversationId);
        if (conversation && (!conversation.title || conversation.title === '新对话')) {
          const firstLine = message.split('\n')[0].slice(0, 30);
          await ConversationModel.updateTitle(conversationId, firstLine);
        }

        socket.emit('chat-complete', { conversationId, content: aiResponse });

      } catch (error: any) {
        console.error('聊天错误:', error);
        socket.emit('chat-error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('用户已断开连接:', socket.id);
    });
  });
}

export default setupSocket;
