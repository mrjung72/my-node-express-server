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
            database: process.env.DB_NAME || 'client_util_app'
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
  init                    파티션 초기화 및 설정
  add [year] [week]       특정 주 파티션 추가
  cleanup [weeks]         오래된 파티션 정리 (기본값: 1주일)
  info                    파티션 정보 조회
  check                   파티션 상태 체크 및 복구
  schedule [start|stop]   스케줄러 시작/중지

옵션:
  --config <path>         설정 파일 경로
  --help                  도움말 출력

예시:
  node scripts/manage-partitions.js init
  node scripts/manage-partitions.js add 2025 1
  node scripts/manage-partitions.js cleanup 26
  node scripts/manage-partitions.js info
  node scripts/manage-partitions.js check
`);
}

// 파티션 초기화
async function initPartitions() {
    const config = loadConfig();
    const dbConfig = config.mariadb;
    
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        console.log('MariaDB 데이터베이스에 연결 중...');
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
async function addPartition(year, week) {
    const config = loadConfig();
    const dbConfig = config.mariadb;
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log(`${year}년 ${week}주 파티션 추가 중...`);
        
        const result = await partitionManager.addWeeklyPartition(parseInt(year), parseInt(week));
        
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
async function cleanupPartitions(keepWeeks) {
    const config = loadConfig();
    const dbConfig = config.mariadb;
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log(`${keepWeeks}주 이전 파티션 정리 중...`);
        
        const result = await partitionManager.dropOldPartitions(keepWeeks);
        
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
async function showPartitionInfo() {
    const config = loadConfig();
    const dbConfig = config.mariadb;
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log('파티션 정보 조회 중...');
        
        const result = await partitionManager.getPartitionInfo();
        
        if (result.success) {
            console.log('✅ 파티션 정보 조회 완료');
            console.log(`📊 총 ${result.partitions.length}개 파티션`);
            
            if (result.partitions.length > 0) {
                console.log('\n파티션 목록:');
                result.partitions.forEach(partition => {
                    const name = partition.PARTITION_NAME || partition.partition_name;
                    const rows = partition.TABLE_ROWS || partition.table_rows || 0;
                    const dataLength = partition.DATA_LENGTH || partition.data_length || 0;
                    console.log(`  - ${name}: ${rows}행, ${(dataLength / 1024 / 1024).toFixed(2)}MB`);
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
async function checkAndRepairPartitions() {
    const config = loadConfig();
    const dbConfig = config.mariadb;
    const partitionManager = new PartitionManager(dbConfig);
    
    try {
        await partitionManager.connect();
        
        console.log('파티션 상태 체크 및 복구 중...');
        
        const result = await partitionManager.checkAndRepairPartitions();
        
        if (result.success) {
            console.log('✅ 파티션 상태 체크 및 복구 완료');
            console.log(`📊 총 ${result.partitions.length}개 파티션`);
            
            if (result.cleanup && result.cleanup.success) {
                console.log('✅ 오래된 파티션 정리 완료');
            }
            
            if (result.added && result.added.success) {
                console.log('✅ 다음 주 파티션 추가 완료');
            }
        } else {
            console.error('❌ 파티션 상태 체크 및 복구 실패:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 파티션 상태 체크 및 복구 중 오류 발생:', error.message);
        process.exit(1);
    } finally {
        await partitionManager.disconnect();
    }
}

// 메인 함수
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        showHelp();
        return;
    }
    
    const command = args[0];
    
    try {
        switch (command) {
            case 'init':
                await initPartitions();
                break;
                
            case 'add':
                if (args.length < 3) {
                    console.error('❌ 연도와 주를 지정해주세요.');
                    console.error('예시: node scripts/manage-partitions.js add 2025 1');
                    process.exit(1);
                }
                await addPartition(args[1], args[2]);
                break;
                
            case 'cleanup':
                const keepWeeks = args[1] ? parseInt(args[1]) : 1;
                await cleanupPartitions(keepWeeks);
                break;
                
            case 'info':
                await showPartitionInfo();
                break;
                
            case 'check':
                await checkAndRepairPartitions();
                break;
                
            default:
                console.error(`❌ 알 수 없는 명령어: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ 실행 중 오류 발생:', error.message);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    main();
}

module.exports = {
    initPartitions,
    addPartition,
    cleanupPartitions,
    showPartitionInfo,
    checkAndRepairPartitions
}; 