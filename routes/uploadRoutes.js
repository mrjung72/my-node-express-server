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
const {authenticateJWT} = require('../middlewares/auth')

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
                const sql = 'INSERT INTO members (name, email, userid, password, isAdmin, status_cd, user_pc_ip, reg_pc_ip, reg_userid, reg_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'

                for (let row of results) {
                    // 유효성 검사 및 중복 체크 예시
                    if (!row.name || !row.email || !row.email.includes('@')) {
                        console.log('유효하지 않은 데이터:', row)
                        continue
                    }
                    const hashedPassword = await bcrypt.hash(process.env.USER_INIT_PASSWORD, 10)
                    await conn.query(sql, [row.name, row.email, row.userid, hashedPassword, row.isAdmin, 'Y', row.user_pc_ip, regUserIp, regUserId, 'CSV'])
                    insertedRows.push(1);
                }

                const sql_his = 'INSERT INTO csv_upload_his (userid, user_pc_ip, upload_type, upload_data_cnt) VALUES (?, ?, ?, ?)';
                await conn.query(sql_his, [regUserId, regUserIp, 'members', insertedRows.length]);

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

    const regUserId = req.user?.userid // 인증 미들웨어에서 세팅
    const regUserIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    console.log(`This Csv servers were registered by ${req.user?.userid} on ${regUserIp}`)
    const filePath = req.file.path
    const columns = ['env_type', 'corp_id', 'group_id', 'proc_detail', 'proc_id', 'usage_type', 'server_ip', 'hostname', 'port', 'role_type', 'category_code', 'descryption', 'db_name', 'db_type'] 
    
    // 최근의 값을 저장하는 컬럼정의
    const columns_save_last_value = ['env_type', 'corp_id', 'group_id', 'proc_detail', 'proc_id', 'usage_type', 'server_ip', 'hostname', 'port'] 

    // 대소문자 변환여부 정의 (UP-대문자, LOW-소문자)
    const UpperLowerCaseDefine = {corp_id:"UP", env_type:"UP", usage_type:"UP", role_type:"UP", category_code:"UP"}
    try {
        const result = await uploadCsvFile(filePath, 'servers_temp', columns, mypool, true, UpperLowerCaseDefine, ['port', 'db_name'], columns_save_last_value)   
        if (result.success) {
            await inputServersData(mypool)
            const sql_his = 'INSERT INTO csv_upload_his (userid, user_pc_ip, upload_type, upload_data_cnt) VALUES (?, ?, ?, ?)'
            await mypool.execute(sql_his, [regUserId, regUserIp, 'servers', result.insertedRows])
        }   
        
        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, error: err.sqlMessage })
    }
})

module.exports = router