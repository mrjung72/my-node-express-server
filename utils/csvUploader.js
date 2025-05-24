// utils/csvUploader.js
const fs = require('fs')
const iconv = require('iconv-lite')
const csv = require('csv-parser')

async function uploadCsvFile(filePath, tableName, columns, db) {
    return new Promise((resolve, reject) => {
        const rows = []

        fs.createReadStream(filePath)
            .pipe(iconv.decodeStream('euc-kr')) // <-- 인코딩 변환
            .pipe(csv())
            .on('data', (data) => {
                // 필요한 컬럼만 추출해서 정렬된 배열로 구성
                const row = columns.map(col => data[col])

                if (row.length > 0 && row[0] != undefined) {
                    rows.push(row)
                    console.log('Row:', row)
                }
            })
            .on('end', async () => {
                if (rows.length === 0) return resolve({ success: false, message: 'No data' })

                try {
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
