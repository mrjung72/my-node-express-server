const express = require('express')
const router = express.Router()
const mypool = require('../db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const admins = require('../utils/AdminDefine')

// 로그인 API
router.post('/', async (req, res) => {
    const { userid, password } = req.body

    try {

        let user = null
        if(admins[userid]) {
            user = admins[userid]
        }       
        else {
            // 4. 일반 사용자 데이터베이스 조회
            const conn = await mypool.getConnection();
            try {
                // mysql2는 보통 [rows, fields]를 반환. rows[0]가 실제 사용자 객체 배열.
                const [rows] = await conn.query('SELECT * FROM members WHERE userid = ?', [userid]);
                
                // 조회 결과가 있다면 첫 번째 행을 user로 설정
                if (rows && rows.length > 0) {
                    user = rows[0];
                }
                // else: user는 여전히 null (DB에서 찾지 못함)

            } finally {
                // 쿼리 완료 후 반드시 커넥션 해제
                conn.release();
            }
            
        }

        if (!user) {
          return res.status(401).json({ message: `미등록 사용자 입니다.` })
        }
        else if (!user.status_cd ) {
          return res.status(401).json({ message: `비정상 사용자 입니다.` })
        }
        else if (user.status_cd !== 'Y') {
            
            if (user.status_cd === 'A') {
                return res.status(401).json({ message: `승인 대기중인 사용자 입니다.` })
            }
            else if (user.status_cd === 'N') {
                return res.status(401).json({ message: `탈퇴처리된 사용자 입니다.` })
            }
            else {
                return res.status(401).json({ message: `미정의 상태코드(${user.status_cd})의 사용자 입니다.` })
            }
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' })
        }

        const token = jwt.sign({ userid: user.userid, email: user.email, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1h' })

        res.json({
            message: '로그인 성공',
            token,
            user: {
                userid: user.userid,
                email: user.email,
                name: user.name,
                isAdmin: user.isAdmin,
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: err.message })
    }
})

module.exports = router