# ClinicFlow AI

**An AI front-desk assistant for a small outpatient clinic.** ClinicFlow answers routine administrative questions from clinic-approved information, checks appointment availability, and gives staff a simple schedule view. It is a portfolio demo with synthetic data; it is not intended for real patient information or clinical use.

## Why this project

Small clinics often handle repeated questions and appointment requests while staff are also helping patients in person. ClinicFlow explores whether a bounded AI agent can take on a few administrative steps without pretending to replace clinical judgment or an in-person receptionist.

## What it does

- React + TypeScript dashboard with today's appointment list and a conversational assistant.
- FastAPI backend with SQLite persistence for the demo schedule.
- Optional OpenAI Responses API integration with two narrowly scoped, read-only tools: clinic information and appointment availability.
- A separate booking form with explicit confirmation; the language model cannot create or edit appointments.
- Deterministic local demo mode when no API key is configured.
- Safety boundary: the assistant does not diagnose, recommend treatment, or decide clinical urgency.

## Architecture

```text
React dashboard ──HTTP──> FastAPI ──> SQLite demo schedule
                               └────> OpenAI Responses API (optional)
                                      ├─ get_clinic_info (read only)
                                      └─ check_availability (read only)
```

The model may request a tool call, but the backend validates and executes it. Booking is handled by a separate API route and form, not by an LLM tool. This separation keeps model output away from write operations.

## Run locally

### Requirements

- Node.js 20 or newer
- Python 3.11 or newer

### 1. Start the API

```powershell
cd backend
python -m venv .venv
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ..\.env.example .env
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. The interactive API reference is at `http://127.0.0.1:8000/docs`.

### 2. Start the web app

In a second terminal, from the repository root:

```powershell
pnpm install
pnpm dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

### 3. Enable live AI (optional)

Add your own `OPENAI_API_KEY` to `backend/.env`. Keep that file private; `.env` is ignored by Git. You can set `OPENAI_MODEL` there to a model available to your API account. Without a key, the app stays in clearly labeled demo mode.

## Deploy as one web app

This project includes a Dockerfile and a Render Blueprint. The image builds the React app and serves its static files from the FastAPI service, so the hosted demo has one URL. When deployed from the parent portfolio repository, its root render.yaml points Render to this project folder.

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** and select your GitHub repository. Render reads `render.yaml` and builds the Docker service.
3. Wait for the first deploy to finish, then open the generated `onrender.com` URL.
4. The hosted version uses fictional demo records and does not require an API key. Add `OPENAI_API_KEY` through the Render service's environment settings only if you want live AI; never put it in `render.yaml` or source control.

The included free Render service uses an ephemeral filesystem, so any demo bookings can reset after a restart or deploy. For persistent records, attach a paid persistent disk and set `CLINIC_DATA_DIR=/var/data` in the Render service settings. This portfolio demo is not designed to store real patient information.

See the [Render Blueprint docs](https://render.com/docs/blueprint-spec), [Docker docs](https://render.com/docs/docker), and [persistent disk docs](https://render.com/docs/disks) for current platform setup and limits.

## Try the agent

- “What time does the clinic open?”
- “What is the consultation fee?”
- “Are there any appointments available tomorrow?”
- “I need to book an appointment.” The assistant directs you to the booking form, where the action requires explicit confirmation.
- Ask a medical question: the assistant should set a boundary and direct the patient to clinic staff.

Demo clinic facts (hours, fee, doctor, and address) are fictional and live in `backend/app/config.py`.

## Project walkthrough

1. **Frontend (`src/App.tsx`)** renders the schedule, status cards, conversation, and confirmation-based booking form.
2. **API (`backend/app/main.py`)** validates requests and exposes read-only agent tools plus separate appointment endpoints.
3. **Agent (`backend/app/agent.py`)** uses the OpenAI Responses API tool loop when configured, or a deterministic local responder otherwise.
4. **Database (`backend/app/database.py`)** initializes SQLite and inserts clearly synthetic sample appointments.
5. **Safety (`backend/app/safety.py`)** keeps clinical advice outside scope and avoids collecting a visit reason in the demo booking form.

## Limitations and next steps

- No phone integration, WhatsApp integration, reminders, authentication, payments, multi-clinic tenancy, or real scheduling system integration.
- Demo data is not suitable for real patients. Before a real pilot, add authentication, role permissions, encryption and key management, retention/deletion controls, audit logging, consent and privacy notices, backups, monitoring, and a qualified review of applicable Indian privacy and healthcare rules.
- The current demo clinic has fixed operating hours and an illustrative consultation fee. Replace these with verified clinic configuration before any real use.
- Validate the business case with clinics before claiming the product removes a role or guarantees savings. Track baseline staff hours, missed calls, appointment conversion, no-shows, and ongoing service costs.

## Suggested portfolio description

> Built ClinicFlow AI, a full-stack clinic front-desk demo using React, TypeScript, FastAPI, SQLite, and optional OpenAI tool calling. Designed a bounded agent that answers from approved clinic data and checks appointment availability, while keeping bookings behind an explicit user-confirmation flow. Added a local demo mode and documented privacy, safety, and deployment limitations.

## Suggested LinkedIn post

> I built ClinicFlow AI, a portfolio project exploring how an AI assistant can help a small clinic handle routine front-desk questions and appointment availability. The project uses React, FastAPI, SQLite, and optional OpenAI tool calling. I kept the model's tools read-only and put booking behind a separate confirmation flow. It uses synthetic demo data and does not provide medical advice. I’m now looking for feedback from people who work with clinic operations: which repetitive front-desk task should a safe first version handle?

## License

MIT. See [`LICENSE`](LICENSE).
