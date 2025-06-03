const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const { authenticateJWT, requireAdmin } = require('../middlewares/auth')

// 회원 목록 조회
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT userid, name, email, isAdmin, status_cd, createdAt FROM members')
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

  let { name, email, userid, isAdmin, user_pc_ip } = req.body
  const adminId = req.user?.userid // 인증 미들웨어에서 세팅
  const adminPcIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  
  try {
    const conn = await mypool.getConnection()
    const hashedPassword = await bcrypt.hash(process.env.USER_INIT_PASSWORD, 10)
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

module.exports = router
