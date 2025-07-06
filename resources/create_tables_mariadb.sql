/*---------------------------------------------------------
 * 사이트에서 사용되는 DB테이블을 정의한다.
 *---------------------------------------------------------*/

-- # members 테이블 스키마 생성
drop table if exists  members;
CREATE TABLE members (
  userid varchar(20) NOT NULL,
  name varchar(100) NOT NULL,
  email varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  status_cd varchar(1) NOT NULL DEFAULT 'A',    -- 상태코드(Y-정상,N-탈퇴,A-승인대기)
  isAdmin tinyint(1) NOT NULL DEFAULT 0,
  user_pc_ip varchar(20) NULL,   -- 사용자 PC 아이피
  reg_pc_ip varchar(20) NULL,   -- 등록자 PC 아이피
  reg_userid varchar(20) NULL,   -- 등록자ID
  reg_method varchar(20) NULL,   -- 등록방식(CSV, ...)
  createdAt timestamp NOT NULL DEFAULT current_timestamp(),
  updatedAt timestamp NULL DEFAULT NULL,
  PRIMARY KEY (userid),
  UNIQUE KEY uk_members_01 (email),
  INDEX ix_members_01 (name),
  INDEX ix_members_02 (user_pc_ip),
  INDEX ix_members_03 (reg_pc_ip),
  INDEX ix_members_04 (reg_userid)
);


-- # login_his 테이블 스키마 생성
drop table if exists  login_his;
CREATE TABLE login_his (
  id int(11) NOT NULL AUTO_INCREMENT,
  userid varchar(20) NOT NULL,
  user_pc_ip varchar(20) NOT NULL,
  createdAt timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  INDEX ix_login_his_01 (userid),
  INDEX ix_login_his_02 (user_pc_ip)
);


-- # csv_upload_his 테이블 스키마 생성 
drop table if exists  csv_upload_his;
CREATE TABLE csv_upload_his (
  id int(11) NOT NULL AUTO_INCREMENT,
  userid varchar(20) NOT NULL,
  user_pc_ip varchar(20) NOT NULL,
  upload_type varchar(20) NOT NULL,   -- 업로드 구분(members, servers, .....)
  upload_data_cnt int(11) NOT NULL,   -- 업로드 데이터 건수
  descryption varchar(4000) DEFAULT NULL,
  createdAt timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  INDEX ix_csv_upload_his_01 (userid),
  INDEX ix_csv_upload_his_02 (user_pc_ip)
);



-- # servers_temp 테이블 정의
drop table if exists  servers_temp;
CREATE TABLE servers_temp (
  env_type varchar(10) NOT NULL,   -- 환경구분 (prod/qas/dev)
  corp_id varchar(20) DEFAULT NULL,  -- 법인ID
  group_id varchar(20) DEFAULT NULL,  -- 그룹ID
  proc_detail varchar(100) DEFAULT NULL,   -- 공정 상세
  proc_id varchar(20) DEFAULT NULL,   -- 공정ID
  usage_type varchar(20) NOT NULL,   -- 용도분류 (DB/WEB/WAS/APP/...)
  server_ip varchar(20) NOT NULL,
  hostname varchar(100) DEFAULT NULL,
  port int(4) NOT NULL,
  role_type varchar(20) DEFAULT NULL,   -- 역할구분 (vip/active/standby/async)
  category_code varchar(20) DEFAULT NULL,   -- 분류코드 (EIF/UI)
  descryption varchar(2000) DEFAULT NULL,
  db_name varchar(100) DEFAULT NULL,
  db_type varchar(10) DEFAULT NULL,    -- DB구분(IF, )
  check_yn varchar(1) DEFAULT 'Y',    -- 상태 체크 대상여부(Y/N)
  reg_pc_ip varchar(20) NULL,   -- 등록자 PC 아이피
  reg_userid varchar(20) NULL,   -- 등록자ID
  PRIMARY KEY (server_ip, port, corp_id, group_id, proc_id)
);


