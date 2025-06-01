// middleware/auth.js
const jwt = require('jsonwebtoken')
const SECRET_KEY = process.env.JWT_SECRET

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      const decoded = jwt.verify(token, SECRET_KEY)
      req.user = decoded 
      next()
    } catch (err) {
      return res.status(403).json({ message: 'Invalid or expired token' })
    }
  } else {
    return res.status(401).json({ message: 'Authorization header missing' })
  }
}

module.exports = authenticateJWT
