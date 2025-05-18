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


