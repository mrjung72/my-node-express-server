const express = require('express');
const router = express.Router();
const mypool = require('../db');

// sql_exec_log 기록용 API
router.post('/', async (req, res) => {
  const {
    server_ip,
    port,
    dbname,
    pc_ip,
    result_code,
    result_msg,
    collapsed_time
  } = req.body;

  if (!server_ip || !port || !dbname || !pc_ip) {
    return res.status(400).json({ error: '필수값 누락' });
  }

  try {
    const conn = await mypool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO check_server_log (server_ip, port, dbname, pc_ip, result_code, result_msg, collapsed_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [server_ip, port, dbname, pc_ip, result_code, result_msg, collapsed_time]
    );
    conn.release();
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 