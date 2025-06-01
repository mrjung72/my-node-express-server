const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const authenticateJWT = require('../middleware/auth')

// 회원 목록 조회
router.get('/', async (req, res) => {
  try {
    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT userid, name, email, isAdmin, createdAt FROM members')
    conn.release()
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).send('Database query failed')
  }
})

// 회원 등록
router.post('/', authenticateJWT, async (req, res) => {
  let { name, email, userid, password, status_cd, isAdmin, user_pc_ip } = req.body
  const regUserId = req.user?.userid // 인증 미들웨어에서 세팅
  const regUserIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  console.log(`User ${userid} was registered by ${req.user?.userid} on ${regUserIp}`)

  if (!user_pc_ip || user_pc_ip.trim() === '') {
    user_pc_ip  = regUserIp
  }
  
  try {
    const conn = await mypool.getConnection()
    const hashedpassword = await bcrypt.hash(password, 10)
    const sql = 'INSERT INTO members (name, email, userid, password, status_cd, isAdmin, user_pc_ip, reg_pc_ip, reg_userid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const [result] = await conn.query(sql, [name, email, userid, hashedpassword, status_cd ? status_cd : 'A', isAdmin ? 1 : 0, user_pc_ip, regUserIp, regUserId])
    conn.release()
    res.status(201).json({ userid, name, email, status_cd, isAdmin })
  } catch (err) {
    console.error(err)
    res.status(500).send('Insert failed')
  }
})

// 회원 수정
router.put('/:userid', async (req, res) => {
  const { name, isAdmin } = req.body
  const { userid } = req.params
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

// 회원 삭제
router.delete('/:userid', async (req, res) => {
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
