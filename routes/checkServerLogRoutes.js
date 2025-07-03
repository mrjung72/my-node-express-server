const express = require('express');
const router = express.Router();
const mypool = require('../db');

// sql_exec_log 기록용 API
router.post('/', async (req, res) => {

  const {
    check_unit_id, 
    check_method,
    server_ip,
    port,
    dbname,
    pc_ip,
    result_code,
    error_code,
    error_msg,
    collapsed_time,
    result_code_db,
    error_code_db,
    error_msg_db,
    collapsed_time_db
  } = req.body;

  if (!server_ip || !port || !dbname || !pc_ip) {
    return res.status(400).json({ error: '필수값 누락' });
  }

  try {
    const conn = await mypool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO check_server_log (check_unit_id, check_method, server_ip, port, dbname, pc_ip, result_code, error_code, error_msg, collapsed_time, result_code_db, error_code_db, error_msg_db, collapsed_time_db) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [check_unit_id, check_method, server_ip, port, dbname, pc_ip, result_code, error_code, error_msg, collapsed_time, result_code_db, error_code_db, error_msg_db, collapsed_time_db]
    );
    conn.release();
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 