const pool = require('./db');

const ConversationModel = {
  async create(userId, title) {
    const [result] = await pool.execute(
      'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
      [userId, title]
    );
    return result.insertId;
  },

  async findByUserId(userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM conversations WHERE id = ?',
      [id]
    );
    return rows[0];
  },

  async updateTitle(id, title) {
    const [result] = await pool.execute(
      'UPDATE conversations SET title = ? WHERE id = ?',
      [title, id]
    );
    return result.affectedRows > 0;
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM conversations WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
};

module.exports = ConversationModel;
