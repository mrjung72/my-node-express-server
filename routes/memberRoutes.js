const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

// 회원 목록 조회
router.get('/', async (req, res) => {
  try {
    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT userid, name, email, isadmin, createdAt FROM members')
    conn.release()
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).send('Database query failed')
  }
})

// 회원 등록
router.post('/', async (req, res) => {
  const { name, email, userid, password, isAdmin } = req.body
  try {
    const conn = await mypool.getConnection()
    const hashedpassword = await bcrypt.hash(password, 10)
    const sql = 'INSERT INTO members (name, email, userid, password, isAdmin) VALUES (?, ?, ?, ?, ?)'
    const [result] = await conn.query(sql, [name, email, userid, hashedpassword, isAdmin ? 1 : 0])
    conn.release()
    res.status(201).json({ userid: result.insertId, name, email, userid, password, isAdmin })
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
