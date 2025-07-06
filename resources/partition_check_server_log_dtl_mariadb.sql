-- =====================================================
-- check_server_log_dtl 테이블 주간 파티셔닝 설정 (MariaDB)
-- =====================================================

-- 1. 기존 테이블 백업 (선택사항)
-- CREATE TABLE check_server_log_dtl_backup AS SELECT * FROM check_server_log_dtl;

-- 2. 기존 인덱스 정보 저장
-- SHOW INDEX FROM check_server_log_dtl;

-- 3. 기존 테이블 삭제
DROP TABLE IF EXISTS check_server_log_dtl;

-- 4. 파티셔닝이 적용된 새 테이블 생성
CREATE TABLE check_server_log_dtl (
  id int(11) NOT NULL auto_increment,
  check_unit_id varchar(20) NOT NULL,
  server_ip varchar(20) NOT NULL,
  port nvarchar(4) NOT NULL,
  db_name varchar(100) DEFAULT NULL,   
  result_code varchar(10) NOT NULL,    -- [1,0]
  error_code varchar(20) DEFAULT NULL,         
  error_msg varchar(1000) DEFAULT NULL,  
  collapsed_time int(4) DEFAULT 0, 
  createdAt timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (id, createdAt),
  INDEX ix_check_server_log_dtl_01 (check_unit_id),
  INDEX ix_check_server_log_dtl_02 (server_ip),
  INDEX ix_check_server_log_dtl_03 (db_name),
  INDEX ix_check_server_log_dtl_04 (error_code),
  INDEX ix_check_server_log_dtl_05 (createdAt)
  ) 
  PARTITION BY RANGE (YEARWEEK(createdAt, 1)) (
    -- 현재 주 파티션 (자동 생성됨)
    PARTITION p_current VALUES LESS THAN (YEARWEEK(NOW(), 1) + 1),
    -- 미래 파티션 (자동 생성됨)
    PARTITION p_future VALUES LESS THAN MAXVALUE
  );

-- 5. 파티션 정보 확인
SELECT 
  PARTITION_NAME,
  PARTITION_DESCRIPTION,
  TABLE_ROWS,
  DATA_LENGTH,
  INDEX_LENGTH
FROM INFORMATION_SCHEMA.PARTITIONS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'check_server_log_dtl'
ORDER BY PARTITION_ORDINAL_POSITION;

-- 6. 파티션 관리 스토어드 프로시저 생성
DELIMITER $$

CREATE PROCEDURE AddWeeklyPartition(IN target_year INT, IN target_week INT)
BEGIN
    DECLARE partition_name VARCHAR(20);
    DECLARE partition_value INT;
    DECLARE next_week_value INT;
    DECLARE sql_stmt TEXT;
    
    SET partition_name = CONCAT('p', target_year, LPAD(target_week, 2, '0'));
    SET partition_value = target_year * 100 + target_week;
    SET next_week_value = partition_value + 1;
    
    SET sql_stmt = CONCAT(
        'ALTER TABLE check_server_log_dtl ADD PARTITION (',
        'PARTITION ', partition_name, ' VALUES LESS THAN (', next_week_value, ')',
        ')'
    );
    
    SET @sql = sql_stmt;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    SELECT CONCAT('Partition ', partition_name, ' added successfully') AS result;
END$$

CREATE PROCEDURE DropOldPartitions(IN keep_weeks INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE partition_name VARCHAR(20);
    DECLARE partition_value INT;
    DECLARE current_week INT;
    DECLARE partition_cursor CURSOR FOR 
        SELECT PARTITION_NAME, PARTITION_DESCRIPTION
        FROM INFORMATION_SCHEMA.PARTITIONS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'check_server_log_dtl'
          AND PARTITION_NAME != 'p_future'
        ORDER BY PARTITION_ORDINAL_POSITION;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    SET current_week = YEARWEEK(NOW(), 1);
    
    OPEN partition_cursor;
    
    read_loop: LOOP
        FETCH partition_cursor INTO partition_name, partition_value;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        IF partition_value < (current_week - keep_weeks) THEN
            SET @sql = CONCAT('ALTER TABLE check_server_log_dtl DROP PARTITION ', partition_name);
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            
            SELECT CONCAT('Dropped partition: ', partition_name) AS result;
        END IF;
    END LOOP;
    
    CLOSE partition_cursor;
END$$

DELIMITER ;

-- 7. 자동 파티션 관리를 위한 이벤트 생성 (선택사항)
-- 이벤트 스케줄러 활성화
SET GLOBAL event_scheduler = ON;

-- 주간 파티션 추가 이벤트 (매주 월요일 새벽 2시)
CREATE EVENT IF NOT EXISTS add_weekly_partition_event
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP + INTERVAL (8 - WEEKDAY(CURRENT_TIMESTAMP)) DAY + INTERVAL 2 HOUR
DO
BEGIN
    DECLARE next_year INT;
    DECLARE next_week INT;
    
    SET next_year = YEAR(DATE_ADD(NOW(), INTERVAL 1 WEEK));
    SET next_week = WEEK(DATE_ADD(NOW(), INTERVAL 1 WEEK), 1);
    
    CALL AddWeeklyPartition(next_year, next_week);
END;

-- 오래된 파티션 정리 이벤트 (매일 새벽 3시, 1주일 보관)
CREATE EVENT IF NOT EXISTS cleanup_old_partitions_event
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 3 HOUR
DO
BEGIN
    CALL DropOldPartitions(1);
END;

-- 8. 사용 예시
-- 특정 주 파티션 추가: CALL AddWeeklyPartition(2025, 1);
-- 오래된 파티션 정리: CALL DropOldPartitions(1);  -- 1주일 보관
-- 파티션 정보 확인: SELECT * FROM INFORMATION_SCHEMA.PARTITIONS WHERE TABLE_NAME = 'check_server_log_dtl'; 