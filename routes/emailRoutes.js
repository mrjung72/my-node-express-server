// routes/email.js
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
require('dotenv').config(); // 환경변수 로드

const emailCodes = new Map(); // 실제로는 Redis나 DB에 저장 권장

// 이메일 전송 공통 함수
const sendEmail = async (to, subject, htmlContent) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,  // ex: 'your@gmail.com'
      pass: process.env.SMTP_PASS   // 앱 비밀번호
    }
  });

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: to,
    subject: subject,
    html: htmlContent
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('이메일 전송 실패:', error);
    return { success: false, error };
  }
};

// 인증코드 전송
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  emailCodes.set(email, code); // 유효시간을 두고 관리하는 것이 안전

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">이메일 인증 코드</h2>
      <p>안녕하세요!</p>
      <p>요청하신 인증 코드는 다음과 같습니다:</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #007bff; font-size: 32px; margin: 0;">${code}</h1>
      </div>
      <p>이 코드는 10분간 유효합니다.</p>
      <p>감사합니다.</p>
    </div>
  `;

  const result = await sendEmail(email, '이메일 인증 코드', htmlContent);
  
  if (result.success) {
    res.json({ message: '인증 코드가 전송되었습니다.' });
  } else {
    res.status(500).json({ message: '이메일 전송 실패', error: result.error });
  }
});

// 회원 승인 알림 이메일 전송
router.post('/send-approval-notification', async (req, res) => {
  const { email, name, userid } = req.body;

  if (!email || !name || !userid) {
    return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">🎉 회원 승인 완료</h2>
      <p>안녕하세요, <strong>${name}</strong>님!</p>
      <p>회원가입 신청이 승인되었습니다.</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">승인 정보</h3>
        <p><strong>사용자 ID:</strong> ${userid}</p>
        <p><strong>이름:</strong> ${name}</p>
        <p><strong>이메일:</strong> ${email}</p>
        <p><strong>승인일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>
      </div>
      
      <p>이제 시스템에 로그인하여 서비스를 이용하실 수 있습니다.</p>
      <p>초기 비밀번호는 <strong>${process.env.USER_INIT_PASSWORD || '123456'}</strong>입니다.</p>
      <p>보안을 위해 로그인 후 반드시 비밀번호를 변경해주세요.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">
          문의사항이 있으시면 관리자에게 연락해주세요.
        </p>
      </div>
    </div>
  `;

  const result = await sendEmail(email, '회원 승인 완료 알림', htmlContent);
  
  if (result.success) {
    res.json({ message: '승인 알림 이메일이 전송되었습니다.' });
  } else {
    res.status(500).json({ message: '이메일 전송 실패', error: result.error });
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
