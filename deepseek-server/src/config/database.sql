-- 创建数据库 deepseek_clone（如果不存在），并设置默认字符集为 utf8mb4，排序规则为 utf8mb4_unicode_ci，以支持完整的 Unicode 字符（包括 emoji）
CREATE DATABASE IF NOT EXISTS deepseek_clone DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 切换到 deepseek_clone 数据库进行后续表结构定义
USE deepseek_clone;

-- 创建用户表 users，用于存储系统用户的基本认证信息
CREATE TABLE IF NOT EXISTS users (
  -- 用户唯一标识，自增主键
  id INT PRIMARY KEY AUTO_INCREMENT,
  -- 用户名，唯一且非空，最大长度 50 字符
  username VARCHAR(50) UNIQUE NOT NULL,
  -- 邮箱地址，唯一且非空，最大长度 100 字符
  email VARCHAR(100) UNIQUE NOT NULL,
  -- 密码的哈希值，非空，最大长度 255 字符（适配 bcrypt 等常见哈希算法）
  password_hash VARCHAR(255) NOT NULL,
  -- 用户注册时间，默认为当前时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建会话表 conversations，用于存储用户与助手之间的对话会话元数据
CREATE TABLE IF NOT EXISTS conversations (
  -- 会话唯一标识，自增主键
  id INT PRIMARY KEY AUTO_INCREMENT,
  -- 关联的用户 ID，外键引用 users 表，删除用户时级联删除其所有会话
  user_id INT NOT NULL,
  -- 会话标题，非空，最大长度 200 字符
  title VARCHAR(200) NOT NULL,
  -- 会话创建时间，默认为当前时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 定义外键约束：user_id 引用 users(id)，启用级联删除
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建消息表 messages，用于存储会话中的具体对话内容
CREATE TABLE IF NOT EXISTS messages (
  -- 消息唯一标识，自增主键
  id INT PRIMARY KEY AUTO_INCREMENT,
  -- 关联的会话 ID，外键引用 conversations 表，删除会话时级联删除其中所有消息
  conversation_id INT NOT NULL,
  -- 消息角色，枚举类型，仅允许 'user'（用户）或 'assistant'（助手）
  role ENUM('user', 'assistant') NOT NULL,
  -- 消息内容，非空，使用 TEXT 类型以支持较长文本
  content TEXT NOT NULL,
  -- 消息创建时间，默认为当前时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 定义外键约束：conversation_id 引用 conversations(id)，启用级联删除
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 创建知识库表 knowledge_documents，用于存储用户上传的知识库文档
CREATE TABLE IF NOT EXISTS knowledge_documents (
  -- 文档唯一标识，自增主键
  id INT PRIMARY KEY AUTO_INCREMENT,
  -- 关联的用户 ID，外键引用 users 表
  user_id INT NOT NULL,
  -- 文档标题，最大长度 200 字符
  title VARCHAR(200) NOT NULL,
  -- 文档类型（如 text, pdf 等），最大长度 50 字符
  doc_type VARCHAR(50) DEFAULT 'text',
  -- 文档原始内容，TEXT 类型
  content TEXT NOT NULL,
  -- 文档分块数量，用于统计
  chunk_count INT DEFAULT 0,
  -- 文档创建时间，默认为当前时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 定义外键约束：user_id 引用 users(id)，启用级联删除
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 添加索引加速查询
  INDEX idx_user_id (user_id)
);