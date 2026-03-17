CREATE DATABASE practice;

DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  email NVARCHAR(255) UNIQUE NOT NULL,
  password_hash NVARCHAR(255) NOT NULL,
  role NVARCHAR(20) DEFAULT 'student',
  created_at DATETIME DEFAULT GETDATE()
);

CREATE TABLE questions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  topic NVARCHAR(100) NOT NULL,
  source NVARCHAR(255),
  marks INT,
  question_image NVARCHAR(500) NOT NULL,
  answer_image NVARCHAR(500),
  created_at DATETIME DEFAULT GETDATE()
);

CREATE TABLE results (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT REFERENCES users(id),
  question_id INT REFERENCES questions(id),
  topic NVARCHAR(100) NOT NULL,
  correct BIT NOT NULL,
  answered_at DATETIME DEFAULT GETDATE()
);

SELECT * FROM users;
SELECT * FROM questions;
SELECT * FROM results;

UPDATE users SET role = 'admin' WHERE email = 'ollielin03@email.com';