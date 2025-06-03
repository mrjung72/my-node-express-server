// Express + net 모듈 사용
const net = require('net')
const express = require('express')
const router = express.Router()

router.post('/telnet', async (req, res) => {

  const { ip, port } = req.body
  if (!ip || !port) return res.status(400).json({ error: 'IP 또는 포트가 누락되었습니다.' })

  const timeout = 3000 // 3초 타임아웃

  const socket = new net.Socket()
  let isConnected = false

  socket.setTimeout(timeout)

  socket.on('connect', () => {
    isConnected = true
    socket.destroy()
    res.json({ status: 'success' })
  })

  socket.on('timeout', () => {
    socket.destroy()
    if (!isConnected) res.json({ status: 'timeout' })
  })

  socket.on('error', () => {
    socket.destroy()
    if (!isConnected) res.json({ status: 'error' })
  })

  try {
    socket.connect(port, ip)
  } catch (e) {
    res.json({ status: 'exception', error: e.message })
  }
})

module.exports = router
