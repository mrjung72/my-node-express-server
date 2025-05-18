// server.js
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mysql = require('mysql2');

const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());


// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM users');
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database query failed');
  }
});

// Add a user
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const conn = await pool.getConnection();
    const result = await conn.query('INSERT INTO users(username, password, email) VALUES(?, ?, ?)', [username, password, email]);
    conn.release();
    res.json({ id: result.insertId, username, password, email });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to insert user');
  }
});


// multer 설정
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
    const filePath = req.file.path

    const results = []
    const insertedRows = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                const conn = await pool.getConnection()

                for (const row of results) {
                    // 유효성 검사 및 중복 체크 예시
                    if (!row.username || !row.email) {
                        console.log('유효하지 않은 데이터:', row)
                        continue
                    }

                    const exists = await conn.query('SELECT id FROM users WHERE email = ?', [row.email] )

                    if (exists[0].length === 0) {
                        await conn.query(
                            'INSERT INTO users(username, password, email) VALUES(?, ?, ?)',
                            [row.username, row.password, row.email]
                        )
                        insertedRows.push(1);
                    }
                    else {
                        console.log('중복된 데이터:', row)
                    } 
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



app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
