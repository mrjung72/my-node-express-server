const express = require('express');
const router = express.Router();
const mypool = require('../db');

// sql_exec_log 기록용 API
router.post('/db', async (req, res) => {

  const {
    check_unit_id, 
    server_ip,
    port,
    dbname,
    pc_ip,
    result_code,
    error_code,
    error_msg,
    collapsed_time
  } = req.body;

  if (!server_ip || !port || !dbname || !pc_ip) {
    return res.status(400).json({ error: '필수값 누락' });
  }

  try {
    const conn = await mypool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO check_server_log (check_unit_id, check_method, server_ip, port, dbname, pc_ip, result_code, error_code, error_msg, collapsed_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [check_unit_id, 'DB_CONN', server_ip, port, dbname, pc_ip, result_code, error_code, error_msg, collapsed_time]
    );
    conn.release();
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message });
  }
});


router.post('/telnet', async (req, res) => {

  const {
    check_unit_id, 
    server_ip,
    port,
    pc_ip,
    result_code,
    error_code,
    error_msg,
    collapsed_time
  } = req.body;

  if (!server_ip || !port || !pc_ip) {
    return res.status(400).json({ error: '필수값 누락' });
  }

  try {
    const conn = await mypool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO check_server_log (check_unit_id, check_method, server_ip, port, pc_ip, result_code, error_code, error_msg, collapsed_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [check_unit_id, 'TELNET', server_ip, port, pc_ip, result_code, error_code, error_msg, collapsed_time]
    );
    conn.release();
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message });
  }
});


// 서버 접속 상태체크 이력 조회 API 추가
router.get('/history', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
                    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    
    // 실제 클라이언트 IP 추출 (프록시 환경 고려)
    const realClientIp = clientIp.replace(/^::ffff:/, '')
    
    const conn = await mypool.getConnection()
    const query = `
      SELECT 
        check_unit_id, 
        server_ip,
        port,
        pc_ip,
        result_code,
        error_code,
        error_msg,
        collapsed_time
      FROM check_server_log 
      WHERE pc_ip = ?
      ORDER BY createdAt DESC
      LIMIT 1000
    `
    const [rows] = await conn.query(query, [realClientIp])
    conn.release()
    
    res.json({
      success: true,
      data: rows,
      total: rows.length
    })
    
  } catch (error) {
    console.error('서버 접속 이력 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: '서버 접속 이력 조회 중 오류가 발생했습니다.'
    })
  }
})

module.exports = router; 