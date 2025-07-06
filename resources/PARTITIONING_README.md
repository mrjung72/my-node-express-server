# 파티셔닝 가이드

이 문서는 `check_server_log_dtl` 테이블의 주간 파티셔닝 설정 및 관리 방법을 설명합니다.

## 개요

- **MariaDB**: 완전 지원
- **파티션 타입**: RANGE 파티셔닝 (주간 단위)
- **보관 기간**: 1주일 (기본값, 설정 가능)
- **자동 관리**: 스케줄러를 통한 자동 파티션 생성 및 정리

## 파일 구조

```
resources/
├── create_tables_mariadb.sql          # MariaDB 테이블 생성 스크립트
└── PARTITIONING_README.md             # 이 파일
```

## 설치 및 설정

### 1. MariaDB 파티셔닝 설정

```sql
-- MariaDB에서 파티셔닝 스크립트 실행
source resources/create_tables_mariadb.sql
```

### 2. 환경 변수 설정

```bash
# .env 파일에 추가
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
```

### 3. 파티션 관리 유틸리티 설치

```bash
# 필요한 패키지 설치
npm install mysql2 node-cron
```

## 사용법

### CLI 도구 사용

```bash
# 파티션 초기화
node scripts/manage-partitions.js init

# 특정 주 파티션 추가
node scripts/manage-partitions.js add 2025 1

# 오래된 파티션 정리 (1주일 이전)
node scripts/manage-partitions.js cleanup 1

# 파티션 정보 조회
node scripts/manage-partitions.js info

# 파티션 상태 체크 및 복구
node scripts/manage-partitions.js check
```

### 프로그래밍 방식 사용

```javascript
const { PartitionManager, PartitionScheduler } = require('./utils/partitionManager');

// 설정
const config = {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'database_name'
};

// 파티션 관리자 생성
const partitionManager = new PartitionManager(config);

// 연결 및 사용
await partitionManager.connect();

// 파티션 상태 체크 및 복구
const result = await partitionManager.checkAndRepairPartitions();

// 스케줄러 시작
const scheduler = new PartitionScheduler(partitionManager);
scheduler.startWeeklyScheduler();
scheduler.startDailyScheduler();

// 연결 해제
await partitionManager.disconnect();
```

## 파티션 구조

### MariaDB 파티션 구조

```sql
-- 파티션 정보 조회
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

### 파티션 명명 규칙

- 형식: `p{YYYY}{WW}` (예: p202501, p202502)
- YYYY: 연도 (4자리)
- WW: 주 번호 (2자리, 01-53)

## 자동 관리

### 주간 스케줄러

- **실행 시간**: 매주 월요일 새벽 2시
- **기능**: 다음 주 파티션 자동 생성

### 일간 스케줄러

- **실행 시간**: 매일 새벽 3시
- **기능**: 오래된 파티션 자동 정리 (1주일 이전)

## 수동 관리

### 파티션 추가

```sql
-- 특정 주 파티션 수동 추가
CALL AddWeeklyPartition(2025, 1);
```

### 파티션 삭제

```sql
-- 오래된 파티션 수동 삭제 (1주일 보관)
CALL DropOldPartitions(1);
```

### 파티션 정보 조회

```sql
-- 모든 파티션 정보 조회
CALL GetPartitionInfo();
```

## 백업 및 복구

### 파티션별 백업

```bash
# MariaDB 특정 파티션 백업
mysqldump --single-transaction --routines --triggers \
  --where="YEARWEEK(check_date, 1) = 202501" \
  database_name check_server_log_dtl > backup_202501.sql
```

### 파티션 복구

```sql
-- MariaDB 파티션 복구
source backup_202501.sql;
```

## 모니터링

### 로그 확인

```sql
-- 파티션 관련 로그 확인
SHOW VARIABLES LIKE 'log_error';
SHOW VARIABLES LIKE 'slow_query_log';
```

### 성능 모니터링

```sql
-- 파티션별 행 수 및 크기 확인
SELECT 
    PARTITION_NAME,
    TABLE_ROWS,
    ROUND(DATA_LENGTH/1024/1024, 2) AS 'Size (MB)'
FROM INFORMATION_SCHEMA.PARTITIONS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'check_server_log_dtl';
```

## 문제 해결

### 일반적인 문제

1. **파티션 생성 실패**
   - 디스크 공간 확인
   - 권한 확인
   - 테이블 잠금 상태 확인

2. **파티션 삭제 실패**
   - 외래 키 제약 조건 확인
   - 트랜잭션 상태 확인

3. **스케줄러 동작 안함**
   - cron 서비스 상태 확인
   - 로그 파일 확인

### 디버깅

```bash
# 파티션 관리 스크립트 디버그 모드
DEBUG=* node scripts/manage-partitions.js check

# 상세 로그 확인
node scripts/manage-partitions.js info --verbose
```

## 성능 최적화

### 권장사항

1. **인덱스 최적화**
   - 파티션 키에 대한 인덱스 유지
   - 불필요한 인덱스 제거

2. **정기적인 정리**
   - 주간 파티션 정리 스케줄 유지
   - 오래된 데이터 백업 후 삭제

3. **모니터링**
   - 파티션 크기 및 행 수 모니터링
   - 쿼리 성능 분석

## 참고사항

**참고**: 이 가이드는 MariaDB 10.5+ 버전을 기준으로 작성되었습니다.

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 