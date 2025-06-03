const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const { authenticateJWT } = require('../middlewares/auth')
const { validateUserInfo, validateUserId, validateEmail, validateName, validatePassword } = require('../utils/validator')


// 내정보 조회
router.get('/', authenticateJWT, async (req, res) => {
  try {

    const regUserIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT * FROM members WHERE userid = ?', [req.user?.userid])
    conn.release()
    res.json(rows[0][0])
    console.log(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).send('Database query failed')
  }
})

// 내정보 수정
router.put('/', authenticateJWT, async (req, res) => {

  const { name, email} = req.body
  const userid = req.user?.userid
  const regUserIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  const userInfoValidation = validateUserInfo({email:email, name:name})
  if (!userInfoValidation.valid) {
    return res.status(userInfoValidation.code).send(userInfoValidation.message)
  }

  try {
    const conn = await mypool.getConnection()
    const sql = 'UPDATE members SET name = ?, email = ?, updatedAt = current_timestamp() WHERE userid = ?'
    await conn.query(sql, [name, email, userid])
    conn.release()
    res.json({ userid, name })
  } catch (err) {
    console.error(err)
    res.status(500).send('Update failed')
  }
})


// 회원가입
router.post('/', async (req, res) => {

  const { userid, email, name, password } = req.body
  const userPcIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  const userInfoValidation = validateUserInfo({userid:userid, email:email, name:name, password:password})
  if (!userInfoValidation.valid) {
    return res.status(userInfoValidation.code).send(userInfoValidation.message)
  }

  try {
    const conn = await mypool.getConnection()
    const hashedpassword = await bcrypt.hash(password, 10)
    const sql = 'INSERT INTO members (name, email, userid, password, user_pc_ip) VALUES (?, ?, ?, ?, ?)'
    const [result] = await conn.query(sql, [name, email.toLowerCase(), userid.toLowerCase(), hashedpassword, userPcIp])
    conn.release()
    res.status(201).json({ userid, name, email })
  } catch (err) {
    console.error(err)
    res.status(500).send('[ERROR] ' + err.message)
  }
})

module.exports = router
