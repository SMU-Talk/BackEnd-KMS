import sqlite3

# 1. DB 파일 생성 및 연결 (폴더 안에 campus.db 파일이 자동 생성됨)
conn = sqlite3.connect('campus.db')
cursor = conn.cursor()

# 2. 테이블 생성 쿼리 (네가 짠 스키마를 SQLite 맞춤형으로 최적화)
cursor.executescript("""
-- 부서(단과대) 테이블
CREATE TABLE IF NOT EXISTS department (
    departmentId INTEGER PRIMARY KEY AUTOINCREMENT,
    departmentName TEXT NOT NULL
);

-- 학과(전공) 테이블
CREATE TABLE IF NOT EXISTS major (
    majorId INTEGER PRIMARY KEY AUTOINCREMENT,
    departmentId INTEGER NOT NULL,
    majorName TEXT NOT NULL,
    FOREIGN KEY(departmentId) REFERENCES department(departmentId)
);

-- 유저 테이블
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,           -- 학번을 ID로 사용
    password TEXT NOT NULL,
    nickname TEXT NOT NULL,
    majorId INTEGER,
    FOREIGN KEY(majorId) REFERENCES major(majorId)
);

-- 태그 테이블
CREATE TABLE IF NOT EXISTS tag (
    tagId INTEGER PRIMARY KEY AUTOINCREMENT,
    tagName TEXT NOT NULL
);
""")

# 3. 기준 데이터 삽입 (단과대/학과/태그)
# 이미 데이터가 있을 경우 에러가 나지 않도록 IGNORE 처리
# 유저 계정은 /api/signup을 통해 생성합니다. 여기서 더미 계정을 만들지 않습니다.
cursor.executescript("""
INSERT OR IGNORE INTO department (departmentId, departmentName) VALUES
(1, '인문사회과학대학'), (2, '사범대학'), (3, '경영경제대학'), (4, '융합공과대학');

INSERT OR IGNORE INTO major (majorId, departmentId, majorName) VALUES
(1, 4, '컴퓨터과학전공'),
(2, 4, '휴먼지능정보공학전공'),
(3, 3, '경영학부');

INSERT OR IGNORE INTO tag (tagId, tagName) VALUES
(1, '일반'), (2, '학사'), (3, '진로취업'), (4, '등록/장학');
""")

# 4. 저장 및 닫기
conn.commit()
conn.close()

print("✅ 성공적으로 campus.db 파일이 생성되고 기본 데이터가 세팅되었습니다!")