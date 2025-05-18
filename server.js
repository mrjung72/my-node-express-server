// server.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM users');
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database query failed');
  }
});

// Add a user
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const conn = await pool.getConnection();
    const result = await conn.query('INSERT INTO users(username, password, email) VALUES(?, ?, ?)', [username, password, email]);
    conn.release();
    res.json({ id: result.insertId, username, password, email });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to insert user');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
