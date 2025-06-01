// server.js
const express = require('express')
const router = express.Router()
const multer = require('multer');
const mypool = require('../db');
require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcrypt');
const iconv = require('iconv-lite')
const authenticateJWT = require('../middleware/auth')

// multer 설정
const upload = multer({ dest: 'uploads/' });
const { uploadCsvFile } = require('../utils/csvUploader');
const { inputServersData } = require('../utils/InitDataSetter');

router.post('/members', authenticateJWT, upload.single('file'), async (req, res) => {

    const filePath = req.file.path
    const results = []
    const insertedRows = [];

    const regUserId = req.user?.userid // 인증 미들웨어에서 세팅
    const regUserIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    console.log(`This Csv members were registered by ${req.user?.userid} on ${regUserIp}`)

    fs.createReadStream(filePath)
        .pipe(iconv.decodeStream('euc-kr')) // <-- 인코딩 변환
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim() // 헤더 공백 제거
        }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                const conn = await mypool.getConnection()

                for (let row of results) {
                    // 유효성 검사 및 중복 체크 예시
                    if (!row.name || !row.email || !row.email.includes('@')) {
                        console.log('유효하지 않은 데이터:', row)
                        continue
                    }
                    const hashedPassword = await bcrypt.hash(row.password, 10)

                    const sql = 'INSERT INTO members (name, email, userid, password, isAdmin, user_pc_ip, reg_pc_ip, reg_userid, reg_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    await conn.query(sql, [row.name, row.email, row.userid, hashedPassword, row.isAdmin, row.user_pc_ip, regUserIp, regUserId, 'CSV'])
                    insertedRows.push(1);
                }

                conn.release()
                fs.unlinkSync(filePath) // 업로드된 파일 삭제
                res.json({ message: `총 ${insertedRows.length}건의 데이터가 업로드되었습니다.!!!`})
            } catch (err) {
                console.error(err)
                res.status(500).json({ message: '[ERROR] ' + err.message})
            }
        })
})


router.post('/servers', authenticateJWT, upload.single('file'), async (req, res) => {
    const filePath = req.file.path
    const columns = ['server_ip', 'hostname', 'port', 'corp_id', 'env_type', 'proc_id', 'usage_type', 'role_type', 'check_yn', 'db_name', 'descryption'] // server 테이블 컬럼
    try {
        const result = await uploadCsvFile(filePath, 'servers_temp', columns, mypool, true) 
        await inputServersData(mypool)
        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, error: err.sqlMessage })
    }
})

module.exports = router