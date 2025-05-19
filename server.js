// server.js
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mysql = require('mysql2');
const mssql = require('mssql');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors');
const mypool = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());



// 로그인 API
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body

    try {
        const conn = await mypool.getConnection()
        const rows = await conn.query('SELECT * FROM users WHERE username = ?', [username])
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
                username: user.username,
                email: user.email
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: err.message })
    }
})


// Add a user
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {

    const hashedpassword = await bcrypt.hash(password, 10)

    const conn = await mypool.getConnection();
    const result = await conn.query('INSERT INTO users(username, password, email) VALUES(?, ?, ?)', [username, hashedpassword, email]);
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
                const conn = await mypool.getConnection()

                for (const row of results) {
                    // 유효성 검사 및 중복 체크 예시
                    if (!row.username || !row.email) {
                        console.log('유효하지 않은 데이터:', row)
                        continue
                    }

                    const exists = await conn.query('SELECT id FROM users WHERE email = ?', [row.email] )

                    if (exists[0].length === 0) {

                        const hashedpassword = await bcrypt.hash(row.password, 10)
                        await conn.query(
                            'INSERT INTO users(username, password, email) VALUES(?, ?, ?)',
                            [row.username, hashedpassword, row.email]
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



const commonDBConfig = {
  user: 'sahara',
  password: '1111',
  database: 'master',
  port: 1433, // 기본 MSSQL 포트
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};



// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const conn = await mypool.getConnection();
    const rows = await conn.query('SELECT * FROM users');
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database query failed');
  }
});


app.get('/api/remotedb-status', async (req, res) => {

    console.log('remotedb-status API called');
    const ipList = fs.readFileSync('resources/remotedb_server_ips.txt', 'utf-8').split('\n').map(ip => ip.trim()).filter(Boolean);
    console.log('IP List:', ipList);
    const results = [];

    await Promise.allSettled(

      ipList.map(async (ip) => {
        try {
          const conn = await mssql.connect({ ...commonDBConfig, server: ip });
          const result = await conn.request().query('SELECT @@VERSION AS version');
          await conn.close();
          results.push({ ip, status: 'connected', version: result.recordset[0].version });
          console.log(`Connected to ${ip}:`, result.recordset[0].version);

        } catch (error) {
          console.error(`[❌] DB 연결 실패 : ${ip}:`, error.message);
          results.push({ ip, status: 'error', message: error.message });
        }
      })
    );
    
    res.json(results);
  });

  // server.js
app.get('/api/server-list', async (req, res) => {


    const conn = await mypool.getConnection();
    const rows = await conn.query('SELECT * FROM servers');
    const servers = rows.recordset;
    conn.release();

    // 응답은 서버 목록만 먼저 전달
    res.json(rows[0])

    // 서버 상태 확인은 클라이언트가 개별적으로 요청
})

// 개별 서버 상태 확인용 엔드포인트
app.get('/api/server-status/:id', async (req, res) => {
    const { id } = req.params
    const myconn = await mypool.getConnection();
    const rows = await mypool.execute('SELECT ip FROM servers WHERE id = ?', [id]);
    myconn.release();

    const server = rows[0][0];
    if (!server) return res.status(404).json({ error: 'Server not found' })

    // MSSQL 접속 확인
    try {
          const conn = await mssql.connect({ ...commonDBConfig, server: server.ip });
          const version = await conn.request().query('SELECT @@VERSION AS version')
          await conn.close();

        res.json({ status: 'connected', version: version.recordset[0].version })
    } catch (err) {
        res.json({ status: 'error', error: err.message })
    }
})


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
