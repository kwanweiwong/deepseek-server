import pool from './models/db';

interface QueryResult {
affectedRows?: number;
insertId?: number;
[field: string]: any;
}

const createTablesIfNotExist = async (): Promise<void> => {
try {
console.log('🔍 检查数据库表...');

// 创建 users 表（如果不存在）
await pool.query(`
CREATE TABLE IF NOT EXISTS users (
id INT PRIMARY KEY AUTO_INCREMENT,
username VARCHAR(50) UNIQUE NOT NULL,
email VARCHAR(100) UNIQUE NOT NULL,
password_hash VARCHAR(255) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

// 创建 conversations 表（如果不存在）
await pool.query(`
CREATE TABLE IF NOT EXISTS conversations (
id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
title VARCHAR(200) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`);

// 创建 messages 表（如果不存在）
await pool.query(`
CREATE TABLE IF NOT EXISTS messages (
id INT PRIMARY KEY AUTO_INCREMENT,
conversation_id INT NOT NULL,
role ENUM('user', 'assistant') NOT NULL,
content TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
)
`);

// 创建 knowledge_documents 表（如果不存在）
await pool.query(`
CREATE TABLE IF NOT EXISTS knowledge_documents (
id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
title VARCHAR(200) NOT NULL,
doc_type VARCHAR(50) DEFAULT 'text',
content TEXT NOT NULL,
chunk_count INT DEFAULT 0,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
INDEX idx_user_id (user_id)
)
`);


  // 添加性能索引（忽略已存在的）
  try { await pool.query('CREATE INDEX idx_conversations_user_id ON conversations (user_id)'); } catch {}
  try { await pool.query('CREATE INDEX idx_messages_conversation_id ON messages (conversation_id)'); } catch {}
  try { await pool.query('CREATE INDEX idx_users_email ON users (email)'); } catch {}
console.log('✅ 数据库表检查/创建完成！');
} catch (error: any) {
console.error('❌ 初始化数据库表失败:', error.message);
throw error;
}
};

export { createTablesIfNotExist };
