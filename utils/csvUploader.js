const fs = require('fs')
const iconv = require('iconv-lite')
const csv = require('csv-parser')

async function uploadCsvFile(filePath, tableName, columns, db, isInitData, upperLowerCaseDefine = {}, splitRowByLineBreakColumns = [], columns_save_last_value = []) {
    return new Promise((resolve, reject) => {
        const rows = []
        let mapLastValueByColumn = {}
        let countColumnExistValue = 0
        let ipValueValidation = false
        let error_msg

        fs.createReadStream(filePath)
            .pipe(iconv.decodeStream('euc-kr'))
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim()
            }))
            .on('data', (data) => {
                // 먼저 원본 행 구성
                const baseRow = columns.map(col => {
                    const trimmedCol = col.trim()
                    let value = data[trimmedCol]

                    // 값이 존재하는 컬럼수를 계산한다.
                    if(value !== undefined && value.trim() !== '') {
                        countColumnExistValue += 1

                        // 서버 아이피 값 형식을 검증한다.
                        if(trimmedCol === 'server_ip') {
                            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
                            ipValueValidation = ipRegex.test(value)
                            error_msg = `${value} is not valid ip format`
                        }
                    }


                    if (upperLowerCaseDefine[trimmedCol]) {
                        if (upperLowerCaseDefine[trimmedCol] === 'UP')
                            value = typeof value === 'string' ? value.toUpperCase() : value
                        else
                            value = typeof value === 'string' ? value.toLowerCase() : value
                    }

                    // 값 저장 대상 컬럼 이면서 값이 존재하면, 현재 값을 저장하고 아니면 최근 값을 대입한다.
                    if(columns_save_last_value.indexOf(trimmedCol) >= 0) {
                        if( value === undefined || value.trim() === '')
                            value = mapLastValueByColumn[trimmedCol]
                        else
                            mapLastValueByColumn[trimmedCol] = value 
                    }

                    return typeof value === 'string' ? value.trim() : value
                })

                // 줄바꿈 처리 대상 컬럼 인덱스 찾기
                const splitIndexes = splitRowByLineBreakColumns.map(targetCol => columns.findIndex(col => col.trim() === targetCol.trim()))
                const targetLines = []

                // 줄바꿈 대상 중 하나라도 줄바꿈이 있으면 행 분리
                let needsSplit = false
                for (const idx of splitIndexes) {
                    const value = baseRow[idx]
                    if (typeof value === 'string' && value.includes('\n')) {
                        needsSplit = true
                        targetLines.push(value.split(/\r?\n/).map(v => v.trim()))
                    } else {
                        targetLines.push([value]) // 줄바꿈이 없으면 그대로 유지
                    }
                }

                if (needsSplit) {
                    // 가장 긴 줄바꿈 리스트 기준으로 행 수 결정
                    const maxLines = Math.max(...targetLines.map(arr => arr.length))

                    for (let i = 0; i < maxLines; i++) {
                        const newRow = baseRow.map((val, colIdx) => {
                            const splitColIdx = splitIndexes.indexOf(colIdx)
                            if (splitColIdx >= 0) {
                                // 줄바꿈 대상이면 해당 줄 반환 or null
                                return targetLines[splitColIdx][i] || null
                            }
                            return val
                        })
                        rows.push(newRow)
                    }
                } else {
                    // 줄바꿈 처리 필요 없으면 그대로 push
                    if (countColumnExistValue > 0 && ipValueValidation && baseRow.length > 0 && baseRow[0] != null && baseRow[0] !== '') {
                        const cleanedValues = baseRow.map(value => value === undefined ? null : value)
                        rows.push(cleanedValues)
                    } else if(countColumnExistValue === 0) {
                        console.log('공백 ....');
                    } else if(!ipValueValidation) {
                        console.log(error_msg)
                    }
                }
                countColumnExistValue = 0 

            })
            .on('end', async () => {
                if (rows.length === 0) return resolve({ success: false, message: 'No data' })

                try {
                    if (isInitData) {
                        await db.execute(`TRUNCATE TABLE ${tableName}`, null)
                    }
                    const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',')
                    const flatValues = rows.map(row =>
                        row.map(val => val === undefined ? null : val)
                    ).flat()

                    const sql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders}`
                    await db.execute(sql, flatValues)

                    resolve({ success: true, message: `${rows.length} rows inserted.`, insertedRows: rows.length })
                } catch (err) {
                    reject(err)
                }
            })
            .on('error', (err) => reject(err))
    })
}

module.exports = { uploadCsvFile }
