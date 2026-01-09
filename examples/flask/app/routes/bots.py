from arcjet import Mode, detect_bot
from flask import Blueprint, jsonify, request, current_app

from app.arcjet import arcjet_with_rule

blueprint = Blueprint("bots", __name__)

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

@blueprint.route("/bots")
def bots_route():
    """
    All automated clients will receive a 403 response. `curl` is considered an
    automated client by default so you can test it by making an http request to
    this endpoint in your browser (which is allowed) and doing the same with
    curl (which is blocked).

    Learn more about Arcjet Bot protection in the [Arcjet docs](https://docs.arcjet.com/bot-protection/).
    """

    decision = arcjet.protect(request)

    current_app.logger.debug(decision)

    if decision.is_denied():
        if decision.reason.is_bot():
            return jsonify(message="No bots allowed"), 403
        
        # If the request was denied for any other reason, return a 403 Forbidden
        return jsonify(message="Forbidden"), 403

    if decision.is_error():
        # Fail open to prevent an Arcjet error from blocking all requests. You
        # may want to fail closed if this route is very sensitive
        current_app.logger.error(f"Arcjet error: {decision.error}")

    return jsonify(message="Hello world!")
