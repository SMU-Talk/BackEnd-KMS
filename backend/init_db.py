"""Create local reference data (departments, majors, tags). User accounts are
created through POST /api/signup, not seeded here."""

import sqlite3
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent / "campus.db"


def initialize_database() -> None:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS department (
                departmentId INTEGER PRIMARY KEY AUTOINCREMENT,
                departmentName TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS major (
                majorId INTEGER PRIMARY KEY AUTOINCREMENT,
                departmentId INTEGER NOT NULL,
                majorName TEXT NOT NULL,
                FOREIGN KEY(departmentId) REFERENCES department(departmentId)
            );
            CREATE TABLE IF NOT EXISTS user (
                id TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                nickname TEXT NOT NULL,
                majorId INTEGER,
                FOREIGN KEY(majorId) REFERENCES major(majorId)
            );
            CREATE TABLE IF NOT EXISTS tag (
                tagId INTEGER PRIMARY KEY AUTOINCREMENT,
                tagName TEXT NOT NULL
            );
            """
        )

        connection.executemany(
            "INSERT OR IGNORE INTO department (departmentId, departmentName) VALUES (?, ?)",
            [(1, "인문사회과학대학"), (2, "사범대학"), (3, "경영경제대학"), (4, "융합공과대학")],
        )
        connection.executemany(
            "INSERT OR IGNORE INTO major (majorId, departmentId, majorName) VALUES (?, ?, ?)",
            [(1, 4, "컴퓨터공학과"), (2, 4, "AI·빅데이터학과"), (3, 3, "경영학과")],
        )
        connection.executemany(
            "INSERT OR IGNORE INTO tag (tagId, tagName) VALUES (?, ?)",
            [(1, "일반"), (2, "행사"), (3, "진로·취업"), (4, "등록·장학")],
        )


if __name__ == "__main__":
    initialize_database()
    print("로컬 개발용 campus.db를 초기화했습니다.")
