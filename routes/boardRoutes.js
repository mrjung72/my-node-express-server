const express = require('express');
const multer = require('multer');
const path = require('path');
const mypool = require('../db')
const fs = require('fs');
const jwt = require('jsonwebtoken');
const iconv = require('iconv-lite');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth')

const router = express.Router();

const upload = multer({ dest: 'uploads/board/' });

// 게시글 목록
router.get('/', async (req, res) => {
    const conn = await mypool.getConnection();
    const [rows] = await conn.query('SELECT * FROM boards order by board_id desc ');
    conn.release();
    
  res.json(rows);
});

// 게시글 등록 (파일 첨부 가능, 인증 필요)
router.post('/', authenticateJWT, upload.single('file'), async (req, res) => {

  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: '필수 항목 누락' });
  }
  const userid = req.user?.userid // 인증 미들웨어에서 세팅

  try {
    const conn = await mypool.getConnection()
    const sql = 'INSERT INTO boards (title, content, userid, filepath) VALUES (?, ?, ?, ?)'
    const [result] = await conn.query(sql, [title, content, userid, req.file ? req.file.filename : null])
    conn.release()
    res.status(201).json({ userid, title })
  } catch (err) {
    console.error(err)
    res.status(500).send('[ERROR] ' + err.message)
  }
});

// 파일 다운로드 (한글 파일명 지원)
router.get('/download/:board_id', async (req, res) => {
  const { board_id } = req.params;
  const conn = await mypool.getConnection();
  const [rows] = await conn.query('SELECT * FROM boards WHERE board_id = ?', [board_id]);
  conn.release();

  if (!rows.length) return res.status(404).send('File not found');

  const post = rows[0];
  if (!post.filepath) return res.status(404).send('No file attached');

  // 실제 파일 경로
  const filePath = path.join(__dirname, '../uploads/board', post.filepath);

  let originalName = post.originalname || post.filepath;

  // 브라우저별 한글 파일명 처리
  const userAgent = req.headers['user-agent'] || '';
  let encodedName = encodeURIComponent(originalName);
  let disposition = `attachment; filename*=UTF-8''${encodedName}`;
  if (/MSIE|Trident/.test(userAgent)) {
    // IE
    disposition = 'attachment; filename=' + iconv.encode(originalName, 'euc-kr').toString('binary');
  }
  res.setHeader('Content-Disposition', disposition);
  res.sendFile(filePath);
});

// 게시글 상세조회
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await mypool.getConnection();
  const [rows] = await conn.query('SELECT * FROM boards WHERE board_id = ?', [id]);
  conn.release();
  if (!rows.length) return res.status(404).json({ message: '게시글이 없습니다.' });
  res.json(rows[0]);
});

// 게시글 수정
router.put('/:id', authenticateJWT, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const userid = req.user?.userid;
  if (!title || !content) return res.status(400).json({ message: '필수 항목 누락' });
  const conn = await mypool.getConnection();
  const [rows] = await conn.query('SELECT * FROM boards WHERE board_id = ?', [id]);
  if (!rows.length) {
    conn.release();
    return res.status(404).json({ message: '게시글이 없습니다.' });
  }
  const post = rows[0];
  if (post.userid !== userid) {
    conn.release();
    return res.status(403).json({ message: '수정 권한이 없습니다.' });
  }
  // 파일 교체 시 기존 파일 삭제
  let filepath = post.filepath;
  let originalname = post.originalname;
  if (req.file) {
    if (filepath) {
      const oldPath = path.join(uploadDir, filepath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    filepath = req.file.filename;
    originalname = req.file.originalname;
  }
  await conn.query('UPDATE boards SET title=?, content=?, filepath=? WHERE board_id=?', [title, content, filepath, id]);
  conn.release();
  res.json({ message: '수정되었습니다.' });
});

// 게시글 삭제
router.delete('/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const userid = req.user?.userid;
  const conn = await mypool.getConnection();
  const [rows] = await conn.query('SELECT * FROM boards WHERE board_id = ?', [id]);
  if (!rows.length) {
    conn.release();
    return res.status(404).json({ message: '게시글이 없습니다.' });
  }
  const post = rows[0];
  if (post.userid !== userid) {
    conn.release();
    return res.status(403).json({ message: '삭제 권한이 없습니다.' });
  }
  // 파일 삭제
  if (post.filepath) {
    const filePath = path.join(uploadDir, post.filepath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await conn.query('DELETE FROM boards WHERE board_id = ?', [id]);
  conn.release();
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
