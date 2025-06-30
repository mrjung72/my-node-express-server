// 공통코드 캐시 모듈
const mypool = require('../db')
const cache = { codes: [] }

async function loadAllCodes() {
  const conn = await mypool.getConnection()
  const [rows] = await conn.query('SELECT group_code, code, label, use_yn, category FROM common_codes')
  conn.release()
  cache.codes = rows
}

async function getCodesByGroup(group) {
  if (!cache.codes.length) await loadAllCodes()
  return cache.codes.filter(c => c.group_code === group)
}

async function refreshCodes() {
  await loadAllCodes()
}

module.exports = { loadAllCodes, getCodesByGroup, refreshCodes } 