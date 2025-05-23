// server.js
const express = require('express')
const router = express.Router()
const multer = require('multer');
const mypool = require('../db');
require('dotenv').config();


// multer 설정
const upload = multer({ dest: 'uploads/' });
const { uploadCsvFile } = require('../utils/csvUploader');

router.post('/members', upload.single('file'), async (req, res) => {
    const filePath = req.file.path
    const columns = ['name', 'password', 'email', "isadmin"] // users 테이블 컬럼
    try {
        const result = await uploadCsvFile(filePath, 'members', columns, mypool)
        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, error: err.sqlMessage })
    }
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