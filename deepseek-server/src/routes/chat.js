const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '聊天服务正常' });
});

module.exports = router;
