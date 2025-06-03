const express = require('express')
const router = express.Router()
const mypool = require('../db')


// 내정보 조회
router.get('/:groupCode', async (req, res) => {

    const { groupCode } = req.params

    try {
        const conn = await mypool.getConnection()
        const [rows] = await conn.query('SELECT code, label FROM common_codes WHERE group_code = ?', [groupCode])
        conn.release()
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).send('Database query failed')
    }
})


module.exports = router