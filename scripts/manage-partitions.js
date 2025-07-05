#!/usr/bin/env node

const { PartitionManager } = require('../utils/partitionManager');
const path = require('path');
const fs = require('fs');

/**
 * 파티션 관리 CLI 스크립트
 * 
 * 사용법:
 * node scripts/manage-partitions.js [command] [options]
 * 
 * 명령어:
 * - init: 파티션 초기화 및 설정
 * - add: 특정 주 파티션 추가
 * - cleanup: 오래된 파티션 정리
 * - info: 파티션 정보 조회
 * - check: 파티션 상태 체크 및 복구
 * - schedule: 스케줄러 시작/중지
 */

// 설정 파일 로드
function loadConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'database.json');
    
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    // 기본 설정
    return {
        mariadb: {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'client_util_app',
            dbType: 'mariadb'
        },
        postgresql: {
            host: process.env.PG_HOST || 'localhost',
            user: process.env.PG_USER || 'postgres',
            password: process.env.PG_PASSWORD || '',
            database: process.env.PG_DB || 'client_util_app',
            port: process.env.PG_PORT || 5432,
            dbType: 'postgresql'
        }
    };
}

// 도움말 출력
function showHelp() {
    console.log(`
파티션 관리 CLI 도구

사용법:
  node scripts/manage-partitions.js [command] [options]

명령어:
  init [dbType]           파티션 초기화 및 설정 (mariadb|postgresql)
  add [year] [week]       특정 주 파티션 추가
  cleanup [weeks]         오래된 파티션 정리 (기본값: 52주)
  info                    파티션 정보 조회
  check                   파티션 상태 체크 및 복구
  schedule [start|stop]   스케줄러 시작/중지

옵션:
  --db-type <type>        데이터베이스 타입 (mariadb|postgresql)
  --config <path>         설정 파일 경로
  --help                  도움말 출력

예시:
  node scripts/manage-partitions.js init mariadb
  node scripts/manage-partitions.js add 2025 1
  node scripts/manage-partitions.js cleanup 26
  node scripts/manage-partitions.js info
  node scripts/manage-partitions.js check
`);
}

// 파티션 초기화
async function initPartitions(dbType) {
    const config = loadConfig();
    const dbConfig = config[dbType];
    
    if (!dbConfig) {
        console.error(`지원하지 않는 데이터베이스 타입: ${dbType}`);
        process.exit(1);
    }
    
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        console.log(`${dbType} 데이터베이스에 연결 중...`);
        await partitionManager.connect();
        
        console.log('파티션 초기화 중...');
        const result = await partitionManager.checkAndRepairPartitions();
        
        if (result.success) {
            console.log('✅ 파티션 초기화 완료');
            console.log(`📊 총 ${result.partitions.length}개 파티션`);
            
            if (result.partitions.length > 0) {
                console.log('\n파티션 목록:');
                result.partitions.forEach(partition => {
                    console.log(`  - ${partition.PARTITION_NAME || partition.partition_name}`);
                });
            }
        } else {
            console.error('❌ 파티션 초기화 실패:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 초기화 중 오류 발생:', error.message);
        process.exit(1);
    } finally {
        await partitionManager.disconnect();
    }
}

// 특정 주 파티션 추가
async function addPartition(dbType, year, week) {
    const config = loadConfig();
    const dbConfig = config[dbType];
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log(`${year}년 ${week}주 파티션 추가 중...`);
        
        let result;
        if (dbType === 'mariadb') {
            result = await partitionManager.addWeeklyPartitionMariaDB(parseInt(year), parseInt(week));
        } else {
            const targetDate = new Date(year, 0, 1 + (parseInt(week) - 1) * 7);
            result = await partitionManager.addWeeklyPartitionPostgreSQL(targetDate.toISOString().split('T')[0]);
        }
        
        if (result.success) {
            console.log('✅ 파티션 추가 완료');
        } else {
            console.error('❌ 파티션 추가 실패:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 파티션 추가 중 오류 발생:', error.message);
        process.exit(1);
    } finally {
        await partitionManager.disconnect();
    }
}

