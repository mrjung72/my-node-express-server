const express = require('express')
const sql = require('mssql')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // 로컬 테스트용
    trustServerCertificate: true,
  },
}

// 예제 API: 사용자 리스트 조회
app.get('/api/users', async (req, res) => {
  try {
    const pool = await sql.connect(config)
    const result = await pool.request().query('SELECT * FROM Users')
    res.json(result.recordset)
  } catch (err) {
    console.error('DB Error:', err)
    res.status(500).send('Server Error')
  }
})

const PORT = 4000
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
