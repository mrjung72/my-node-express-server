const express = require('express');
const router = express.Router();
const mypool = require('../db');
const { authenticateJWT } = require('../middlewares/auth')

// 체크 이력 master 기록 API 
router.post('/master', async (req, res) => {

  const {
    check_method,
    pc_ip
  } = req.body;

  if (!check_method || !pc_ip) {
    return res.status(400).json({ error: '필수값 누락' });
  }

  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hhmmss = new Date().toISOString().slice(11, 16).replace(/:/g, '');

  try {
    const conn = await mypool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO check_server_log_master (yyyymmdd, hhmmss, check_method, pc_ip) VALUES (?, ?, ?, ?)',
      [yyyymmdd, hhmmss, check_method, pc_ip]
    );
    conn.release();
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message });
  }
});


// DB접속 체크 결과 상세 기록 API 
router.post('/db-dtl', async (req, res) => {

  const {
    check_unit_id, 
    server_ip,
    port,
    db_name,
    result_code,
    error_code,
    error_msg,
    collapsed_time
  } = req.body;

  if (!server_ip || !port || !db_name ) {
    return res.status(400).json({ error: '필수값 누락' });
  }

  try {
    const conn = await mypool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO check_server_log_dtl (check_unit_id, server_ip, port, db_name, result_code, error_code, error_msg, collapsed_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [check_unit_id, server_ip, port, db_name, result_code, error_code, error_msg, collapsed_time]
    );
    conn.release();
    res.json({ success: true });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message });
  }
});

// Telnet 접속 체크 결과 상세 기록 API 
router.post('/telnet-dtl', async (req, res) => {

  const {
    check_unit_id, 
    server_ip,
    port,
    result_code,
    error_code,
    error_msg,
    collapsed_time
  } = req.body;

  if (!server_ip || !port ) {
    return res.status(400).json({ error: '필수값 누락' });
  }

  try {
    const conn = await mypool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO check_server_log_dtl (check_unit_id, server_ip, port, result_code, error_code, error_msg, collapsed_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [check_unit_id, server_ip, port, result_code, error_code, error_msg, collapsed_time]
    );
    conn.release();
    res.json({ success: true });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message });
  }
});


// Telnet 접속 체크 이력 조회 API
router.get('/telnet', authenticateJWT, async (req, res) => {
  try {
    const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
                    (req.socket ? req.socket.remoteAddress : null) ||
                    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    
    // 실제 클라이언트 IP 추출 (프록시 환경 고려)
    const realClientIp = clientIp.replace(/^::ffff:/, '')

    const conn = await mypool.getConnection()
    const query = `
              select m.check_unit_id, m.yyyymmdd, m.hhmmss, d.server_ip, d.port, d.result_code, d.error_code, d.error_msg,
                    date_format(d.createdAt, '%Y-%m-%d %T' ) check_datetime,
                    s.hostname, s.corp_id, s.env_type, s.role_type, p.proc_id, p.proc_detail, p.usage_type
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

    const sqlAggr = `
              select m.yyyymmdd, GROUP_CONCAT(CONCAT(m.hhmmss) ORDER BY m.hhmmss SEPARATOR ', ') AS hhmmss_list
              from check_server_log_master m
              where m.pc_ip = ?
              and m.check_method = 'TELNET'
              group by m.yyyymmdd 
            `
    const [unitWorkList] = await conn.query(sqlAggr, [realClientIp])

    console.log('unitWorkList:', unitWorkList)

    conn.release()
    
    res.json({
      success: true,
      pc_ip: realClientIp,
      rows: rows,
      total: rows.length,
      unitWorkList: unitWorkList
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
                    d.db_name, s.corp_id, s.db_instance_type, s.proc_id, s.proc_detail
              from check_server_log_master m, check_server_log_dtl d, database_instances s
              where m.check_unit_id = d.check_unit_id 
              and d.db_name = s.db_instance_name 
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