// 오래된 파티션 정리
async function cleanupPartitions(dbType, keepWeeks) {
    const config = loadConfig();
    const dbConfig = config[dbType];
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log(`${keepWeeks}주 이전 파티션 정리 중...`);
        
        let result;
        if (dbType === 'mariadb') {
            result = await partitionManager.dropOldPartitionsMariaDB(keepWeeks);
        } else {
            result = await partitionManager.dropOldPartitionsPostgreSQL(keepWeeks);
        }
        
        if (result.success) {
            console.log('✅ 파티션 정리 완료');
        } else {
            console.error('❌ 파티션 정리 실패:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 파티션 정리 중 오류 발생:', error.message);
        process.exit(1);
    } finally {
        await partitionManager.disconnect();
    }
}

// 파티션 정보 조회
async function showPartitionInfo(dbType) {
    const config = loadConfig();
    const dbConfig = config[dbType];
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log('파티션 정보 조회 중...');
        
        let result;
        if (dbType === 'mariadb') {
            result = await partitionManager.getPartitionInfoMariaDB();
        } else {
            result = await partitionManager.getPartitionInfoPostgreSQL();
        }
        
        if (result.success) {
            console.log('📊 파티션 정보:');
            console.log(`총 ${result.partitions.length}개 파티션\n`);
            
            if (result.partitions.length > 0) {
                console.log('파티션명\t\t\t행 수\t\t크기');
                console.log('─'.repeat(60));
                
                result.partitions.forEach(partition => {
                    const name = partition.PARTITION_NAME || partition.partition_name;
                    const rows = partition.TABLE_ROWS || partition.row_count || 'N/A';
                    const size = partition.DATA_LENGTH || 'N/A';
                    
                    console.log(`${name}\t\t${rows}\t\t${size}`);
                });
            }
        } else {
            console.error('❌ 파티션 정보 조회 실패:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 파티션 정보 조회 중 오류 발생:', error.message);
        process.exit(1);
    } finally {
        await partitionManager.disconnect();
    }
}

// 파티션 상태 체크 및 복구
async function checkAndRepairPartitions(dbType) {
    const config = loadConfig();
    const dbConfig = config[dbType];
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log('파티션 상태 체크 및 복구 중...');
        const result = await partitionManager.checkAndRepairPartitions();
        
        if (result.success) {
            console.log('✅ 파티션 상태 체크 완료');
            console.log(`📊 총 ${result.partitions.length}개 파티션`);
            
            if (result.cleanup.success) {
                console.log('🧹 오래된 파티션 정리 완료');
            }
            
            if (result.added.success) {
                console.log('➕ 새 파티션 추가 완료');
            }
        } else {
            console.error('❌ 파티션 상태 체크 실패:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 파티션 상태 체크 중 오류 발생:', error.message);
        process.exit(1);
    } finally {
        await partitionManager.disconnect();
    }
}

// 메인 함수
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command || command === '--help' || command === '-h') {
        showHelp();
        return;
    }
    
    // 데이터베이스 타입 결정
    let dbType = 'mariadb'; // 기본값
    const dbTypeIndex = args.indexOf('--db-type');
    if (dbTypeIndex !== -1 && args[dbTypeIndex + 1]) {
        dbType = args[dbTypeIndex + 1];
    }
    
    if (!['mariadb', 'postgresql'].includes(dbType)) {
        console.error('지원하는 데이터베이스 타입: mariadb, postgresql');
        process.exit(1);
    }
    
    try {
        switch (command) {
            case 'init':
                await initPartitions(dbType);
                break;
                
            case 'add':
                const year = args[1];
                const week = args[2];
                if (!year || !week) {
                    console.error('사용법: add [year] [week]');
                    process.exit(1);
                }
                await addPartition(dbType, year, week);
                break;
                
            case 'cleanup':
                const keepWeeks = parseInt(args[1]) || 52;
                await cleanupPartitions(dbType, keepWeeks);
                break;
                
            case 'info':
                await showPartitionInfo(dbType);
                break;
                
            case 'check':
                await checkAndRepairPartitions(dbType);
                break;
                
            case 'schedule':
                console.log('스케줄러 기능은 별도로 구현이 필요합니다.');
                console.log('서버 애플리케이션에서 PartitionScheduler를 사용하세요.');
                break;
                
            default:
                console.error(`알 수 없는 명령어: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 치명적 오류:', error);
        process.exit(1);
    });
}

module.exports = {
    initPartitions,
    addPartition,
    cleanupPartitions,
    showPartitionInfo,
    checkAndRepairPartitions
}; 