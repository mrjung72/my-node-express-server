const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
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

// 📌 라우터 등록
app.use('/api/members', memberRoutes)
app.use('/api/servers', serverRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/login', loginRoutes)

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

