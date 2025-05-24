#my-node-express-server


# mysql members 테이블 스키마 생성
CREATE TABLE members (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(100) DEFAULT NULL,
  email varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  isAdmin tinyint(1) DEFAULT 0,
  createdAt timestamp NULL DEFAULT current_timestamp(),
  updatedAt timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
);



# mysql servers 테이블 스키마 생성
CREATE TABLE servers (
  id int(11) NOT NULL AUTO_INCREMENT,
  ip varchar(20) NOT NULL,
  port int(4) NOT NULL,
  name varchar(100) DEFAULT NULL,
  corp_id varchar(100) DEFAULT NULL,
  category varchar(100) DEFAULT NULL,   -- 업무분류
  serer_type varchar(100) DEFAULT NULL,   -- 구분 (DB/APP)
  env_type varchar(100) DEFAULT NULL,   -- 환경 (prod/qas/dev)
  role_type varchar(100) DEFAULT NULL,   -- 역할 (vip/active/standby/async)
  createdAt timestamp NULL DEFAULT current_timestamp(),
  updatedAt timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ip_port (ip, port)
);

