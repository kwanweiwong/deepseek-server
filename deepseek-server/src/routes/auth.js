// 导入 Express 框架
const express = require('express');
// 导入认证控制器，包含注册、登录、获取用户信息等业务逻辑
const AuthController = require('../controllers/auth');
// 导入 JWT 认证中间件，用于验证用户身份
const authMiddleware = require('../middleware/auth');

// 创建 Express 路由实例，用于定义认证相关的 API 路由
const router = express.Router();

/**
 * POST /api/auth/register - 用户注册接口
 * 不需要认证，任何人都可以访问
 * 请求体：{ username, email, password }
 */
router.post('/register', AuthController.register);

/**
 * POST /api/auth/login - 用户登录接口
 * 不需要认证，任何人都可以访问
 * 请求体：{ email, password }
 */
router.post('/login', AuthController.login);

/**
 * GET /api/auth/profile - 获取当前登录用户信息接口
 * 需要认证：先经过 authMiddleware 验证 JWT 令牌
 * 只有登录后的用户才能访问
 */
router.get('/profile', authMiddleware, AuthController.getProfile);

// 导出路由实例，供主应用（index.js）使用
module.exports = router;
