// 회원가입
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body
  try {
    const [result] = await pool.execute(
      'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
      [username, email, password]
    )
    res.status(201).json({ message: '회원가입 성공' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '회원가입 실패' })
  }
})
