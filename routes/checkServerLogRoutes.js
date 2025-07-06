const express = require('express');
const router = express.Router();
const mypool = require('../db');

// DB접속 체크 결과 기록 API 
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

// Telnet 접속 체크 결과 기록 API 
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


// Telnet 접속 체크 이력 조회 API
router.get('/telent', async (req, res) => {
  try {
    const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
                    (req.socket ? req.socket.remoteAddress : null) ||
                    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    
    // 실제 클라이언트 IP 추출 (프록시 환경 고려)
    const realClientIp = clientIp.replace(/^::ffff:/, '')
    
    const conn = await mypool.getConnection()
    const query = `
              select m.yyyymmdd, m.hhmmss, d.server_ip, d.port, d.result_code, d.error_code, d.error_msg,
                    s.corp_id, s.env_type, s.role_type, p.proc_id, p.proc_detail, p.usage_type
              from check_server_log_master m, check_server_log_dtl d, servers_port p, servers s 
              where m.check_unit_id = d.check_unit_id 
              and d.server_ip = p.server_ip 
              and d.port = p.port
              and d.server_ip = s.server_ip
              and m.pc_ip = ?
              and m.check_method = 'TELNET'
              order by m.yyyymmdd desc, m.hhmmss desc
          `
    const [rows] = await conn.query(query, [realClientIp])
    conn.release()
    
    res.json({
      success: true,
      data: rows,
      total: rows.length
    })
    
  } catch (error) {
    console.error('Telnet 접속 이력 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: 'Telnet 접속 이력 조회 중 오류가 발생했습니다.'
    })
  }
})

// DB접속 체크 이력 조회 API
router.get('/db', async (req, res) => {
  try {
    const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
                    (req.socket ? req.socket.remoteAddress : null) ||
                    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    
    // 실제 클라이언트 IP 추출 (프록시 환경 고려)
    const realClientIp = clientIp.replace(/^::ffff:/, '')
    
    const conn = await mypool.getConnection()
    const query = `
              select m.yyyymmdd, m.hhmmss, d.server_ip, d.port, d.result_code, d.error_code, d.error_msg,
                    d.dbname, s.corp_id, s.db_instance_type, s.proc_id, s.proc_detail
              from check_server_log_master m, check_server_log_dtl d, database_instances s
              where m.check_unit_id = d.check_unit_id 
              and d.dbname = s.db_instance_name 
              and m.pc_ip = ?
              and m.check_method = 'DB_CONN'
              order by m.yyyymmdd desc, m.hhmmss desc
          `
    const [rows] = await conn.query(query, [realClientIp])
    conn.release()
    
    res.json({
      success: true,
      data: rows,
      total: rows.length
    })
    
  } catch (error) {
    console.error('DB접속 이력 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: 'DB접속 이력 조회 중 오류가 발생했습니다.'
    })
  }
})

module.exports = router; 