-- # 법인별/공정 테이블 정의
drop table if exists  corp_proc_define;
CREATE TABLE corp_proc_define (
  corp_proc_id int(11) NOT NULL AUTO_INCREMENT,
  env_type varchar(10) NOT NULL,   -- 환경구분 (prod/qas/dev)
  corp_id varchar(20) DEFAULT NULL,  -- 법인ID
  proc_type varchar(20) DEFAULT NULL,   -- 공정타입
  proc_name varchar(100) DEFAULT NULL,   -- 공정명
  db_instance_name varchar(100) NOT NULL,
  db_instance_name_etc varchar(1000) NOT NULL,
  db_instance_cnt int(4) NOT NULL,
  createdAt timestamp DEFAULT current_timestamp(),
  closedAt timestamp NULL,
  PRIMARY KEY (corp_proc_id),
  UNIQUE KEY uk_corp_proc_define_01 (env_type, corp_id, proc_type, proc_name),
  INDEX ix_corp_proc_define_01 (proc_name),
  INDEX ix_corp_proc_define_02 (corp_id, proc_name),
  INDEX ix_corp_proc_define_03 (db_instance_name)
);


-- # servers 테이블 정의
drop table if exists  servers;
CREATE TABLE servers (
  server_ip varchar(20) NOT NULL,
  hostname varchar(100) DEFAULT NULL,
  corp_id varchar(20) DEFAULT NULL,  -- 법인ID
  env_type varchar(10) NOT NULL,   -- 환경구분 (prod/qas/dev)
  role_type varchar(20) DEFAULT NULL,   -- 역할구분 (vip/active/standby/async)
  status_cd varchar(1) DEFAULT 'Y',    -- 상태코드(Y-사용,N-미사용)
  descryption varchar(2000) DEFAULT NULL,   -- 설명
  createdAt timestamp DEFAULT current_timestamp(),
  closedAt timestamp NULL,
  PRIMARY KEY (server_ip),
  INDEX ix_servers_01 (corp_id, env_type, role_type)
);

-- # servers_port 테이블 정의
drop table if exists  servers_port;
CREATE TABLE servers_port (
  server_port_id int(11) NOT NULL AUTO_INCREMENT,
  server_ip varchar(20) NOT NULL,
  port int(4) NOT NULL,
  proc_id varchar(20) DEFAULT NULL,   -- 공정ID
  proc_detail varchar(100) DEFAULT NULL,   -- 공정 상세
  usage_type varchar(20) NOT NULL,   -- 용도분류 (DB/WEB/WAS/APP/...)
  stat_cd varchar(1) DEFAULT 'Y',    -- 상태코드(Y-사용,N-미사용)
  stat_check_target_yn varchar(1) DEFAULT 'Y',    -- 상태 체크 대상여부(Y/N)
  descryption varchar(2000) DEFAULT NULL,   -- 설명
  createdAt timestamp DEFAULT current_timestamp(),
  closedAt timestamp NULL ,
  lastCheckedAt timestamp NULL ,
  PRIMARY KEY (server_port_id),
  UNIQUE KEY uk_servers_port_01 (server_ip, port),
  INDEX ix_servers_port_01 (proc_id, usage_type)
);



-- # DB인스턴스정의 테이블
drop table if exists  database_instances;
CREATE TABLE database_instances (
  db_instance_id int(11) NOT NULL AUTO_INCREMENT,
  db_instance_name varchar(100) NOT NULL,
  db_instance_type varchar(10) NOT NULL, -- DB인스턴스타입(BASIC/IF/EIF)
  server_port_id int(11) NOT NULL,
  proc_id varchar(20) DEFAULT NULL,   -- 공정ID
  proc_detail varchar(100) DEFAULT NULL,   -- 공정 상세
  status_cd varchar(1) DEFAULT 'Y',       -- 상태코드(Y-사용,N-미사용)
  corp_id varchar(20) DEFAULT NULL,  -- 법인ID (개발DB 용)
  descryption varchar(2000) DEFAULT NULL,   -- 설명
  createdAt timestamp DEFAULT current_timestamp(),
  closedAt timestamp NULL ,
  lastCheckedAt timestamp NULL ,
  PRIMARY KEY (db_instance_id),
  INDEX ix_database_instances_01 (db_instance_name, server_port_id)
);



-- # 게시판 테이블
drop table if exists boards;
CREATE TABLE boards (
  board_id int(11) NOT NULL AUTO_INCREMENT,
  title varchar(100) NOT NULL,
  content varchar(4000) NOT NULL,
  userid varchar(20) NOT NULL,
  filename varchar(400) NULL, 
  origin_filename varchar(400) NULL, 
  createdAt timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (board_id),
  INDEX ix_boards_01 (title)
);


