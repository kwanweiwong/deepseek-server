// 导入 jsonwebtoken 库，用于验证 JWT token
const jwt = require('jsonwebtoken');
// 加载环境变量配置（从 .env 文件读取 JWT_SECRET
require('dotenv').config();

/**
 * JWT 认证中间件
 * 作用：验证请求头中的 token，验证通过后将 userId 挂载到 req 上
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 继续执行下一个中间件/控制器
 */
const authMiddleware = (req, res, next) => {
  // 1. 从请求头中获取 Authorization 字段
  // 格式通常是：Bearer eyJhbGciOiJIUzI1NiIs...
  // 用 ?. 可选链操作符安全访问，用 replace 去掉前面的 'Bearer '
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  // 2. 检查是否提供了 token
  if (!token) {
    // 如果没有 token，返回 401 未授权错误
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  try {
    // 3. 验证 token 的有效性
    // 用 JWT_SECRET 密钥验证 token 是不是真的、有没有过期
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 4. 将解析出的 userId 挂载到 req 对象上
    // 这样后面的控制器就可以直接用 req.userId 了
    req.userId = decoded.userId;
    // 5. 调用 next()，继续执行下一个中间件或控制器
    next();
  } catch (error) {
    // 6. token 无效（比如过期、被篡改等，返回 401 错误
    res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 导出中间件，供路由使用
module.exports = authMiddleware;
