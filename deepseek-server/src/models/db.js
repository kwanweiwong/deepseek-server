// 导入 mysql2 的 Promise 版本，支持 async/await
const mysql = require('mysql2/promise');
// 加载环境变量配置
require('dotenv').config();

/**
 * 创建 MySQL 连接池
 * 连接池可以复用数据库连接，避免频繁创建和销毁连接带来的性能开销
 */
const pool = mysql.createPool({
  // 数据库主机地址，优先从环境变量读取，默认 localhost
  host: process.env.DB_HOST || 'localhost',
  // 数据库端口，优先从环境变量读取，默认 3306
  port: process.env.DB_PORT || 3306,
  // 数据库用户名，优先从环境变量读取，默认 root
  user: process.env.DB_USER || 'root',
  // 数据库密码，优先从环境变量读取，默认空
  password: process.env.DB_PASSWORD || '',
  // 数据库名称，优先从环境变量读取，默认 deepseek_clone
  database: process.env.DB_NAME || 'deepseek_clone',
  // 当没有可用连接时，是否等待连接释放
  waitForConnections: true,
  // 连接池最大连接数，这里设置为 10
  connectionLimit: 10,
  // 等待队列的最大请求数，0 表示不限制
  queueLimit: 0
});

// 导出连接池供其他模块使用
module.exports = pool;