-- # 게시판 댓글 테이블 
drop table if exists board_replies;
CREATE TABLE board_replies (
  reply_id      INT AUTO_INCREMENT PRIMARY KEY,   -- 답글 고유 ID
  board_id      INT NOT NULL,                     -- 원본 게시글 ID (boards.board_id)
  parent_id     INT DEFAULT NULL,                 -- 답글의 부모 reply_id (대댓글 지원용, 없으면 NULL)
  userid        VARCHAR(20) NOT NULL,             -- 작성자 ID
  content       VARCHAR(2000) NOT NULL,           -- 답글 내용
  createdAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt     TIMESTAMP NULL DEFAULT NULL,
  INDEX ix_board_replies_01 (board_id),
  INDEX ix_board_replies_02 (parent_id)
);


-- # 원격 DB서버 접속 로그 테이블
drop table if exists  check_server_log_master;
CREATE TABLE check_server_log_master (
  check_unit_id int(11) NOT NULL auto_increment primary key,
  yyyymmdd varchar(8) NOT NULL,   -- 체크 일자
  hhmmss varchar(6) NOT NULL,   -- 체크 시간
  pc_ip varchar(20) NOT NULL,   
  check_method varchar(20) NOT NULL,   -- TELNET, DB_CONN
  createdAt timestamp DEFAULT current_timestamp(),
  INDEX ix_check_server_log_master_01 (yyyymmdd, hhmmss),
  INDEX ix_check_server_log_master_02 (pc_ip, check_method, check_unit_id)
);

-- # 원격 DB서버 접속 로그 상세 테이블
drop table if exists  check_server_log_dtl;
CREATE TABLE check_server_log_dtl (
  check_unit_id int(11) NOT NULL,
  server_ip varchar(20) NOT NULL,
  port varchar(4) NOT NULL,
  db_name varchar(100) DEFAULT NULL,   
  db_userid varchar(50) DEFAULT NULL,   -- DB 사용자 ID
  result_code varchar(10) NOT NULL,    -- [1,0]
  error_code varchar(20) DEFAULT NULL,         
  error_msg varchar(1000) DEFAULT NULL,  
  collapsed_time int(4) DEFAULT 0, 
  createdAt timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (check_unit_id, createdAt),
  UNIQUE KEY uk_check_server_log_dtl_01 (check_unit_id, server_ip, port),
  INDEX ix_check_server_log_dtl_01 (db_name, check_unit_id),
  INDEX ix_check_server_log_dtl_02 (server_ip),
  INDEX ix_check_server_log_dtl_03 (error_code),
  INDEX ix_check_server_log_dtl_04 (createdAt),
  INDEX ix_check_server_log_dtl_05 (db_userid)
);


-- # 공통코드 테이블
drop table if exists  common_codes;
CREATE TABLE common_codes (
  group_code varchar(50) NOT NULL,
  code varchar(50) NOT NULL,
  label varchar(100) NOT NULL,
  use_yn varchar(1) NOT NULL DEFAULT 'Y',
  category varchar(50) NULL,
  attributes varchar(4000) NULL,  -- 속성값 json타입 ex. {속성ID:속성값, ...}
  PRIMARY KEY (group_code, code)
);

insert into common_codes (group_code, code, label) 
values
('CORP_IDS', 'KR','한국'), 
('CORP_IDS','US','미국'), 
('CORP_IDS','UK','영국'),
('CORP_IDS','PR','프랑스'),
('CORP_IDS','JP','일본'),
('CORP_IDS','CA','캐나다'),
('PROC_GR', 'BOXING', '포장'), 
('PROC_GR', 'DESIGN', '설계'), 
('PROC_GR', 'PRODUCTION', '생산'), 
('PROC_GR', 'MOLDING', '금형'), 
('PROC_GR', 'PAINTING', '도색'),
('SERVER_USAGE_TYPE', 'DB','DB'), 
('SERVER_USAGE_TYPE', 'AP','AP'),
('SERVER_ENV_TYPE', 'PROD','운영'), 
('SERVER_ENV_TYPE', 'QAS','실전'), 
('SERVER_ENV_TYPE', 'DEV','개발'),
('SERVER_ROLE_TYPE', 'VIP', 'VIP'),
('SERVER_ROLE_TYPE', 'ACTIVE', 'Active'),
('SERVER_ROLE_TYPE', 'STANDBY', 'Standby'),
('SERVER_ROLE_TYPE', 'ASYNC', 'Async'),
('CHECK_METHOD', 'TELNET', 'TELNET'),
('CHECK_METHOD', 'DB_CONN', 'DB접속'),
('USE_YN', 'Y','사용'), 
('USE_YN','N','미사용');

