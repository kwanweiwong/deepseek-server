# DeepSeek Clone

一个仿 DeepSeek 网页版的全栈项目

## 技术栈

### 前端
- Vue 3
- Vite
- Pinia（状态管理）
- Vue Router
- Element Plus
- Socket.io-client

### 后端
- Express.js
- MySQL
- mysql2（原生驱动）
- Socket.io
- JWT
- bcryptjs

## 项目结构

```
deepSeek/
├── deepseek-web/     # 前端项目
└── deepseek-server/  # 后端项目
```

## 快速开始

### 1. 数据库准备

在 MySQL 中执行 `deepseek-server/src/config/database.sql` 脚本创建数据库和表

### 2. 后端配置

进入后端目录：
```bash
cd deepseek-server
```

安装依赖：
```bash
npm install
```

配置环境变量，编辑 `.env` 文件：
```
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=deepseek_clone

JWT_SECRET=your_jwt_secret_key_here

DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TEMPERATURE=0.7
```

启动后端：
```bash
npm run dev
```

### 3. 前端配置

进入前端目录：
```bash
cd deepseek-web
```

安装依赖：
```bash
npm install
```

启动前端：
```bash
npm run dev
```

访问 `http://localhost:5173` 即可使用

## 功能特性

- 用户注册/登录
- 多轮对话
- 流式输出
- 历史对话管理
- 实时通信（Socket.io）
