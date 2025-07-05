-- =====================================================
-- check_server_log_dtl 테이블 주간 파티셔닝 설정 (PostgreSQL)
-- =====================================================

-- 1. PostgreSQL 파티셔닝 확장 활성화 (필요시)
-- CREATE EXTENSION IF NOT EXISTS pg_partman;

-- 2. 기존 테이블 백업 (선택사항)
-- CREATE TABLE check_server_log_dtl_backup AS SELECT * FROM check_server_log_dtl;

-- 3. 기존 테이블 삭제
DROP TABLE IF EXISTS check_server_log_dtl CASCADE;

-- 4. 파티셔닝이 적용된 새 테이블 생성
CREATE TABLE check_server_log_dtl (
  id SERIAL,
  check_unit_id varchar(20) NOT NULL,
  server_ip varchar(20) NOT NULL,
  port varchar(4) NOT NULL,
  dbname varchar(100) DEFAULT NULL,   
  result_code varchar(10) NOT NULL,    -- [1,0]
  error_code varchar(20) DEFAULT NULL,         
  error_msg varchar(1000) DEFAULT NULL,  
  collapsed_time int DEFAULT 0, 
  createdAt timestamp DEFAULT current_timestamp
) PARTITION BY RANGE (createdAt);

-- 5. 인덱스 생성 (파티션별로 자동 생성됨)
CREATE INDEX ix_check_server_log_dtl_01 ON check_server_log_dtl (check_unit_id);
CREATE INDEX ix_check_server_log_dtl_02 ON check_server_log_dtl (server_ip);
CREATE INDEX ix_check_server_log_dtl_03 ON check_server_log_dtl (dbname);
CREATE INDEX ix_check_server_log_dtl_04 ON check_server_log_dtl (error_code);
CREATE INDEX ix_check_server_log_dtl_05 ON check_server_log_dtl (createdAt);

-- 6. 파티션 생성 함수
CREATE OR REPLACE FUNCTION create_weekly_partition(target_date DATE)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
    sql_stmt TEXT;
BEGIN
    -- 주의 시작일 (월요일)
    start_date := target_date - (EXTRACT(DOW FROM target_date) - 1)::INTEGER;
    -- 주의 종료일 (다음 주 월요일)
    end_date := start_date + INTERVAL '7 days';
    
    -- 파티션 이름 생성 (YYYYWW 형식)
    partition_name := 'check_server_log_dtl_' || 
                     EXTRACT(YEAR FROM start_date)::TEXT || 
                     LPAD(EXTRACT(WEEK FROM start_date)::TEXT, 2, '0');
    
    -- 파티션 생성 SQL
    sql_stmt := 'CREATE TABLE IF NOT EXISTS ' || partition_name || 
                ' PARTITION OF check_server_log_dtl ' ||
                'FOR VALUES FROM (''' || start_date || ''') TO (''' || end_date || ''')';
    
    EXECUTE sql_stmt;
    
    RETURN 'Partition ' || partition_name || ' created successfully';
END;
$$ LANGUAGE plpgsql;

-- 7. 파티션 삭제 함수
CREATE OR REPLACE FUNCTION drop_old_partitions(keep_weeks INTEGER DEFAULT 52)
RETURNS TEXT AS $$
DECLARE
    partition_record RECORD;
    partition_name TEXT;
    partition_start DATE;
    current_date DATE := CURRENT_DATE;
    dropped_count INTEGER := 0;
BEGIN
    -- 오래된 파티션 찾기
    FOR partition_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'check_server_log_dtl_%'
        AND schemaname = current_schema()
    LOOP
        -- 파티션 이름에서 날짜 추출
        partition_name := partition_record.tablename;
        
        -- 파티션의 시작 날짜 계산 (파티션 이름에서)
        BEGIN
            partition_start := TO_DATE(
                SUBSTRING(partition_name FROM 'check_server_log_dtl_(\d{6})'), 
                'YYYYWW'
            );
        EXCEPTION
            WHEN OTHERS THEN
                CONTINUE; -- 잘못된 형식의 파티션은 건너뛰기
        END;
        
        -- keep_weeks 주보다 오래된 파티션 삭제
        IF partition_start < (current_date - (keep_weeks * 7)) THEN
            EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
            dropped_count := dropped_count + 1;
        END IF;
    END LOOP;
    
    RETURN 'Dropped ' || dropped_count || ' old partitions';
END;
$$ LANGUAGE plpgsql;

-- 8. 초기 파티션 생성 (현재 주부터)
DO $$
DECLARE
    current_date DATE := CURRENT_DATE;
    end_date DATE := CURRENT_DATE + INTERVAL '2 weeks';
BEGIN
    WHILE current_date <= end_date LOOP
        PERFORM create_weekly_partition(current_date);
        current_date := current_date + INTERVAL '1 week';
    END LOOP;
END $$;

-- 9. 파티션 정보 조회 함수
CREATE OR REPLACE FUNCTION get_partition_info()
RETURNS TABLE (
    partition_name TEXT,
    start_date DATE,
    end_date DATE,
    row_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.tablename::TEXT as partition_name,
        pg_get_expr(c.relpartbound, c.oid)::TEXT as partition_bound,
        (SELECT COUNT(*) FROM pg_class pc WHERE pc.relname = p.tablename) as row_count
    FROM pg_tables p
    JOIN pg_class c ON c.relname = p.tablename
    WHERE p.tablename LIKE 'check_server_log_dtl_%'
    AND p.schemaname = current_schema()
    ORDER BY p.tablename;
END;
$$ LANGUAGE plpgsql;

-- 10. 자동 파티션 관리를 위한 스케줄러 설정 (pg_cron 확장 필요)
-- pg_cron 확장 설치 후 사용 가능

-- 주간 파티션 추가 (매주 월요일 새벽 2시)
-- SELECT cron.schedule('add-weekly-partition', '0 2 * * 1', 'SELECT create_weekly_partition(CURRENT_DATE + INTERVAL ''1 week'');');

-- 오래된 파티션 정리 (매일 새벽 3시, 1주일 보관)
-- SELECT cron.schedule('cleanup-old-partitions', '0 3 * * *', 'SELECT drop_old_partitions(1);');

-- 11. 사용 예시
-- 특정 주 파티션 생성: SELECT create_weekly_partition('2025-01-06');
-- 오래된 파티션 정리: SELECT drop_old_partitions(1);  -- 1주일 보관
-- 파티션 정보 확인: SELECT * FROM get_partition_info();

-- 12. 파티션 정보 확인 쿼리
SELECT 
    schemaname,
    tablename as partition_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE 'check_server_log_dtl_%'
AND schemaname = current_schema()
ORDER BY tablename; 