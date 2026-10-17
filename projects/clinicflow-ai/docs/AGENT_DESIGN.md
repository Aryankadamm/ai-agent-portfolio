# Agent design

## What makes this an agent

The language model receives a user question and a small set of approved functions. It can decide to call a function, receive the result from application code, then produce a response grounded in that result. This is tool calling, not unrestricted computer control.

## Tool permissions

| Tool | Permission | Data returned |
|---|---|---|
| `get_clinic_info` | Read only | One approved clinic fact selected from a fixed allowlist |
| `check_availability` | Read only | Open 30-minute time slots for a requested date |

The model has no tool to write, cancel, or modify a booking. The booking endpoint is separate and requires form validation plus an explicit demo-data confirmation checkbox.

## Request lifecycle

1. The browser sends recent chat messages to `POST /api/chat`.
2. The server checks a narrow safety boundary for medical-help requests.
3. Without a key, a deterministic local demo responder returns a clearly labeled response.
4. With a key, the server sends the conversation and tool schemas to the OpenAI Responses API.
5. If the model requests a function call, the server validates its arguments and runs only the named allowlisted function.
6. The server returns tool results to the model and asks it to complete the answer.
7. The browser displays the answer and indicates demo/live mode.

## Safety and privacy controls in this prototype

- No clinical advice or triage.
- Clinic facts come from server configuration rather than model memory.
- Tool names and JSON schemas are explicitly allowlisted.
- Model tools are read only; booking is a separately confirmed route.
- Sample schedule entries are synthetic and marked as demo records.
- Model requests set `store=False`; API keys stay in a local ignored `.env` file.
- The interface warns users not to enter real patient details.

These controls are appropriate for a portfolio prototype, not sufficient for real deployment. A production pilot needs authentication, authorization, privacy notices and consent, access logs, retention/deletion, encryption, backups, incident handling, monitoring, threat review, and qualified legal/security review. Prompt instructions alone are not a security boundary.

## Known limitations

- Keyword-based medical safety detection can miss context or over-trigger; it is a demo guard, not a clinical safety system.
- The local demo agent is deterministic and does not demonstrate language-model reasoning.
- The sample clinic facts and availability rules are fictional.
- No concurrent booking transaction strategy or multi-user access control is implemented for production scale.
