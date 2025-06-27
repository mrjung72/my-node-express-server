const express = require('express');
const router = express.Router();
const db = require('../db'); // MariaDB 커넥션

// 답글 목록 조회 (특정 게시글)
router.get('/:board_id', async (req, res) => {
  const { board_id } = req.params;
  const [rows] = await db.query(
    'SELECT * FROM board_replies WHERE board_id = ? ORDER BY createdAt ASC',
    [board_id]
  );
  res.json(rows);
});

// 답글 등록
router.post('/', async (req, res) => {
  const { board_id, parent_id, userid, content } = req.body;
  if (!board_id || !userid || !content) return res.status(400).json({ message: '필수값 누락' });
  await db.query(
    'INSERT INTO board_replies (board_id, parent_id, userid, content) VALUES (?, ?, ?, ?)',
    [board_id, parent_id || null, userid, content]
  );
  res.json({ message: '등록 완료' });
});

// 답글 삭제
router.delete('/:reply_id', async (req, res) => {
  const { reply_id } = req.params;
  await db.query('DELETE FROM board_replies WHERE reply_id = ?', [reply_id]);
  res.json({ message: '삭제 완료' });
});

module.exports = router;
