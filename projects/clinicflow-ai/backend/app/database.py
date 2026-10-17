import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta
from typing import Iterator

from .config import DATABASE_PATH


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def initialize_database() -> None:
    with connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                starts_at TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'confirmed',
                created_at TEXT NOT NULL
            )
            """
        )
        count = connection.execute("SELECT COUNT(*) FROM appointments").fetchone()[0]
        if count == 0:
            today = date.today()
            samples = [
                ("Demo patient A", "+91 90000 00001", datetime.combine(today, time(9, 30))),
                ("Demo patient B", "+91 90000 00002", datetime.combine(today, time(11, 0))),
                ("Demo patient C", "+91 90000 00003", datetime.combine(today, time(14, 30))),
                ("Demo patient D", "+91 90000 00004", datetime.combine(today + timedelta(days=1), time(10, 0))),
            ]
            connection.executemany(
                "INSERT INTO appointments (patient_name, phone, starts_at, status, created_at) VALUES (?, ?, ?, ?, ?)",
                [
                    (name, phone, starts_at.isoformat(timespec="minutes"), "confirmed", datetime.now().isoformat(timespec="seconds"))
                    for name, phone, starts_at in samples
                ],
            )


def list_appointments(day: date | None = None) -> list[dict]:
    with connect() as connection:
        if day:
            rows = connection.execute(
                "SELECT * FROM appointments WHERE date(starts_at) = ? ORDER BY starts_at",
                (day.isoformat(),),
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT * FROM appointments WHERE date(starts_at) >= date('now', 'localtime') ORDER BY starts_at LIMIT 50"
            ).fetchall()
    return [dict(row) for row in rows]


def get_open_slots(day: date) -> list[str]:
    if day.weekday() == 6:
        return []
    opening = datetime.combine(day, time(9, 0))
    closing = datetime.combine(day, time(17, 0))
    candidates = []
    while opening < closing:
        candidates.append(opening.isoformat(timespec="minutes"))
        opening += timedelta(minutes=30)
    with connect() as connection:
        booked = {
            row[0]
            for row in connection.execute(
                "SELECT starts_at FROM appointments WHERE date(starts_at) = ? AND status = 'confirmed'",
                (day.isoformat(),),
            ).fetchall()
        }
    now = datetime.now()
    return [slot for slot in candidates if slot not in booked and datetime.fromisoformat(slot) > now]


def create_appointment(patient_name: str, phone: str, starts_at: datetime) -> dict:
    normalized = starts_at.replace(second=0, microsecond=0).isoformat(timespec="minutes")
    if normalized not in get_open_slots(starts_at.date()):
        raise ValueError("That appointment time is no longer available. Please choose another slot.")
    with connect() as connection:
        cursor = connection.execute(
            "INSERT INTO appointments (patient_name, phone, starts_at, status, created_at) VALUES (?, ?, ?, 'confirmed', ?)",
            (patient_name.strip(), phone.strip(), normalized, datetime.now().isoformat(timespec="seconds")),
        )
        appointment_id = cursor.lastrowid
        row = connection.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,)).fetchone()
    return dict(row)
