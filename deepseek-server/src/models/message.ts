import pool, { RowDataPacket, ResultSetHeader } from './db';

// 消息接口定义
interface Message {
  id?: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface MessageRow extends RowDataPacket, Message { }

const MessageModel = {
  /**
  * 创建消息
  * @param conversationId - 对话 ID
  * @param role - 角色 (user/assistant)
  * @param content - 消息内容
  * @returns 返回新创建消息的 ID
  */
  async create(conversationId: number, role: 'user' | 'assistant', content: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [conversationId, role, content]
    );
    return result.insertId;
  },

  /**
  * 根据对话 ID 查找所有消息
  * @param conversationId - 对话 ID
  * @returns 返回消息数组
  */
  async findByConversationId(conversationId: number, limit?: number): Promise<Message[]> {
    if (limit) {
      const [rows] = await pool.query<MessageRow[]>(
        `SELECT * FROM (
          SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?
        ) sub ORDER BY created_at ASC`,
        [conversationId, limit]
      );
      return rows;
    }
    const [rows] = await pool.execute<MessageRow[]>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );
    return rows;
  },

  /**
  * 删除对话的所有消息
  * @param conversationId - 对话 ID
  */
  async deleteByConversationId(conversationId: number): Promise<void> {
    await pool.execute('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
  }
};

export default MessageModel;
