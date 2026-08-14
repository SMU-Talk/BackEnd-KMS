"""Thin DB layer: local SQLite file for dev, Turso (remote libSQL) in production.

Cloud Run wipes the local filesystem on every cold start (it scales to zero
when idle), so a local SQLite file would lose every signed-up account between
idle periods. Setting TURSO_DATABASE_URL + TURSO_AUTH_TOKEN switches storage
to a persistent Turso database instead; leaving them unset keeps the local
SQLite file behavior used for local development (see run-backend.ps1).

Call sites use fetchone()/fetchall() instead of cursor.fetchone() so the same
code works against both the stdlib sqlite3 cursor and Turso's remote client
without depending on cursor-object details that may differ between the two.
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


def _connect(local_path: Path):
    if TURSO_DATABASE_URL:
        import turso_serverless  # imported lazily so local dev doesn't need it installed

        return turso_serverless.connect(TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)
    return sqlite3.connect(local_path)


@contextmanager
def session(local_path: Path):
    """Open a connection; commit on success, rollback on error, always close."""
    connection = _connect(local_path)
    try:
        yield connection
        connection.commit()
    except Exception:
        try:
            connection.rollback()
        except Exception:
            pass
        raise
    finally:
        connection.close()


def fetchone(connection, sql: str, params=()):
    rows = list(connection.execute(sql, params))
    return rows[0] if rows else None


def fetchall(connection, sql: str, params=()):
    return list(connection.execute(sql, params))
