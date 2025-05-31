// utils/csvUploader.js
const fs = require('fs')
const iconv = require('iconv-lite')
const csv = require('csv-parser')

async function uploadCsvFile(filePath, tableName, columns, db, isInitData) {
    return new Promise((resolve, reject) => {
        const rows = []

        fs.createReadStream(filePath)
            .pipe(iconv.decodeStream('euc-kr')) // <-- 인코딩 변환
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim() // 헤더 공백 제거
            }))
            .on('data', (data) => {

                
                // 필요한 컬럼만 추출해서 정렬된 배열로 구성
                const row = columns.map(col => {
                    const value = data[col.trim()] // trim()을 사용하여 공백 제거
                    return typeof value === 'string' ? value.trim() : value
                })
                
                if (row.length > 0 && row[0] != null && row[0] != '') {
                    const cleanedValues = row.map(value => value === undefined ? null : value);
                    rows.push(cleanedValues)
                }

                // console.log('Row data:', row) // 디버깅용
            })
            .on('end', async () => {
                if (rows.length === 0) return resolve({ success: false, message: 'No data' })

                try {
                    if (isInitData) {
                        // 초기 데이터 업로드 시 기존 데이터 삭제
                        await db.execute(`TRUNCATE TABLE ${tableName}`, null)
                    }
                    const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',')
                    const flatValues = rows.flat()
                    const sql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders}`
                    await db.execute(sql, flatValues)
                    resolve({ success: true, message: `${rows.length} rows inserted.` })
                } catch (err) {
                    reject(err)
                }
            })
            .on('error', (err) => reject(err))
    })
}

module.exports = { uploadCsvFile }
