// middlewares/auth.js
const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: '토큰이 유효하지 않거나 만료되었습니다.' });
    }

    req.user = user;
    next();
  });
};

// 옵션으로 인증 (없어도 통과)
authenticateJWT.optional = (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log('Optional auth header:', authHeader);
  if (!authHeader) return next(); // 인증 없이 통과

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    console.log('JWT verification result:', { err, user });
    if (!err) req.user = user;
    return next(); // 인증 실패여도 무조건 통과
  });
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  next();
};

module.exports = { authenticateJWT, requireAdmin };
