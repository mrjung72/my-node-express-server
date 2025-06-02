// routes/email.js
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
require('dotenv').config(); // 환경변수 로드

const emailCodes = new Map(); // 실제로는 Redis나 DB에 저장 권장

// 인증코드 전송
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  emailCodes.set(email, code); // 유효시간을 두고 관리하는 것이 안전

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,  // ex: 'your@gmail.com'
      pass: process.env.SMTP_PASS   // 앱 비밀번호
    }
  });

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: '이메일 인증 코드',
    text: `인증 코드는 ${code} 입니다.`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: '인증 코드가 전송되었습니다.' });
  } catch (error) {
    console.error('이메일 전송 실패:', error);
    res.status(500).json({ message: '이메일 전송 실패', error });
  }
});

// 인증코드 확인
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  const storedCode = emailCodes.get(email);

  if (storedCode && storedCode === code) {
    emailCodes.delete(email); // 사용 후 제거
    return res.json({ success: true });
  } else {
    return res.status(400).json({ success: false, message: '인증 코드가 일치하지 않습니다.' });
  }
});

module.exports = router;
