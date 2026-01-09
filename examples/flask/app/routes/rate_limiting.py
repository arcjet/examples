from arcjet import Mode, fixed_window
from flask import Blueprint, jsonify, request, current_app

from app.arcjet import arcjet_with_rule

blueprint = Blueprint("rate_limiting", __name__)

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

@blueprint.route("/rate-limiting")
def rate_limiting_route():
    """
    This route uses a fixed window rate limit. Test is by making an http
    request to this endpoint 3 times in quick succession. The 3rd request should
    receive a 429 Too Many Requests response.

    Learn more about Arcjet Rate limiting in the
    [Arcjet docs](https://docs.arcjet.com/rate-limiting/).
    """

    decision = arcjet.protect(request)

    current_app.logger.debug(decision)

    if decision.is_denied():
        if decision.reason.is_rate_limit():
            return jsonify(message="Too many requests"), 429
        
        # If the request was denied for any other reason, return a 403 Forbidden
        return jsonify(message="Forbidden"), 403

    if decision.is_error():
        # Fail open to prevent an Arcjet error from blocking all requests. You
        # may want to fail closed if this route is very sensitive
        current_app.logger.error(f"Arcjet error: {decision.error}")

    return jsonify(message="Hello world!")
