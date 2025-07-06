const express = require('express');
const multer = require('multer');
const path = require('path');
const mypool = require('../db')
const fs = require('fs');
const jwt = require('jsonwebtoken');
const iconv = require('iconv-lite');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth')

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/board');

// 업로드 디렉토리 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// multer 설정 개선 - 한글 파일명 지원
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 원본 파일명에서 확장자 추출
    const ext = path.extname(file.originalname);
    // 고유한 파일명 생성 (타임스탬프 + 랜덤)
    const uniqueName = Date.now() + '_' + Math.random().toString(36).substring(2) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
    files: 5 // 최대 5개 파일
  },
  fileFilter: function (req, file, cb) {
    // 파일 타입 검증
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다.'), false);
    }
  }
});

// 게시글 목록
router.get('/', async (req, res) => {
    const conn = await mypool.getConnection();
    const [rows] = await conn.query(`
      SELECT b.*, 
        (SELECT COUNT(*) FROM board_replies r WHERE r.board_id = b.board_id) AS reply_count,
        (SELECT COUNT(*) FROM board_files f WHERE f.board_id = b.board_id) AS file_count
      FROM boards b
      ORDER BY board_id DESC
    `);
    conn.release();
    res.json(rows);
});

// 게시글 등록 (다중 파일 첨부 가능, 인증 필요)
router.post('/', authenticateJWT, upload.array('files', 5), async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: '필수 항목 누락' });
  }
  const userid = req.user?.userid // 인증 미들웨어에서 세팅

  try {
    const conn = await mypool.getConnection()
    
    // 게시글 등록
    const sql = 'INSERT INTO boards (title, content, userid) VALUES (?, ?, ?)'
    const [result] = await conn.query(sql, [title, content, userid])
    const boardId = result.insertId
    
    // 첨부파일 등록
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        // 한글 파일명을 UTF-8로 정규화
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const fileSql = 'INSERT INTO board_files (board_id, filename, origin_filename, file_size, file_type, upload_order) VALUES (?, ?, ?, ?, ?, ?)'
        await conn.query(fileSql, [
          boardId, 
          file.filename, 
          originalName, 
          file.size, 
          file.mimetype, 
          i + 1
        ])
      }
    }
    
    conn.release()
    res.status(201).json({ userid, title, boardId })
  } catch (err) {
    console.error(err)
    res.status(500).send('[ERROR] ' + err.message)
  }
});

// 파일 다운로드 (한글 파일명 지원)
router.get('/download/:file_id', async (req, res) => {

  const { file_id } = req.params;
  const conn = await mypool.getConnection();
  const [rows] = await conn.query('SELECT * FROM board_files WHERE file_id = ?', [file_id]);
  conn.release();

  if (!rows.length) return res.status(404).send('File not found');

  const file = rows[0];

  // 실제 파일 경로
  const filename = path.join(__dirname, '../uploads/board', file.filename);

  if (!fs.existsSync(filename)) {
    return res.status(404).send('File not found on disk');
  }

  let origin_filename = file.origin_filename || file.filename;

  // 브라우저별 한글 파일명 처리 개선
  const userAgent = req.headers['user-agent'] || '';
  
  // Content-Type 설정
  res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
  
  // 한글 파일명 인코딩 처리
  let disposition;
  if (/MSIE|Trident/.test(userAgent)) {
    // IE - EUC-KR 인코딩
    disposition = 'attachment; filename=' + iconv.encode(origin_filename, 'euc-kr').toString('binary');
  } else if (/Chrome/.test(userAgent)) {
    // Chrome - UTF-8 인코딩
    disposition = `attachment; filename*=UTF-8''${encodeURIComponent(origin_filename)}`;
  } else {
    // 기타 브라우저 - UTF-8 인코딩
    disposition = `attachment; filename*=UTF-8''${encodeURIComponent(origin_filename)}`;
  }
  
  res.setHeader('Content-Disposition', disposition);
  res.sendFile(filename);
});

// 게시글 상세조회
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await mypool.getConnection();
  
  // 게시글 정보 조회
  const [boardRows] = await conn.query('SELECT * FROM boards WHERE board_id = ?', [id]);
  if (!boardRows.length) {
    conn.release();
    return res.status(404).json({ message: '게시글이 없습니다.' });
  }
  
  // 첨부파일 정보 조회
  const [fileRows] = await conn.query('SELECT * FROM board_files WHERE board_id = ? ORDER BY upload_order', [id]);
  
  conn.release();
  
  const post = boardRows[0];
  post.files = fileRows;
  
  res.json(post);
});

// 게시글 수정
router.put('/:id', authenticateJWT, upload.array('files', 5), async (req, res) => {
  const { id } = req.params;
  const { title, content, deleteFiles } = req.body;
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

  // 게시글 내용 수정
  await conn.query('UPDATE boards SET title=?, content=? WHERE board_id=?', [title, content, id]);

  // 삭제할 파일 처리
  if (deleteFiles) {
    const deleteFileIds = JSON.parse(deleteFiles);
    for (const fileId of deleteFileIds) {
      const [fileRows] = await conn.query('SELECT * FROM board_files WHERE file_id = ? AND board_id = ?', [fileId, id]);
      if (fileRows.length > 0) {
        const file = fileRows[0];
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await conn.query('DELETE FROM board_files WHERE file_id = ?', [fileId]);
      }
    }
  }

  // 새 파일 추가
  if (req.files && req.files.length > 0) {
    // 현재 파일 개수 확인
    const [currentFiles] = await conn.query('SELECT COUNT(*) as count FROM board_files WHERE board_id = ?', [id]);
    const currentCount = currentFiles[0].count;
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      // 한글 파일명을 UTF-8로 정규화
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const fileSql = 'INSERT INTO board_files (board_id, filename, origin_filename, file_size, file_type, upload_order) VALUES (?, ?, ?, ?, ?, ?)'
      await conn.query(fileSql, [
        id, 
        file.filename, 
        originalName, 
        file.size, 
        file.mimetype, 
        currentCount + i + 1
      ])
    }
  }

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
  
  // 첨부파일 삭제 (CASCADE로 자동 삭제되지만 파일도 함께 삭제)
  const [fileRows] = await conn.query('SELECT * FROM board_files WHERE board_id = ?', [id]);
  for (const file of fileRows) {
    const filename = path.join(uploadDir, file.filename);
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
  }
  
  await conn.query('DELETE FROM boards WHERE board_id = ?', [id]);
  conn.release();
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
