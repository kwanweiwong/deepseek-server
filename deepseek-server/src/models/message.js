const pool = require('./db');

const MessageModel = {
  async create(conversationId, role, content) {
    const [result] = await pool.execute(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [conversationId, role, content]
    );
    return result.insertId;
  },

  async findByConversationId(conversationId) {
    const [rows] = await pool.execute(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );
    return rows;
  }
};

module.exports = MessageModel;
