import mysql, { Pool } from 'mysql2/promise';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export { Pool, RowDataPacket, ResultSetHeader };

// 创建 MySQL 连接池
const pool: Pool = mysql.createPool({
// 数据库主机地址，优先从环境变量读取，默认 localhost
host: process.env.DB_HOST || 'localhost',
// 数据库端口，优先从环境变量读取，默认 3306
port: parseInt(process.env.DB_PORT || '3306'),
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

export default pool;
