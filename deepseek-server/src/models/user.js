// 导入数据库连接池
const pool = require('./db');

/**
 * 用户数据模型
 * 封装所有与 users 表相关的数据库操作
 */
const UserModel = {
  /**
   * 创建新用户
   * @param {string} username - 用户名
   * @param {string} email - 邮箱
   * @param {string} passwordHash - 加密后的密码
   * @returns {Promise<number>} 返回新创建用户的 ID
   */
  async create(username, email, passwordHash) {
    // 执行 INSERT SQL 语句
    // 使用 ? 占位符防止 SQL 注入
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );
    // 返回新插入记录的自增 ID
    return result.insertId;
  },

  /**
   * 根据邮箱查找用户
   * @param {string} email - 邮箱地址
   * @returns {Promise<Object|null>} 返回用户对象，如果不存在返回 undefined
   */
  async findByEmail(email) {
    // 执行 SELECT SQL 语句，根据邮箱查询
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    // 返回查询结果的第一条记录（邮箱唯一，最多一条）
    return rows[0];
  },

  /**
   * 根据 ID 查找用户
   * @param {number} id - 用户 ID
   * @returns {Promise<Object|null>} 返回用户对象（不包含密码），如果不存在返回 undefined
   */
  async findById(id) {
    // 执行 SELECT SQL 语句，根据 ID 查询
    // 只查询需要的字段，不返回密码（安全考虑）
    const [rows] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [id]
    );
    // 返回查询结果的第一条记录（ID 唯一，最多一条）
    return rows[0];
  }
};

// 导出用户模型供控制器使用
module.exports = UserModel;
