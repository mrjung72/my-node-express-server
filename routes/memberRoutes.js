const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const { authenticateJWT, requireAdmin } = require('../middlewares/auth')
const { validatePassword } = require('../utils/validator')
const axios = require('axios')

// 회원 목록 조회
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT userid, name, email, isAdmin, status_cd, createdAt, user_pc_ip FROM members')
    conn.release()
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).send('Database query failed')
  }
})

// 회원ID 중복 확인
router.get('/check-id', async (req, res) => {

  const { userid } = req.query
  const conn = await mypool.getConnection()
  const row = await conn.query('SELECT * FROM members WHERE userid = ?', [userid])
  conn.release()

  if (row[0] && row[0][0] && row[0][0].userid) {
    return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
  }
  return res.json({ message: '사용 가능한 아이디입니다.' });
});

// 이메일 중복 확인
router.get('/check-email', async (req, res) => {

  const { email } = req.query
  const conn = await mypool.getConnection()
  const row = await conn.query('SELECT * FROM members WHERE email = ?', [email])
  conn.release()

  if (row[0] && row[0][0] && row[0][0].email) {
    return res.status(409).json({ message: '이미 등록된 이메일입니다.' });
  }
  return res.json({ message: '사용 가능한 이메일입니다.' });
});

// 회원 등록 (관리자에 의한)
router.post('/', authenticateJWT, requireAdmin, async (req, res) => {

  let { name, email, userid, isAdmin, user_pc_ip, password } = req.body
  const adminId = req.user?.userid // 인증 미들웨어에서 세팅
  const adminPcIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  
  // 비밀번호 유효성 검사
  if (password) {
    const result = validatePassword(password)
    if (!result.valid) {
      return res.status(400).json({ message: result.message })
    }
  }

  try {
    const conn = await mypool.getConnection()
    const hashedPassword = await bcrypt.hash(password || process.env.USER_INIT_PASSWORD, 10)
    const sql = 'INSERT INTO members (name, email, userid, password, status_cd, isAdmin, user_pc_ip, reg_pc_ip, reg_userid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const [result] = await conn.query(sql, [name, email, userid, hashedPassword, 'Y', isAdmin, user_pc_ip, adminPcIp, adminId])
    conn.release()
    res.status(201).json({ userid, name, email, isAdmin })
  } catch (err) {
    console.error(err)
    res.status(500).send('[ERROR] ' + err.message)
  }
})

// 회원 수정 (관리자에 의한)
router.put('/:userid', authenticateJWT, requireAdmin, async (req, res) => {

  const { name, isAdmin } = req.body
  const { userid } = req.params
  const adminId = req.user?.userid // 인증 미들웨어에서 세팅

  try {
    const conn = await mypool.getConnection()
    const sql = 'UPDATE members SET name = ?, isAdmin = ?, updatedAt = current_timestamp() WHERE userid = ?'
    await conn.query(sql, [name, isAdmin ? 1 : 0, userid])
    conn.release()
    res.json({ userid, name, isAdmin })
  } catch (err) {
    console.error(err)
    res.status(500).send('Update failed')
  }
})

// 회원 삭제 (관리자에 의한)
router.delete('/:userid', authenticateJWT, requireAdmin, async (req, res) => {
  const { userid } = req.params
  try {
    const conn = await mypool.getConnection()
    await conn.query('DELETE FROM members WHERE userid = ?', [userid])
    conn.release()
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).send('Delete failed')
  }
})

// 회원 승인 (관리자에 의한)
router.get('/approval', authenticateJWT, requireAdmin, async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: '[ERROR] userid is required' });
  }

  try {
    const conn = await mypool.getConnection();
    
    // 회원 정보 조회
    const [memberRows] = await conn.query('SELECT name, email FROM members WHERE userid = ? AND status_cd = ?', [userid, 'A']);
    
    if (memberRows.length === 0) {
      conn.release();
      return res.status(404).json({ message: '[ERROR] Member not found or already approved' });
    }

    const member = memberRows[0];
    
    // 상태 업데이트
    const [result] = await conn.query('UPDATE members SET status_cd = ? WHERE userid = ? AND status_cd = ?', ['Y', userid, 'A']);
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '[ERROR] Member not found' });
    }

    // 이메일 전송 (비동기로 처리하여 응답 지연 방지)
    try {
      const emailResponse = await axios.post(`${req.protocol}://${req.get('host')}/api/email/send-approval-notification`, {
        email: member.email,
        name: member.name,
        userid: userid
      });
      
      console.log('승인 알림 이메일 전송 성공:', emailResponse.data);
    } catch (emailError) {
      console.error('승인 알림 이메일 전송 실패:', emailError.message);
      // 이메일 전송 실패해도 승인은 성공으로 처리
    }

    return res.json({ 
      message: '회원 승인이 완료되었습니다.',
      emailSent: true,
      member: {
        userid: userid,
        name: member.name,
        email: member.email
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '[ERROR] Approval failed', error: err.message });
  }
});

// 회원 패스워드 초기화 (관리자에 의한)
router.get('/init-password', authenticateJWT, requireAdmin, async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: '[ERROR] userid is required' });
  }

  try {
    const conn = await mypool.getConnection();
    const hashedPassword = await bcrypt.hash(process.env.USER_INIT_PASSWORD, 10)
    const [result] = await conn.query('UPDATE members SET password = ? WHERE userid = ? AND isAdmin = ?', [hashedPassword, userid, 0]);
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '[ERROR] Member not found' });
    }

    return res.json({message:process.env.USER_INIT_PASSWORD}); // 성공. No Content
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '[ERROR] Init password failed', error: err.message });
  }
});

// 미승인 가입회원 수 반환
router.get('/pending-count', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const conn = await mypool.getConnection();
    const [rows] = await conn.query("SELECT COUNT(*) as count FROM members WHERE status_cd = 'A'");
    conn.release();
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ message: 'DB error', error: err.message });
  }
});

module.exports = router
