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

// multer 설정
const upload = multer({ dest: 'uploads/' });
const { uploadCsvFile } = require('../utils/csvUploader');

router.post('/members', upload.single('file'), async (req, res) => {

    const filePath = req.file.path
    const results = []
    const insertedRows = [];

    fs.createReadStream(filePath)
        .pipe(iconv.decodeStream('euc-kr')) // <-- 인코딩 변환
        .pipe(csv())
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
                    const userid = row.email.split('@')[0]; // 이메일에서 userid 추출

                    await conn.query(
                        'INSERT INTO members(name, email, userid, password, isAdmin) VALUES(?, ?, ?, ?, ?)',
                        [row.name, row.email, userid, hashedPassword, row.isAdmin]
                    )
                    insertedRows.push(1);
                }

                conn.release()
                fs.unlinkSync(filePath) // 업로드된 파일 삭제
                res.json({ message: `총 ${insertedRows.length}건의 데이터가 업로드되었습니다.!!!`})
            } catch (err) {
                console.error(err)
                res.status(500).json({ message: '서버 오류' })
            }
        })
})


router.post('/servers', upload.single('file'), async (req, res) => {
    const filePath = req.file.path
    const columns = ['ip', 'port', 'name', 'corp_id', 'category', 'server_type', 'env_type', 'role_type'] // server 테이블 컬럼
    try {
        const result = await uploadCsvFile(filePath, 'servers', columns, mypool) 
        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, error: err.sqlMessage })
    }
})

module.exports = router