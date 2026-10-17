from __future__ import annotations

MEDICAL_BOUNDARY = (
    "I can help with clinic information and appointments, but I can’t assess symptoms, "
    "diagnose a condition, or recommend treatment. Please contact the clinic directly "
    "for medical questions. If this may be an emergency, contact local emergency services "
    "or go to the nearest emergency department."
)

MEDICAL_TERMS = {
    "symptom", "symptoms", "diagnose", "diagnosis", "medicine", "medication",
    "tablet", "dose", "dosage", "pain", "bleeding", "fever", "chest", "breathing",
    "pregnant", "pregnancy", "treatment", "prescription", "side effect", "emergency",
}


def asks_for_medical_help(message: str) -> bool:
    lowered = message.lower()
    return any(term in lowered for term in MEDICAL_TERMS)
