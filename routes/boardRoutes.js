const express = require('express');
const multer = require('multer');
const path = require('path');
const mypool = require('../db')
const fs = require('fs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// 업로드 폴더 생성
const uploadDir = path.join(__dirname, '../uploads/boards');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });


// 인증 미들웨어
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const token = auth.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// 게시글 목록
router.get('/', async (req, res) => {

    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT * FROM boards ')
    conn.release()
    
  res.json(rows.map(post => ({
    ...post,
    fileUrl: post.file ? `${post.file}` : null
  })));
});

// 게시글 등록 (파일 첨부 가능, 인증 필요)
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {

  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: '필수 항목 누락' });
  }
  const userid = req.user?.userid // 인증 미들웨어에서 세팅

  console.log(upload);


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

module.exports = router;
