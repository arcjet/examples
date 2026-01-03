from typing import Annotated


from arcjet import Mode, shield
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

from app.arcjet import arcjet_with_rule

arcjet = arcjet_with_rule(
    [
        # Shield protects your app from common attacks e.g. SQL injection
        shield(mode=Mode.LIVE),
    ]
)

router = APIRouter()


@router.get("/attack", name="Attack protection using Arcjet Shield WAF")
async def attack(
    request: Request,
    # Only included in the example app so it shows up in the OpenAPI docs. Should be omitted in your application.
    x_arcjet_suspicious: Annotated[
        str | None,
        Header(
            description="Special Arcjet header. Simulates an attack when set to `true`"
        ),
    ] = "true",
):
    """
    Uses Arcjet Shield to detect and block attacks, such as SQL injection and
    cross-site scripting. To simulate an attack, send a request with the
    special header `x-arcjet-suspicious: true`.

    After the 5th request, your IP will be blocked for 15 minutes. Suspicious
    requests must meet a threshold before they are blocked to avoid false
    positives.

    Learn more about Arcjet Shield WAF in the [Arcjet docs](https://docs.arcjet.com/shield/).
    """

    decision = await arcjet.protect(request)

    print(decision, flush=True)

    if decision.is_denied():
        return JSONResponse(
            {"message": "Forbidden"},
            status_code=403,
        )

    if decision.is_error():
        # Fail open to prevent an Arcjet error from blocking all requests. You
        # may want to fail closed if this route is very sensitive
        print(f"Arcjet error: {decision.error}", flush=True)

    return JSONResponse({"message": "Hello world!"})
