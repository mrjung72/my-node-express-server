const express = require('express')
const router = express.Router()

// 로그인 API
router.post('/', async (req, res) => {
    const { email, password } = req.body

    try {
        const conn = await mypool.getConnection()
        const rows = await conn.query('SELECT * FROM members WHERE email = ?', [email])
        conn.release()
        const user = rows[0][0]

        if (!user) {
          return res.status(401).json({ message: `미등록 사용자 입니다.` })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' })
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' })

        res.json({
            message: '로그인 성공',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: err.message })
    }
})

module.exports = router