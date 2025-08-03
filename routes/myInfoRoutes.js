const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const { authenticateJWT } = require('../middlewares/auth')
const { validateUserInfo } = require('../utils/validator')
const admins = require('../utils/AdminDefine')
const { validatePassword } = require('../utils/validator')


// 내정보 조회
router.get('/', authenticateJWT, async (req, res) => {

  const userid = req.user?.userid
  
  // 현재 접속 PC IP 추출
  const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
                  (req.socket ? req.socket.remoteAddress : null) ||
                  (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
  const realClientIp = clientIp ? clientIp.replace(/^::ffff:/, '') : ''

  if(admins[userid]) {
    // 관리자의 경우 PC IP 정보 추가하여 반환
    return res.json({
      ...admins[userid],
      current_pc_ip: realClientIp
    })
  }       

  try {
    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT * FROM members WHERE userid = ?', [userid])
    conn.release()
    
    const userInfo = rows[0][0]
    if (userInfo) {
      // 사용자 정보에 현재 PC IP 추가
      userInfo.current_pc_ip = realClientIp
    }
    
    res.json(userInfo)
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
  const userPcIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
                  (req.socket ? req.socket.remoteAddress : null) ||
                  (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)

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


// 본인 비밀번호 변경
router.put('/change-password', authenticateJWT, async (req, res) => {

  const { currentPassword, newPassword } = req.body;
  const userid = req.user?.userid;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 모두 입력하세요.' });
  }

  // 새 비밀번호 유효성 검사
  const result = validatePassword(newPassword);
  if (!result.valid) {
    return res.status(400).json({ message: result.message });
  }

  try {
    const conn = await mypool.getConnection();
    const [rows] = await conn.query('SELECT password FROM members WHERE userid = ?', [userid]);
    if (!rows.length) {
      conn.release();
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      conn.release();
      return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await conn.query('UPDATE members SET password = ? WHERE userid = ?', [hashed, userid]);
    conn.release();
    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

module.exports = router
