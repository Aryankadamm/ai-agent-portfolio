from datetime import date, datetime
import sqlite3
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .agent import reply
from .config import CLINIC_INFO, OPENAI_API_KEY
from .database import create_appointment, get_open_slots, initialize_database, list_appointments

app = FastAPI(title="ClinicFlow AI API", version="0.1.0", description="Portfolio demo for a bounded clinic admin assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=12)


class AppointmentRequest(BaseModel):
    patient_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=8, max_length=18, pattern=r"^[0-9+()\-\s]+$")
    starts_at: datetime
    demo_consent: bool


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "mode": "openai" if OPENAI_API_KEY else "demo"}


@app.get("/api/overview")
def overview() -> dict:
    today = date.today()
    appointments = list_appointments(today)
    return {
        "clinic": CLINIC_INFO,
        "date": today.isoformat(),
        "appointment_count": len(appointments),
        "next_appointment": appointments[0] if appointments else None,
        "mode": "openai" if OPENAI_API_KEY else "demo",
    }


@app.get("/api/appointments")
def appointments(day: date | None = None) -> list[dict]:
    return list_appointments(day)


@app.get("/api/availability")
def availability(day: date) -> dict:
    slots = get_open_slots(day)
    if day == date.today():
        slots = [slot for slot in slots if datetime.fromisoformat(slot) > datetime.now()]
    return {"date": day.isoformat(), "open_slots": slots}


@app.post("/api/appointments", status_code=201)
def book_appointment(payload: AppointmentRequest) -> dict:
    if not payload.demo_consent:
        raise HTTPException(status_code=400, detail="Please confirm the demo booking notice.")
    if payload.starts_at <= datetime.now():
        raise HTTPException(status_code=400, detail="Choose a future appointment time.")
    if payload.starts_at.tzinfo is not None:
        raise HTTPException(status_code=400, detail="Use the clinic's local appointment time shown in the schedule.")
    if payload.starts_at.minute not in (0, 30) or payload.starts_at.second or payload.starts_at.microsecond:
        raise HTTPException(status_code=400, detail="Choose a listed 30-minute appointment slot.")
    try:
        return create_appointment(payload.patient_name, payload.phone, payload.starts_at)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="That time was just booked. Please choose another slot.") from exc


@app.post("/api/chat")
def chat(payload: ChatRequest) -> dict:
    try:
        answer, mode = reply([message.model_dump() for message in payload.messages])
    except Exception as exc:
        raise HTTPException(status_code=500, detail="The assistant could not process this message.") from exc
    return {"answer": answer, "mode": mode}


frontend_dir = Path(__file__).resolve().parent / "static"
if frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
