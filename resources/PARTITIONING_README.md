# check_server_log_dtl 테이블 주간 파티셔닝 가이드

## 개요

`check_server_log_dtl` 테이블에 주간 단위 파티셔닝을 적용하여 대용량 데이터의 효율적인 관리와 성능 향상을 구현합니다.

## 파티셔닝의 장점

1. **성능 향상**: 특정 기간의 데이터만 조회하여 쿼리 성능 개선
2. **관리 용이성**: 오래된 파티션을 쉽게 삭제하여 디스크 공간 절약
3. **백업 효율성**: 필요한 파티션만 선택적으로 백업 가능
4. **인덱스 최적화**: 파티션별 인덱스로 검색 성능 향상

## 지원 데이터베이스

- **MariaDB/MySQL**: 완전 지원
- **PostgreSQL**: 완전 지원

## 파일 구조

```
resources/
├── partition_check_server_log_dtl_mariadb.sql    # MariaDB 파티셔닝 스크립트
├── partition_check_server_log_dtl_postgresql.sql # PostgreSQL 파티셔닝 스크립트
└── PARTITIONING_README.md                        # 이 파일

utils/
└── partitionManager.js                           # Node.js 파티션 관리 유틸리티

scripts/
└── manage-partitions.js                          # CLI 파티션 관리 도구
```

## 설치 및 설정

### 1. MariaDB 파티셔닝 설정

```sql
-- MariaDB에서 파티셔닝 스크립트 실행
source resources/partition_check_server_log_dtl_mariadb.sql;
```

### 2. PostgreSQL 파티셔닝 설정

```sql
-- PostgreSQL에서 파티셔닝 스크립트 실행
\i resources/partition_check_server_log_dtl_postgresql.sql
```

### 3. Node.js 의존성 설치

```bash
npm install mysql2 pg node-cron
```

## 사용법

### CLI 도구 사용

```bash
# 파티션 초기화
node scripts/manage-partitions.js init mariadb

# 특정 주 파티션 추가
node scripts/manage-partitions.js add 2025 1

# 오래된 파티션 정리 (52주 보관)
node scripts/manage-partitions.js cleanup 52

# 파티션 정보 조회
node scripts/manage-partitions.js info

# 파티션 상태 체크 및 복구
node scripts/manage-partitions.js check
```

### 프로그래밍 방식 사용

```javascript
const { PartitionManager, PartitionScheduler } = require('./utils/partitionManager');

// MariaDB 설정
const config = {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'database_name',
    dbType: 'mariadb'
};

const partitionManager = new PartitionManager(config);

// 파티션 관리
await partitionManager.connect();
await partitionManager.checkAndRepairPartitions();
await partitionManager.disconnect();

// 스케줄러 사용
const scheduler = new PartitionScheduler(partitionManager);
scheduler.startWeeklyScheduler();
scheduler.startDailyScheduler();
```

## 파티션 구조

### MariaDB 파티션 구조

- **파티션 키**: `YEARWEEK(createdAt, 1)`
- **파티션 명명**: `pYYYYWW` (예: p202501)
- **범위**: 주 단위 (월요일 ~ 일요일)

### PostgreSQL 파티션 구조

- **파티션 키**: `createdAt` (timestamp)
- **파티션 명명**: `check_server_log_dtl_YYYYWW`
- **범위**: 주 단위 (월요일 ~ 일요일)

## 자동 관리 기능

### 1. 주간 파티션 추가

- **스케줄**: 매주 월요일 새벽 2시
- **기능**: 다음 주 파티션 자동 생성

### 2. 오래된 파티션 정리

- **스케줄**: 매일 새벽 3시
- **기능**: 52주(1년) 이전 파티션 자동 삭제

### 3. 스토어드 프로시저/함수

#### MariaDB
- `AddWeeklyPartition(year, week)`: 특정 주 파티션 추가
- `DropOldPartitions(keep_weeks)`: 오래된 파티션 정리

#### PostgreSQL
- `create_weekly_partition(target_date)`: 특정 주 파티션 추가
- `drop_old_partitions(keep_weeks)`: 오래된 파티션 정리
- `get_partition_info()`: 파티션 정보 조회

## 모니터링 및 관리

### 파티션 정보 조회

#### MariaDB
```sql
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
```

#### PostgreSQL
```sql
SELECT * FROM get_partition_info();
```

### 파티션 성능 모니터링

```sql
-- 특정 파티션의 데이터 확인
SELECT COUNT(*) FROM check_server_log_dtl 
WHERE createdAt >= '2025-01-06' AND createdAt < '2025-01-13';

-- 파티션별 데이터 분포 확인
SELECT 
    YEARWEEK(createdAt, 1) as week,
    COUNT(*) as record_count
FROM check_server_log_dtl 
GROUP BY YEARWEEK(createdAt, 1)
ORDER BY week DESC;
```

## 백업 및 복구

### 파티션별 백업

```bash
# MariaDB 특정 파티션 백업
mysqldump --single-transaction --routines --triggers \
  --where="YEARWEEK(createdAt, 1) = 202501" \
  database_name check_server_log_dtl > backup_202501.sql

# PostgreSQL 특정 파티션 백업
pg_dump --table="check_server_log_dtl_202501" \
  database_name > backup_202501.sql
```

### 파티션 복구

```sql
-- MariaDB 파티션 복구
source backup_202501.sql;

-- PostgreSQL 파티션 복구
\i backup_202501.sql
```

## 문제 해결

### 일반적인 문제들

1. **파티션 생성 실패**
   - 권한 확인: `CREATE`, `ALTER` 권한 필요
   - 디스크 공간 확인
   - 파티션 키 인덱스 확인

2. **파티션 삭제 실패**
   - 파티션에 데이터가 있는지 확인
   - 외래 키 제약 조건 확인

3. **성능 문제**
   - 파티션 키 인덱스 확인
   - 쿼리에서 파티션 키 사용 확인

### 로그 확인

```sql
-- MariaDB 에러 로그 확인
SHOW VARIABLES LIKE 'log_error';
SHOW VARIABLES LIKE 'log_error_verbosity';

-- PostgreSQL 로그 확인
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

## 성능 최적화 팁

1. **쿼리 최적화**
   - 파티션 키(`createdAt`)를 WHERE 절에 포함
   - 파티션 프루닝 활용

2. **인덱스 최적화**
   - 파티션별 인덱스 자동 생성 확인
   - 복합 인덱스 활용

3. **정기적 유지보수**
   - 주간 파티션 추가 자동화
   - 월간 오래된 파티션 정리
   - 파티션 통계 정보 업데이트

## 보안 고려사항

1. **권한 관리**
   - 파티션 관리 전용 사용자 생성
   - 최소 권한 원칙 적용

2. **백업 보안**
   - 백업 파일 암호화
   - 안전한 저장소 사용

3. **감사 로그**
   - 파티션 생성/삭제 로그 기록
   - 정기적 감사 수행

## 지원 및 문의

파티셔닝 관련 문제나 개선 사항이 있으시면 개발팀에 문의해 주세요.

---

**참고**: 이 가이드는 MariaDB 10.5+ 및 PostgreSQL 12+ 버전을 기준으로 작성되었습니다. 