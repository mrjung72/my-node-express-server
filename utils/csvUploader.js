// utils/csvUploader.js
const fs = require('fs')
const csv = require('csv-parser')

async function uploadCsvFile(filePath, tableName, columns, db) {
    return new Promise((resolve, reject) => {
        const rows = []

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                // 필요한 컬럼만 추출해서 정렬된 배열로 구성
                const row = columns.map(col => data[col])
                rows.push(row)
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
