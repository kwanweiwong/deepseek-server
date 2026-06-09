import dotenv from 'dotenv';
dotenv.config();
import express, { Application, Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createTablesIfNotExist } from './init-db';

// ==================== 启动时环境变量校验 ====================

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === '123456') {
  console.warn('⚠️  警告: JWT_SECRET 未设置或使用默认值，请在生产环境中修改！');
}

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('❌ 错误: 未配置 DEEPSEEK_API_KEY，无法调用 AI 接口');
  process.exit(1);
}

// ==================== 中间件配置 ====================

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5175';
const app: Application = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
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
