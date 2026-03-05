from dataclasses import asdict

from arcjet import Mode, experimental_detect_prompt_injection
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.arcjet import arcjet_with_rule

arcjet = arcjet_with_rule(
    [
        experimental_detect_prompt_injection(mode=Mode.LIVE, threshold=0.5),
    ]
)

router = APIRouter()


class PromptRequest(BaseModel):
    message: str


@router.post(
    "/detect-prompt-injection", name="Prompt injection detection using Arcjet"
)
async def detect_prompt_injection(request: Request, body: PromptRequest):
    """
    Uses Arcjet to detect prompt injection attacks in user messages.

    Send a JSON body with a `message` field. If the message is detected as a
    prompt injection, the request will be denied with a 400 response.

    **Note:** This feature is experimental and subject to change. It may only
    be available to certain accounts. Contact Arcjet support if you're
    interested in using or providing feedback on this feature.

    Learn more about Arcjet prompt injection detection in the [Arcjet docs](https://docs.arcjet.com).
    """

    decision = await arcjet.protect(
        request,
        detect_prompt_injection_message=body.message,
    )

    print(decision, flush=True)

    if decision.is_denied():
        return JSONResponse(
            {
                "error": "Prompt injection detected",
                "reason": asdict(decision.reason_v2),
            },
            status_code=400,
        )

    if decision.is_error():
        # Fail open to prevent an Arcjet error from blocking all requests. You
        # may want to fail closed if this route is very sensitive
        print(f"Arcjet error: {decision.reason_v2}", flush=True)

    return JSONResponse({"message": "OK", "decision": decision.to_dict()})
