#my-node-express-server



mysql user테이블 스키마 생성

CREATE TABLE users (
  id int(11) NOT NULL AUTO_INCREMENT,
  email varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  isAdmin tinyint(1) DEFAULT 0,
  createdAt timestamp NULL DEFAULT current_timestamp(),
  updatedAt timestamp NULL DEFAULT NULL,
  username varchar(100) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY username (username)
);



mysql servers테이블 스키마 생성

CREATE TABLE servers (
  id int(11) NOT NULL AUTO_INCREMENT,
  ip varchar(20) NOT NULL,
  port int(4) NOT NULL,
  name varchar(100) DEFAULT NULL,
  corp_id varchar(100) DEFAULT NULL,
  category varchar(100) DEFAULT NULL,
  env_type varchar(100) DEFAULT NULL,
  createdAt timestamp NULL DEFAULT current_timestamp(),
  updatedAt timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ip_port (ip, port)
);


