"""Create reference data (departments, majors, tags). User accounts are
created through POST /api/signup, not seeded here.

Run locally as-is to set up campus.db. To seed a production Turso database
instead, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running this
(the same env vars backend/db.py reads)."""

from pathlib import Path

from db import session

DATABASE_PATH = Path(__file__).resolve().parent / "campus.db"

TABLE_DEFINITIONS = (
    """
    CREATE TABLE IF NOT EXISTS department (
        departmentId INTEGER PRIMARY KEY AUTOINCREMENT,
        departmentName TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS major (
        majorId INTEGER PRIMARY KEY AUTOINCREMENT,
        departmentId INTEGER NOT NULL,
        majorName TEXT NOT NULL,
        FOREIGN KEY(departmentId) REFERENCES department(departmentId)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        nickname TEXT NOT NULL,
        majorId INTEGER,
        FOREIGN KEY(majorId) REFERENCES major(majorId)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tag (
        tagId INTEGER PRIMARY KEY AUTOINCREMENT,
        tagName TEXT NOT NULL
    )
    """,
)

DEPARTMENTS = [(1, "인문사회과학대학"), (2, "사범대학"), (3, "경영경제대학"), (4, "융합공과대학")]
MAJORS = [(1, 4, "컴퓨터공학과"), (2, 4, "AI·빅데이터학과"), (3, 3, "경영학과")]
TAGS = [(1, "일반"), (2, "행사"), (3, "진로·취업"), (4, "등록·장학")]


def initialize_database() -> None:
    with session(DATABASE_PATH) as connection:
        for statement in TABLE_DEFINITIONS:
            connection.execute(statement)
        for row in DEPARTMENTS:
            connection.execute("INSERT OR IGNORE INTO department (departmentId, departmentName) VALUES (?, ?)", row)
        for row in MAJORS:
            connection.execute("INSERT OR IGNORE INTO major (majorId, departmentId, majorName) VALUES (?, ?, ?)", row)
        for row in TAGS:
            connection.execute("INSERT OR IGNORE INTO tag (tagId, tagName) VALUES (?, ?)", row)


if __name__ == "__main__":
    initialize_database()
    print("데이터베이스를 초기화했습니다.")
