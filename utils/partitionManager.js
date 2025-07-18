const mysql = require('mysql2/promise');

/**
 * 데이터베이스 파티션 관리 유틸리티
 * check_server_log_dtl 테이블의 주간 파티셔닝을 관리합니다.
 */
class PartitionManager {
    constructor(config) {
        this.config = config;
        this.connection = null;
    }

    /**
     * 데이터베이스 연결
     */
    async connect() {
        try {
            this.connection = await mysql.createConnection({
                ...this.config,
                charset: 'utf8mb4',
                collation: 'utf8mb4_unicode_ci'
            });
            console.log('Connected to MariaDB database');
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    /**
     * 연결 해제
     */
    async disconnect() {
        try {
            if (this.connection) {
                await this.connection.end();
                console.log('Database connection closed');
            }
        } catch (error) {
            console.error('Error closing connection:', error);
        }
    }

    /**
     * 주간 파티션 추가
     */
    async addWeeklyPartition(year, week) {
        try {
            const partitionName = `p${year}${week.toString().padStart(2, '0')}`;
            const partitionValue = year * 100 + week;
            const nextWeekValue = partitionValue + 1;

            const sql = `
                ALTER TABLE check_server_log_dtl ADD PARTITION (
                    PARTITION ${partitionName} VALUES LESS THAN (${nextWeekValue})
                )
            `;

            await this.connection.execute(sql);
            console.log(`Partition ${partitionName} added successfully`);
            return { success: true, partitionName };
        } catch (error) {
            console.error('Error adding partition:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 오래된 파티션 삭제
     */
    async dropOldPartitions(keepWeeks = 1) {
        try {
            const sql = `CALL DropOldPartitions(${keepWeeks})`;
            await this.connection.execute(sql);
            console.log(`Old partitions dropped (keeping ${keepWeeks} weeks)`);
            return { success: true };
        } catch (error) {
            console.error('Error dropping old partitions:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 파티션 정보 조회
     */
    async getPartitionInfo() {
        try {
            const sql = `
                SELECT 
                    PARTITION_NAME,
                    PARTITION_DESCRIPTION,
                    TABLE_ROWS,
                    DATA_LENGTH,
                    INDEX_LENGTH
                FROM INFORMATION_SCHEMA.PARTITIONS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'check_server_log_dtl'
                ORDER BY PARTITION_ORDINAL_POSITION
            `;

            const [rows] = await this.connection.execute(sql);
            return { success: true, partitions: rows };
        } catch (error) {
            console.error('Error getting partition info:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 자동 파티션 관리 (다음 주 파티션 추가)
     */
    async autoManagePartitions() {
        try {
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            const year = nextWeek.getFullYear();
            const week = this.getWeekNumber(nextWeek);
            return await this.addWeeklyPartition(year, week);
        } catch (error) {
            console.error('Error in auto partition management:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ISO 주 번호 계산
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * 파티션 상태 체크 및 복구
     */
    async checkAndRepairPartitions() {
        try {
            console.log('Checking partition status...');
            
            // 파티션 정보 조회
            const partitionInfo = await this.getPartitionInfo();

            if (!partitionInfo.success) {
                throw new Error('Failed to get partition info');
            }

            console.log(`Found ${partitionInfo.partitions.length} partitions`);

            // 오래된 파티션 정리
            const cleanupResult = await this.dropOldPartitions(1);

            if (!cleanupResult.success) {
                console.warn('Failed to cleanup old partitions:', cleanupResult.error);
            }

            // 다음 주 파티션 추가
            const addResult = await this.autoManagePartitions();
            if (!addResult.success) {
                console.warn('Failed to add next week partition:', addResult.error);
            }

            return {
                success: true,
                partitions: partitionInfo.partitions,
                cleanup: cleanupResult,
                added: addResult
            };
        } catch (error) {
            console.error('Error in partition check and repair:', error);
            return { success: false, error: error.message };
        }
    }
}

/**
 * 파티션 관리 스케줄러
 */
class PartitionScheduler {
    constructor(partitionManager) {
        this.partitionManager = partitionManager;
        this.scheduler = null;
    }

    /**
     * 주간 스케줄러 시작
     */
    startWeeklyScheduler() {
        // 매주 월요일 새벽 2시에 실행
        const schedule = require('node-cron');
        
        this.scheduler = schedule.schedule('0 2 * * 1', async () => {
            console.log('Running weekly partition management...');
            try {
                await this.partitionManager.connect();
                await this.partitionManager.autoManagePartitions();
            } catch (error) {
                console.error('Weekly partition management failed:', error);
            } finally {
                await this.partitionManager.disconnect();
            }
        });

        console.log('Weekly partition scheduler started');
    }

    /**
     * 일일 스케줄러 시작 (오래된 파티션 정리)
     */
    startDailyScheduler() {
        // 매일 새벽 3시에 실행
        const schedule = require('node-cron');
        
        this.scheduler = schedule.schedule('0 3 * * *', async () => {
            console.log('Running daily partition cleanup...');
            try {
                await this.partitionManager.connect();
                
                await this.partitionManager.dropOldPartitions(1);
            } catch (error) {
                console.error('Daily partition cleanup failed:', error);
            } finally {
                await this.partitionManager.disconnect();
            }
        });

        console.log('Daily partition scheduler started');
    }

    /**
     * 스케줄러 중지
     */
    stopScheduler() {
        if (this.scheduler) {
            this.scheduler.stop();
            console.log('Partition scheduler stopped');
        }
    }
}

module.exports = { PartitionManager, PartitionScheduler };

// 사용 예시
/*
const { PartitionManager, PartitionScheduler } = require('./utils/partitionManager');

// MariaDB 설정
const mariadbConfig = {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'database_name'
};

async function main() {
    const partitionManager = new PartitionManager(mariadbConfig);
    
    try {
        await partitionManager.connect();
        
        // 파티션 상태 체크 및 복구
        const result = await partitionManager.checkAndRepairPartitions();
        console.log('Partition management result:', result);
        
        // 스케줄러 시작
        const scheduler = new PartitionScheduler(partitionManager);
        scheduler.startWeeklyScheduler();
        scheduler.startDailyScheduler();
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await partitionManager.disconnect();
    }
}

// main();
*/ 