from arcjet import Mode, fixed_window
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.arcjet import arcjet_with_rule

arcjet = arcjet_with_rule(
    [
        # Create a fixed window rate limit. Sliding window and token bucket are also
        # available.
        fixed_window(
            max=2,  # max requests per window
            mode=Mode.LIVE,  # will block requests. Use "DRY_RUN" to log only
            window=60,  # window duration
        ),
    ]
)

router = APIRouter()


@router.get("/rate-limiting")
async def rate_limiting(request: Request):
    """
    This route uses a fixed window rate limit. Test is by clicking "Try it out"
    below and sending 3 requests in quick succession. The 3rd request should
    receive a 429 Too Many Requests response.

    Learn more about Arcjet Rate limiting in the
    [Arcjet docs](https://docs.arcjet.com/rate-limiting/).
    """

    decision = await arcjet.protect(request)

    print(decision, flush=True)

    if decision.is_denied():
        if decision.reason.is_rate_limit():
            return JSONResponse(
                {"message": "Too many requests"},
                status_code=429,
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
