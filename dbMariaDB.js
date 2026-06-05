const mysql = require('mysql2/promise')
require('dotenv').config()

const poolConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
}

if (process.env.INSTANCE_CONNECTION_NAME) {
  // Cloud Run에서 Cloud SQL 연결 시 (Unix Domain Socket)
  poolConfig.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
} else {
  // 로컬 또는 기타 환경 (TCP)
  poolConfig.host = process.env.DB_HOST || 'localhost'
  poolConfig.port = Number(process.env.DB_PORT || 3306)
}

const pool = mysql.createPool(poolConfig)

module.exports = pool
