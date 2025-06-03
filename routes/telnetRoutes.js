// Express + net 모듈 사용
const net = require('net')
const express = require('express')
const router = express.Router()


router.post('/telnet-bulk', async (req, res) => {
  const targets = req.body // [{ ip, port }]
  if (!Array.isArray(targets)) return res.status(400).json({ error: '형식 오류' })

  const timeout = 3000

  const checkTelnet = ({ ip, port }) =>
    new Promise(resolve => {
      const socket = new net.Socket()
      let status = 'timeout'
      console.log(ip, port)

      socket.setTimeout(timeout)
      socket.connect(port, ip, () => {
        status = 'success'
        socket.destroy()
        resolve({ ip, port, status })
      })

      socket.on('error', () => {
        status = 'error'
        socket.destroy()
        resolve({ ip, port, status })
      })

      socket.on('timeout', () => {
        socket.destroy()
        resolve({ ip, port, status })
      })
    })

  const results = await Promise.all(targets.map(checkTelnet))
  res.json(results)
})


router.post('/telnet-single', async (req, res) => {

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

router.post('/async-single', async (req, res) => {
  const { ip, port } = req.body
  try {
    // 예: net.connect 또는 mssql 연결 시도
    const socket = net.connect({ host: ip, port }, () => {
      socket.end()
      res.json({ message: 'Connected' })
    })
    socket.on('error', (err) => {
      res.status(500).json({ message: 'Failed', error: err.message })
    })
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message })
  }
})

module.exports = router
