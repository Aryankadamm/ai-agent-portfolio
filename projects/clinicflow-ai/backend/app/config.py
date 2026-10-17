import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

DATA_DIR = Path(os.getenv("CLINIC_DATA_DIR", str(ROOT)))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = DATA_DIR / "clinicflow.db"
CLINIC_NAME = os.getenv("CLINIC_NAME", "Northstar Family Clinic")
CLINIC_TIMEZONE = os.getenv("CLINIC_TIMEZONE", "Asia/Kolkata")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-6-astra").strip()

CLINIC_INFO = {
    "name": CLINIC_NAME,
    "doctor": "Dr. Ananya Rao",
    "specialty": "Family medicine",
    "address": "18 Lake View Road, Bengaluru",
    "phone": "+91 80 4000 2040",
    "hours": "Monday to Saturday, 9:00 AM to 5:00 PM. Closed Sunday.",
    "consultation_fee": "₹800 (illustrative demo price)",
    "timezone": CLINIC_TIMEZONE,
}
