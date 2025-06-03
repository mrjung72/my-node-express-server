const express = require('express')
const router = express.Router()
const fs = require('fs')
const mssql = require('mssql')
const mypool = require('../db')
const { authenticateJWT, requireAdmin } = require('../middlewares/auth')

const remoteDBConfig = {
  user: 'sahara',
  password: '1111',
  database: 'master',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
}

// 서버 목록 조회
router.get('/', authenticateJWT, async (req, res) => {
  const conn = await mypool.getConnection()
  const query = `
            SELECT d.server_port_id
              , m.server_ip
              , m.corp_id 
              , m.hostname
              , m.env_type 
              , d.proc_id 
              , d.usage_type 
              , m.role_type 
              , m.status_cd 
              , d.port
              , d.stat_check_target_yn 
            FROM servers m, servers_port d 
            WHERE m.server_ip  = d.server_ip 
            ORDER BY m.server_ip, d.proc_id, d.usage_type`
  const rows = await conn.query(query)
  conn.release()
  res.json(rows[0])
})

// 개별 서버 상태 확인
router.get('/status/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params
  const myconn = await mypool.getConnection()
  const rows = await myconn.execute('SELECT ip FROM servers WHERE id = ?', [id])
  myconn.release()

  const server = rows[0][0]
  if (!server) return res.status(404).json({ error: 'Server not found' })

  try {
    const conn = await mssql.connect({ ...remoteDBConfig, server: server.ip })
    const version = await conn.request().query('SELECT @@VERSION AS version')
    await conn.close()
    res.json({ status: 'connected', version: version.recordset[0].version })
  } catch (err) {
    res.json({ status: 'error', error: err.message })
  }
})

// 여러 서버 상태 확인
router.get('/status', authenticateJWT, async (req, res) => {
  const ipList = fs.readFileSync('resources/remotedb_server_ips.txt', 'utf-8')
    .split('\n')
    .map(ip => ip.trim())
    .filter(Boolean)

  const results = []

  await Promise.allSettled(ipList.map(async (ip) => {
    try {
      const conn = await mssql.connect({ ...remoteDBConfig, server: ip })
      const result = await conn.request().query('SELECT @@VERSION AS version')
      await conn.close()
      results.push({ ip, status: 'connected', version: result.recordset[0].version })
    } catch (error) {
      results.push({ ip, status: 'error', message: error.message })
    }
  }))

  res.json(results)
})

module.exports = router
