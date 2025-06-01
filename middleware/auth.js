// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
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

module.exports = authenticateJWT;
