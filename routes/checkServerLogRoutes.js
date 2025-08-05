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
    console.log('------------------- 필수 파라미터(check_method|pc_ip) 값 누락 ----------------------');
    console.log(req.body);
    return res.status(400).json({ error: '필수값 누락' });
  }

  let offset = new Date().getTimezoneOffset() * 60000; //ms단위라 60000곱해줌
  let dateOffset = new Date(new Date().getTime() - offset);
  
  const yyyymmdd = dateOffset.toISOString().slice(0, 10).replace(/-/g, '');
  const hhmmss = dateOffset.toISOString().slice(11, 16).replace(/:/g, '');

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


// DB접속 체크 결과 기록 API 
router.post('/db', async (req, res) => {

  const {
    check_unit_id, 
    server_ip,
    port,
    db_name,
    db_userid,
    result_code,
    error_code,
    error_msg,
    collapsed_time,
    // 권한 정보 추가
    perm_select,
    perm_insert,
    perm_update,
    perm_delete
  } = req.body;
  
  if (!server_ip || !port || !db_name || !db_userid) {
    console.log('------------------- 필수 파라미터(server_ip|port|db_name|db_userid) 값 누락 ----------------------');
    console.log(req.body);
    return res.status(400).json({ error: '필수값 누락' });
  }

  try {
    const conn = await mypool.getConnection();
    
    const [result] = await conn.execute(
      `INSERT INTO check_server_log_dtl 
       (check_unit_id, server_ip, port, db_name, db_userid, result_code, error_code, error_msg, collapsed_time, 
        perm_select, perm_insert, perm_update, perm_delete) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [check_unit_id, server_ip, port, db_name, db_userid, result_code, error_code, error_msg, collapsed_time,
       perm_select || false, perm_insert || false, perm_update || false, perm_delete || false]
    );
    conn.release();
    res.json({ success: true });
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
    result_code,
    error_code,
    error_msg,
    collapsed_time
  } = req.body;

  if (!server_ip || !port ) {
    console.log('------------------- 필수 파라미터(server_ip|port) 값 누락 ----------------------');
    console.log(req.body);
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

  const userid = req.user?.userid;
  const { yyyymmdd, hhmmss } = req.query;

  try {
    const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
                    (req.socket ? req.socket.remoteAddress : null) ||
                    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    
    // 실제 클라이언트 IP 추출 (프록시 환경 고려)
    const realClientIp = clientIp.replace(/^::ffff:/, '')
    console.log('telnet realClientIp:', realClientIp)

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
              and (m.pc_ip = ? or m.pc_ip in (select m.user_pc_ip from members m where m.userid = ?))
              and m.check_method = 'TELNET'
              and m.yyyymmdd = ?
              order by m.yyyymmdd desc, m.hhmmss desc
          `
    const [rows] = await conn.query(query, [realClientIp, userid, yyyymmdd])

    const sqlAggr = `
              select m.yyyymmdd, GROUP_CONCAT(CONCAT(m.hhmmss) ORDER BY m.hhmmss SEPARATOR ', ') AS hhmmss_list
              from check_server_log_master m
              where (m.pc_ip = ? or m.pc_ip in (select m.user_pc_ip from members m where m.userid = ?))
              and m.check_method = 'TELNET'
              and m.yyyymmdd = ?
              group by m.yyyymmdd 
            `
    const [unitWorkList] = await conn.query(sqlAggr, [realClientIp, userid, yyyymmdd])
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
router.get('/db', authenticateJWT, async (req, res) => {

  const userid = req.user?.userid;
  const { yyyymmdd, hhmmss } = req.query;

  try {
    const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
                    (req.socket ? req.socket.remoteAddress : null) ||
                    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    
    // 실제 클라이언트 IP 추출 (프록시 환경 고려)
    const realClientIp = clientIp.replace(/^::ffff:/, '')
    
    const conn = await mypool.getConnection()
    const query = `
              select m.yyyymmdd, m.hhmmss, d.server_ip, d.port, d.result_code, d.error_code, d.error_msg,
                    d.db_name, d.db_userid, s.corp_id, s.db_instance_type, s.proc_id, s.proc_detail,
                    sv.env_type, sv.role_type, s.db_instance_type db_type,
                    d.perm_select, d.perm_insert, d.perm_update, d.perm_delete
              from check_server_log_master m, check_server_log_dtl d, database_instances s, servers sv
              where m.check_unit_id = d.check_unit_id 
              and d.db_name = s.db_instance_name 
              and d.server_ip = sv.server_ip
              and (m.pc_ip = ? or m.pc_ip in (select m.user_pc_ip from members m where m.userid = ?))
              and m.check_method = 'DB_CONN'
              and m.yyyymmdd = ?
              order by m.yyyymmdd desc, m.hhmmss desc
          `
    const [rows] = await conn.query(query, [realClientIp, userid, yyyymmdd])

    const sqlAggr = `
              select m.yyyymmdd, GROUP_CONCAT(CONCAT(m.hhmmss) ORDER BY m.hhmmss SEPARATOR ', ') AS hhmmss_list
              from check_server_log_master m
              where (m.pc_ip = ? or m.pc_ip in (select m.user_pc_ip from members m where m.userid = ?))
              and m.check_method = 'DB_CONN'
              group by m.yyyymmdd 
            `
    const [unitWorkList] = await conn.query(sqlAggr, [realClientIp, userid])
    conn.release()
    
    res.json({
      success: true,
      pc_ip: realClientIp,
      rows: rows,
      total: rows.length,
      unitWorkList: unitWorkList
    })
    
  } catch (error) {
    console.error('DB접속 이력 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: 'DB접속 이력 조회 중 오류가 발생했습니다.'
    })
  }
})

// Telnet 체크일자(yyyymmdd) 목록 반환
router.get('/dates', authenticateJWT, async (req, res) => {

  const userid = req.user?.userid;
  const { check_method } = req.query;

  try {
    const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
      (req.socket ? req.socket.remoteAddress : null) ||
      (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    const realClientIp = clientIp.replace(/^::ffff:/, '')
    console.log('realClientIp:', realClientIp)
    const conn = await mypool.getConnection();
    const [rows] = await conn.query(
      `SELECT DISTINCT yyyymmdd 
        FROM check_server_log_master m, check_server_log_dtl d
        WHERE m.check_unit_id = d.check_unit_id
        AND (m.pc_ip = ? or m.pc_ip in (select m.user_pc_ip from members m where m.userid = ?))
        AND m.check_method = ? 
        ORDER BY yyyymmdd DESC`,
      [realClientIp, userid, check_method]
    );
    conn.release();
    res.json(rows.map(r => r.yyyymmdd));
  } catch (err) {
    res.status(500).json({ message: 'DB error', error: err.message });
  }
});

// Telnet 체크시분초(hhmmss) 목록 반환 (특정 일자)
router.get('/times', authenticateJWT, async (req, res) => {

  const userid = req.user?.userid;
  const { yyyymmdd, check_method } = req.query;
  if (!yyyymmdd) return res.status(400).json({ message: 'yyyymmdd is required' });
  try {
    const clientIp = req.ip || req.remoteAddress || req.socket.remoteAddress || 
      (req.socket ? req.socket.remoteAddress : null) ||
      (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null)
    const realClientIp = clientIp.replace(/^::ffff:/, '')
    const conn = await mypool.getConnection();
    const [rows] = await conn.query(
      `SELECT DISTINCT hhmmss 
        FROM check_server_log_master m, check_server_log_dtl d
        WHERE m.check_unit_id = d.check_unit_id
        AND (m.pc_ip = ? or m.pc_ip in (select m.user_pc_ip from members m where m.userid = ?))
        AND m.check_method = ? 
        AND m.yyyymmdd = ? 
        ORDER BY hhmmss`,
      [realClientIp, userid, check_method, yyyymmdd]
    );
    conn.release();
    res.json(rows.map(r => r.hhmmss));
  } catch (err) {
    res.status(500).json({ message: 'DB error', error: err.message });
  }
});

module.exports = router; 