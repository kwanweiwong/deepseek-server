// 导入密码加密库
const bcrypt = require('bcryptjs');
// 导入 JWT 令牌库
const jwt = require('jsonwebtoken');
// 导入用户数据模型
const UserModel = require('../models/user');
// 加载环境变量配置
require('dotenv').config();

/**
 * 认证控制器
 * 处理用户注册、登录、获取用户信息等认证相关操作
 */
const AuthController = {
  /**
   * 用户注册接口
   * @param {Object} req - Express 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.username - 用户名
   * @param {string} req.body.email - 邮箱
   * @param {string} req.body.password - 密码（明文）
   * @param {Object} res - Express 响应对象
   */
  async register(req, res) {
    try {
      // 从请求体中解构出注册所需参数
      const { username, email, password } = req.body;

      // 参数校验：检查必填字段是否都已提供
      if (!username || !email || !password) {
        return res.status(400).json({ message: '请填写所有必填字段' });
      }

      // 检查邮箱是否已被注册
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: '邮箱已被注册' });
      }

      // 使用 bcrypt 对密码进行加密，saltRounds = 10（加密强度）
      const passwordHash = await bcrypt.hash(password, 10);
      // 创建用户记录到数据库
      const userId = await UserModel.create(username, email, passwordHash);

      // 生成 JWT 令牌，有效期 7 天
      const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

      // 返回 201 状态码（创建成功），包含令牌和用户信息
      res.status(201).json({
        message: '注册成功',
        token,
        user: {
          id: userId,
          username,
          email
        }
      });
    } catch (error) {
      // 捕获并记录错误，返回服务器错误响应
      console.error('注册错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  /**
   * 用户登录接口
   * @param {Object} req - Express 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.email - 邮箱
   * @param {string} req.body.password - 密码（明文）
   * @param {Object} res - Express 响应对象
   */
  async login(req, res) {
    try {
      // 从请求体中解构出登录所需参数
      const { email, password } = req.body;

      // 参数校验：检查邮箱和密码是否都已提供
      if (!email || !password) {
        return res.status(400).json({ message: '请填写邮箱和密码' });
      }

      // 根据邮箱查找用户
      const user = await UserModel.findByEmail(email);
      if (!user) {
        // 用户不存在，返回 401 未授权
        return res.status(401).json({ message: '邮箱或密码错误' });
      }

      // 使用 bcrypt 比对输入的密码和数据库中的哈希密码
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        // 密码不匹配，返回 401 未授权
        return res.status(401).json({ message: '邮箱或密码错误' });
      }

      // 生成 JWT 令牌，有效期 7 天
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      // 返回登录成功响应，包含令牌和用户信息
      res.json({
        message: '登录成功',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      // 捕获并记录错误，返回服务器错误响应
      console.error('登录错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  /**
   * 获取当前登录用户信息接口
   * @param {Object} req - Express 请求对象
   * @param {number} req.userId - 从 JWT 中间件解析出的用户 ID
   * @param {Object} res - Express 响应对象
   */
  async getProfile(req, res) {
    try {
      // 根据 JWT 中间件设置的 userId 查找用户
      const user = await UserModel.findById(req.userId);
      if (!user) {
        // 用户不存在，返回 404
        return res.status(404).json({ message: '用户不存在' });
      }
      // 返回用户信息（不包含密码）
      res.json({ user });
    } catch (error) {
      // 捕获并记录错误，返回服务器错误响应
      console.error('获取用户信息错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
};

// 导出认证控制器供路由使用
module.exports = AuthController;
