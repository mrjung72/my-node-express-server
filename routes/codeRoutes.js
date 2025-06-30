const express = require('express')
const router = express.Router()
const { getCodesByGroup, refreshCodes } = require('../utils/CommonCodeCache')


// 그룹코드별 코드 정보 조회
router.get('/:groupCode', async (req, res) => {
    const { groupCode } = req.params
    try {
        const codes = await getCodesByGroup(groupCode)
        res.json(codes.map(({ code, label }) => ({ code, label })))
    } catch (err) {
        console.error(err)
        res.status(500).send('Code cache error')
    }
})

// 공통코드 캐시 강제 갱신
router.post('/refresh', async (req, res) => {
    try {
        await refreshCodes()
        res.json({ message: '공통코드 캐시 갱신 완료' })
    } catch (err) {
        res.status(500).json({ message: 'Code cache refresh error', error: err.message })
    }
})

module.exports = router