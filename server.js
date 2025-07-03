const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { loadAllCodes } = require('./utils/CommonCodeCache')
dotenv.config()

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// 📌 라우터 분리된 파일 import
const memberRoutes = require('./routes/memberRoutes')
const serverRoutes = require('./routes/serverRoutes')
const uploadRoutes = require('./routes/uploadRoutes')
const loginRoutes = require('./routes/loginRoutes')
const myInfoRoutes = require('./routes/myInfoRoutes')
const emailRoutes = require('./routes/emailRoutes')
const codeRoutes = require('./routes/codeRoutes')
const telnetRoutes = require('./routes/telnetRoutes')
const boardRoutes = require('./routes/boardRoutes')
const boardReplyRoutes = require('./routes/boardReplyRoutes')
const checkServerLogRoutes = require('./routes/checkServerLogRoutes')

// 📌 라우터 등록
app.use('/api/members', memberRoutes)
app.use('/api/servers', serverRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/login', loginRoutes)
app.use('/api/me', myInfoRoutes)
app.use('/api/email', emailRoutes)
app.use('/api/code', codeRoutes)
app.use('/api/server-check', telnetRoutes)
app.use('/uploads', express.static('uploads'))
app.use('/api/board', boardRoutes)
app.use('/api/board-replies', boardReplyRoutes)
app.use('/api/check-server-log', checkServerLogRoutes)

// 서버 시작 시 공통코드 캐시 로딩
loadAllCodes().then(() => {
  console.log('공통코드 캐시 로딩 완료')
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`)
})

