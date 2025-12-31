from arcjet import Mode, detect_bot
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.arcjet import arcjet_with_rule

arcjet = arcjet_with_rule(
    [
        # Shield protects your app from common attacks e.g. SQL injection
        detect_bot(
            # configured with a list of bots to allow from
            # https://arcjet.com/bot-list
            allow=[],  # blocks all automated clients
            mode=Mode.LIVE,  # will block requests. Use "DRY_RUN" to log only
        ),
    ]
)

router = APIRouter()


@router.get("/bots", name="Bot protection")
async def bots(request: Request):
    """
    All automated clients will receive a 403 response. `curl` is considered an
    automated client by default so you can test it by clicking "Try it out"
    below and alternating between testing it in your browser running the `curl`
    command from your terminal.

    Learn more about Arcjet Bot protection in the [Arcjet docs](https://docs.arcjet.com/bot-protection/).
    """

    decision = await arcjet.protect(request)

    print(decision, flush=True)

    if decision.is_denied():
        if decision.reason.is_bot():
            return JSONResponse(
                {"message": "No bots allowed"},
                status_code=403,
            )

        # If the request was denied for any other reason, return a 403 Forbidden
        return JSONResponse(
            {"message": "Forbidden"},
            status_code=403,
        )

    if decision.is_error():
        # Fail open to prevent an Arcjet error from blocking all requests. You
        # may want to fail closed if this route is very sensitive
        print(f"Arcjet error: {decision.error}", flush=True)

    return JSONResponse({"message": "Hello world!"})
