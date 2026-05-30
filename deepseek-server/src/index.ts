import express, { Application, Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createTablesIfNotExist } from './init-db';

dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// ==================== 中间件配置 ====================

app.use(cors());
app.use(express.json());

// ==================== 路由配置 ====================

import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import conversationRoutes from './routes/conversation';
import knowledgeRoutes from './routes/knowledge';

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// ==================== Socket.io 配置 ====================

import setupSocket from './socket';
setupSocket(io);

// ==================== 根路径测试接口 ====================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'DeepSeek Clone API',
    version: '1.0.0'
  });
});

// ==================== 启动服务器 ====================

const PORT = process.env.PORT || 3000;

const startServer = async (): Promise<void> => {
  try {
    await createTablesIfNotExist();
    server.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();
