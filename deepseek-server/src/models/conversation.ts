import pool, { RowDataPacket, ResultSetHeader } from './db';

// 对话接口定义
interface Conversation {
id?: number;
user_id: number;
title: string;
created_at?: string;
updated_at?: string;
}

interface ConversationRow extends RowDataPacket, Conversation {}

const ConversationModel = {
/**
* 创建新对话
* @param userId - 用户 ID
* @param title - 对话标题
* @returns 返回新创建对话的 ID
*/
async create(userId: number, title: string): Promise<number> {
const [result] = await pool.execute<ResultSetHeader>(
'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
[userId, title]
);
return result.insertId;
},

/**
* 根据用户 ID 查找所有对话
* @param userId - 用户 ID
* @returns 返回对话数组
*/
async findByUserId(userId: number): Promise<Conversation[]> {
const [rows] = await pool.execute<ConversationRow[]>(
'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC',
[userId]
);
return rows;
},

/**
* 根据 ID 查找对话
* @param id - 对话 ID
* @returns 返回对话对象
*/
async findById(id: number): Promise<Conversation | undefined> {
const [rows] = await pool.execute<ConversationRow[]>(
'SELECT * FROM conversations WHERE id = ?',
[id]
);
return rows[0];
},

/**
* 更新对话标题
* @param id - 对话 ID
* @param title - 新标题
*/
async updateTitle(id: number, title: string): Promise<boolean> {
const [result] = await pool.execute<ResultSetHeader>(
'UPDATE conversations SET title = ? WHERE id = ?',
[title, id]
);
return result.affectedRows > 0;
},

/**
* 删除对话
* @param id - 对话 ID
*/
async delete(id: number, userId: number): Promise<boolean> {
const [result] = await pool.execute<ResultSetHeader>(
'DELETE FROM conversations WHERE id = ? AND user_id = ?',
[id, userId]
);
return result.affectedRows > 0;
}
};

export default ConversationModel;
