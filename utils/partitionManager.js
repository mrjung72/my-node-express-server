const mysql = require('mysql2/promise');
const { Pool } = require('pg');

/**
 * 데이터베이스 파티션 관리 유틸리티
 * check_server_log_dtl 테이블의 주간 파티셔닝을 관리합니다.
 */
class PartitionManager {
    constructor(config) {
        this.config = config;
        this.connection = null;
        this.dbType = config.dbType || 'mariadb'; // 'mariadb' or 'postgresql'
    }

    /**
     * 데이터베이스 연결
     */
    async connect() {
        try {
            if (this.dbType === 'mariadb') {
                this.connection = await mysql.createConnection(this.config);
            } else if (this.dbType === 'postgresql') {
                this.connection = new Pool(this.config);
            }
            console.log(`Connected to ${this.dbType} database`);
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
                if (this.dbType === 'mariadb') {
                    await this.connection.end();
                } else if (this.dbType === 'postgresql') {
                    await this.connection.end();
                }
                console.log('Database connection closed');
            }
        } catch (error) {
            console.error('Error closing connection:', error);
        }
    }

    /**
     * 주간 파티션 추가 (MariaDB)
     */
    async addWeeklyPartitionMariaDB(year, week) {
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
     * 주간 파티션 추가 (PostgreSQL)
     */
    async addWeeklyPartitionPostgreSQL(targetDate) {
        try {
            const sql = `SELECT create_weekly_partition($1)`;
            const result = await this.connection.query(sql, [targetDate]);
            console.log('Partition created:', result.rows[0]);
            return { success: true, result: result.rows[0] };
        } catch (error) {
            console.error('Error adding partition:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 오래된 파티션 삭제 (MariaDB)
     */
    async dropOldPartitionsMariaDB(keepWeeks = 52) {
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
     * 오래된 파티션 삭제 (PostgreSQL)
     */
    async dropOldPartitionsPostgreSQL(keepWeeks = 52) {
        try {
            const sql = `SELECT drop_old_partitions($1)`;
            const result = await this.connection.query(sql, [keepWeeks]);
            console.log('Old partitions dropped:', result.rows[0]);
            return { success: true, result: result.rows[0] };
        } catch (error) {
            console.error('Error dropping old partitions:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 파티션 정보 조회 (MariaDB)
     */
    async getPartitionInfoMariaDB() {
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
     * 파티션 정보 조회 (PostgreSQL)
     */
    async getPartitionInfoPostgreSQL() {
        try {
            const sql = `SELECT * FROM get_partition_info()`;
            const result = await this.connection.query(sql);
            return { success: true, partitions: result.rows };
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
            
            if (this.dbType === 'mariadb') {
                const year = nextWeek.getFullYear();
                const week = this.getWeekNumber(nextWeek);
                return await this.addWeeklyPartitionMariaDB(year, week);
            } else if (this.dbType === 'postgresql') {
                return await this.addWeeklyPartitionPostgreSQL(nextWeek.toISOString().split('T')[0]);
            }
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
            const partitionInfo = this.dbType === 'mariadb' 
                ? await this.getPartitionInfoMariaDB()
                : await this.getPartitionInfoPostgreSQL();

            if (!partitionInfo.success) {
                throw new Error('Failed to get partition info');
            }

            console.log(`Found ${partitionInfo.partitions.length} partitions`);

            // 오래된 파티션 정리
            const cleanupResult = this.dbType === 'mariadb'
                ? await this.dropOldPartitionsMariaDB(52)
                : await this.dropOldPartitionsPostgreSQL(52);

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
                
                if (this.partitionManager.dbType === 'mariadb') {
                    await this.partitionManager.dropOldPartitionsMariaDB(52);
                } else {
                    await this.partitionManager.dropOldPartitionsPostgreSQL(52);
                }
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
    database: 'database_name',
    dbType: 'mariadb'
};

// PostgreSQL 설정
const postgresConfig = {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'database_name',
    port: 5432,
    dbType: 'postgresql'
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