import { Server, Socket } from 'socket.io';
import deepseekService from '../services/deepseek';
import MessageModel from '../models/message';
import ConversationModel from '../models/conversation';

function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('用户已连接:', socket.id);

    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conv-${conversationId}`);
    });

    socket.on('chat-message', async (data: {
      conversationId: number;
      userId: number;
      message: string;
      model?: string;
      useRAG?: boolean;
    }) => {
      const { conversationId, userId, message, model, useRAG = false } = data;

      try {
        await MessageModel.create(conversationId, 'user', message);

        const historyMessages = await MessageModel.findByConversationId(conversationId);
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
