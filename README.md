
#my-node-express-server


# members 테이블 스키마 생성
drop table members;
CREATE TABLE members (
  userid varchar(20) NOT NULL,
  name varchar(100) NOT NULL,
  email varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  status_cd varchar(1) DEFAULT 'Y',    -- 상태코드(Y-사용,N-미사용)
  isAdmin tinyint(1) DEFAULT 0,
  reg_pc_ip varchar(20) NULL,   -- 등록자 PC 아이피
  createdAt timestamp NULL DEFAULT current_timestamp(),
  updatedAt timestamp NULL DEFAULT NULL,
  PRIMARY KEY (userid),
  UNIQUE KEY uk_members_01 (email),
  INDEX ix_members_01 (name)
);


# login_his 테이블 스키마 생성
drop table login_his;
CREATE TABLE login_his (
  id int(11) NOT NULL AUTO_INCREMENT,
  userid varchar(20) NOT NULL,
  user_pc_ip varchar(20) NOT NULL,
  createdAt timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  INDEX ix_login_his_01 (userid),
  INDEX ix_login_his_02 (user_pc_ip)
);


# servers 테이블 정의
drop table servers;
CREATE TABLE servers (
  server_ip varchar(20) NOT NULL,
  hostname varchar(100) DEFAULT NULL,
  corp_id varchar(20) DEFAULT NULL,  -- 법인ID
  env_type varchar(10) NOT NULL,   -- 환경구분 (prod/qas/dev)
  role_type varchar(20) DEFAULT NULL,   -- 역할구분 (vip/active/standby/async)
  status_cd varchar(1) DEFAULT 'Y',    -- 상태코드(Y-사용,N-미사용)
  descryption varchar(2000) DEFAULT NULL,   -- 설명
  createdAt timestamp DEFAULT current_timestamp(),
  closedAt timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (server_ip),
  INDEX ix_servers_01 (corp_id, env_type, role_type)
);


# servers_port 테이블 정의
drop table servers_port;
CREATE TABLE servers_port (
  server_port_id int(11) NOT NULL AUTO_INCREMENT,
  server_ip varchar(20) NOT NULL,
  port int(4) NOT NULL,
  proc_id varchar(20) DEFAULT NULL,   -- 공정ID
  usage_type varchar(20) NOT NULL,   -- 용도분류 (DB/WEB/WAS/APP/...)
  stat_cd varchar(1) DEFAULT 'Y',    -- 상태코드(Y-사용,N-미사용)
  stat_check_target_yn varchar(1) DEFAULT 'Y',    -- 상태 체크 대상여부(Y/N)
  descryption varchar(2000) DEFAULT NULL,   -- 설명
  createdAt timestamp DEFAULT current_timestamp(),
  closedAt timestamp NULL DEFAULT current_timestamp(),
  lastCheckedAt timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (server_port_id),
  UNIQUE KEY uk_servers_port_01 (server_ip, port),
  INDEX ix_servers_port_01 (proc_id, usage_type)
);



# DB인스턴스정의 테이블
drop table database_instances;
CREATE TABLE database_instances (
  db_instance_name varchar(100) NOT NULL,
  db_instance_type varchar(10) NOT NULL, -- DB인스턴스타입(BASIC/IF/EIF)
  server_port_id int(11) NOT NULL,
  status_cd varchar(1) DEFAULT 'Y',       -- 상태코드(Y-사용,N-미사용)
  descryption varchar(2000) DEFAULT NULL,   -- 설명
  createdAt timestamp DEFAULT current_timestamp(),
  closedAt timestamp NULL DEFAULT current_timestamp(),
  lastCheckedAt timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (db_instance_name),
  INDEX ix_database_instances_01 (db_instance_type, db_instance_name, server_port_id),
  FOREIGN KEY (server_port_id) REFERENCES servers_port(server_port_id)
);



# 서버 접속 기록
drop table servers_connect_his;
CREATE TABLE servers_connect_his (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_pc_ip varchar(20) NOT NULL,
  user_email varchar(255) NOT NULL,
  server_ip varchar(20) NOT NULL,
  port int(4) NOT NULL,
  connect_method varchar(20) NOT NULL,  -- 접속 방식(telnet/db_con)
  db_name varchar(100) DEFAULT NULL,  -- DB명
  db_userid varchar(100) DEFAULT NULL,  -- DB접속 계정ID
  return_code varchar(20) DEFAULT NULL,   -- 결과코드(success/fail)
  return_desc varchar(2000) DEFAULT NULL,   -- 결과메세지
  createdAt timestamp NULL DEFAULT current_timestamp(),
  updatedAt timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX ix_servers_connect_his_01 (user_pc_ip),
  INDEX ix_servers_connect_his_02 (user_email),
  INDEX ix_servers_connect_his_03 (server_ip),
  INDEX ix_servers_connect_his_04 (db_name),
  INDEX ix_servers_connect_his_05 (db_userid)
);

