// 导入 Express Web 框架
const express = require('express');
// 导入 Node.js 原生 HTTP 模块（用于创建服务器）
const http = require('http');
// 导入 Socket.io 的 Server 类（用于实时通信）
const { Server } = require('socket.io');
// 导入 CORS 中间件（解决跨域问题）
const cors = require('cors');
// 加载环境变量配置
require('dotenv').config();
// 导入数据库初始化模块
const { createTablesIfNotExist } = require('./init-db');

// 创建 Express 应用实例
const app = express();
// 创建 HTTP 服务器，把 Express 应用挂载上去
// 注意：不能直接用 app.listen()，因为 Socket.io 需要独立的 HTTP server
const server = http.createServer(app);
// 创建 Socket.io 服务器实例，挂载到 HTTP server 上
const io = new Server(server, {
  cors: {
    // 允许前端访问的域名（从环境变量读取，默认 localhost:5173）
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    // 允许的 HTTP 方法
    methods: ['GET', 'POST']
  }
});

// ==================== 中间件配置 ====================

// 启用 CORS 跨域支持，允许前端访问后端 API
app.use(cors());
// 解析 JSON 格式的请求体（把前端发来的 JSON 转成 JavaScript 对象）
app.use(express.json());

// ==================== 路由配置 ====================

// 导入认证相关路由（注册、登录、获取用户信息）
const authRoutes = require('./routes/auth');
// 导入聊天相关路由
const chatRoutes = require('./routes/chat');
// 导入对话管理相关路由
const conversationRoutes = require('./routes/conversation');
// 导入知识库管理相关路由
const knowledgeRoutes = require('./routes/knowledge');

// 把路由挂载到对应路径下
app.use('/api/auth', authRoutes);           // 认证接口：/api/auth/*
app.use('/api/chat', chatRoutes);           // 聊天接口：/api/chat/*
app.use('/api/conversations', conversationRoutes);  // 对话接口：/api/conversations/*
app.use('/api/knowledge', knowledgeRoutes);  // 知识库接口：/api/knowledge/*

// ==================== Socket.io 配置 ====================

// 导入 Socket.io 事件处理函数
const setupSocket = require('./socket');
// 初始化 Socket.io，传入 io 实例
setupSocket(io);

// ==================== 根路径测试接口 ====================

// 根路径 GET 请求，返回 API 基本信息（用于测试服务器是否正常运行）
app.get('/', (req, res) => {
  res.json({ 
    message: 'DeepSeek Clone API',
    version: '1.0.0'
  });
});

// ==================== 启动服务器 ====================

// 从环境变量读取端口，默认 3000
const PORT = process.env.PORT || 3000;

// 先初始化数据库，再启动服务器
const startServer = async () => {
  try {
    await createTablesIfNotExist();
    // 启动服务器监听指定端口
    server.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();
