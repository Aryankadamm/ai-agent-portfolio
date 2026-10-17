import json
from datetime import date, datetime, timedelta
import re

from openai import OpenAI

from .config import CLINIC_INFO, OPENAI_API_KEY, OPENAI_MODEL
from .database import get_open_slots
from .safety import MEDICAL_BOUNDARY, asks_for_medical_help

TOOLS = [
    {
        "type": "function",
        "name": "get_clinic_info",
        "description": "Look up approved administrative facts about the demo clinic.",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "enum": ["hours", "fees", "location", "doctor", "contact"]}
            },
            "required": ["topic"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "check_availability",
        "description": "Find currently open appointment slots on a date. This tool only reads the schedule.",
        "parameters": {
            "type": "object",
            "properties": {"date_iso": {"type": "string", "description": "Date in YYYY-MM-DD format"}},
            "required": ["date_iso"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]

INSTRUCTIONS = f"""
You are the administrative front-desk assistant for {CLINIC_INFO['name']}, a fictional demo clinic in India.
Only help with clinic logistics: approved clinic facts and appointment availability. Use tools for clinic facts and open slots; never invent a fact or claim a slot is open without checking.
You cannot book, cancel, or change appointments. Direct booking requests to the separate booking form and explain that the patient must confirm there.
Do not diagnose, triage, recommend treatment, medication, or interpret symptoms. For clinical questions use this boundary: {MEDICAL_BOUNDARY}
Be warm, concise, and clear. State that this is a demo and its clinic information is illustrative when relevant.
""".strip()


def _run_tool(name: str, arguments: dict) -> dict:
    if name == "get_clinic_info":
        topic = arguments.get("topic")
        fields = {
            "hours": {"hours": CLINIC_INFO["hours"]},
            "fees": {"consultation_fee": CLINIC_INFO["consultation_fee"]},
            "location": {"address": CLINIC_INFO["address"]},
            "doctor": {"doctor": CLINIC_INFO["doctor"], "specialty": CLINIC_INFO["specialty"]},
            "contact": {"phone": CLINIC_INFO["phone"]},
        }
        return fields.get(topic, {"error": "Unknown information topic"})
    if name == "check_availability":
        try:
            selected_date = date.fromisoformat(arguments["date_iso"])
        except (KeyError, ValueError):
            return {"error": "Please provide a valid date in YYYY-MM-DD format."}
        return {"date": selected_date.isoformat(), "open_slots": get_open_slots(selected_date)}
    return {"error": "Tool is not available."}


def _demo_reply(message: str) -> str:
    lowered = message.lower()
    if asks_for_medical_help(message):
        return MEDICAL_BOUNDARY
    if any(word in lowered for word in ("hour", "open", "close", "timing")):
        return f"The demo clinic is open {CLINIC_INFO['hours']}"
    if any(word in lowered for word in ("fee", "cost", "price", "charge")):
        return f"The illustrative demo consultation fee is {CLINIC_INFO['consultation_fee']}. Please confirm actual fees with the clinic."
    if any(word in lowered for word in ("where", "address", "location", "located")):
        return f"The demo clinic address is {CLINIC_INFO['address']}. This is fictional sample information."
    if any(word in lowered for word in ("available", "availability", "slot", "appointment")):
        selected_date = date.today() + timedelta(days=1) if "tomorrow" in lowered else date.today()
        match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", lowered)
        if match:
            try:
                selected_date = date.fromisoformat(match.group(1))
            except ValueError:
                pass
        slots = get_open_slots(selected_date)[:4]
        choices = ", ".join(datetime.fromisoformat(slot).strftime("%I:%M %p").lstrip("0") for slot in slots) if slots else "No open slots remain"
        day_label = selected_date.strftime("%A, %B %d").replace(" 0", " ")
        return f"The next demo openings for {day_label} are {choices}. To book, use the confirmation form on the page."
    return "I can answer questions about clinic hours, fees, location, and appointment availability. For medical questions, please contact clinic staff."


def reply(messages: list[dict[str, str]]) -> tuple[str, str]:
    latest_user = next((item["content"] for item in reversed(messages) if item["role"] == "user"), "")
    if asks_for_medical_help(latest_user):
        return MEDICAL_BOUNDARY, "safety_boundary"
    if not OPENAI_API_KEY:
        return _demo_reply(latest_user), "demo"

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        safe_history = [
            {"role": item["role"], "content": item["content"][:2000]}
            for item in messages[-12:]
            if item["role"] in {"user", "assistant"}
        ]
        input_items = safe_history
        response = client.responses.create(
            model=OPENAI_MODEL,
            instructions=INSTRUCTIONS,
            input=safe_history,
            tools=TOOLS,
            store=False,
        )
        for _ in range(4):
            calls = [item for item in response.output if getattr(item, "type", "") == "function_call"]
            if not calls:
                return response.output_text or "I couldn't prepare a response. Please try again.", "openai"
            outputs = []
            for call in calls:
                try:
                    result = _run_tool(call.name, json.loads(call.arguments))
                except (ValueError, TypeError, json.JSONDecodeError):
                    result = {"error": "The request could not be processed."}
                outputs.append({
                    "type": "function_call_output",
                    "call_id": call.call_id,
                    "output": json.dumps(result, ensure_ascii=False),
                })
            input_items = [*input_items, *response.output, *outputs]
            response = client.responses.create(
                model=OPENAI_MODEL,
                instructions=INSTRUCTIONS,
                input=input_items,
                tools=TOOLS,
                store=False,
            )
        return "I couldn't finish that request. Please try asking in a different way.", "openai"
    except Exception:
        return "The live AI service is temporarily unavailable. Please try again, or use the clinic details shown on this demo page.", "unavailable"
