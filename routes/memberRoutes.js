const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

// 회원 목록 조회
router.get('/', async (req, res) => {
  try {
    const conn = await mypool.getConnection()
    const rows = await conn.query('SELECT * FROM members')
    conn.release()
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).send('Database query failed')
  }
})

// 회원 등록
router.post('/', async (req, res) => {
  const { name, email, password, isAdmin } = req.body
  try {
    const conn = await mypool.getConnection()
    const hashedpassword = await bcrypt.hash(password, 10)
    const sql = 'INSERT INTO members (name, email, password, isAdmin) VALUES (?, ?, ?, ?)'
    const [result] = await conn.query(sql, [name, email, hashedpassword, isAdmin ? 1 : 0])
    conn.release()
    res.status(201).json({ id: result.insertId, name, email, password, isAdmin })
  } catch (err) {
    console.error(err)
    res.status(500).send('Insert failed')
  }
})

// 회원 수정
router.put('/:id', async (req, res) => {
  const { name, email, isAdmin } = req.body
  const { id } = req.params
  try {
    const conn = await mypool.getConnection()
    const sql = 'UPDATE members SET name = ?, email = ?, isAdmin = ?, updatedAt = current_timestamp() WHERE id = ?'
    await conn.query(sql, [name, email, isAdmin ? 1 : 0, id])
    conn.release()
    res.json({ id, name, email, isAdmin })
  } catch (err) {
    console.error(err)
    res.status(500).send('Update failed')
  }
})

// 회원 삭제
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const conn = await mypool.getConnection()
    await conn.query('DELETE FROM members WHERE id = ?', [id])
    conn.release()
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).send('Delete failed')
  }
})

module.exports = router
