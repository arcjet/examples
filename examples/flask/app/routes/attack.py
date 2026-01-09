from arcjet import Mode, shield
from flask import Blueprint, jsonify, request, current_app

from app.arcjet import arcjet_with_rule

blueprint = Blueprint("attack", __name__)

arcjet = arcjet_with_rule(
    [
        # Shield protects your app from common attacks e.g. SQL injection
        shield(mode=Mode.LIVE),
    ]
)

@blueprint.route("/attack")
def attack_route():
    """
    Uses Arcjet Shield to detect and block attacks, such as SQL injection and
    cross-site scripting. To simulate an attack, send a request with the
    special header `x-arcjet-suspicious: true`.

    After the 5th request, your IP will be blocked for 15 minutes. Suspicious
    requests must meet a threshold before they are blocked to avoid false
    positives.

    Learn more about Arcjet Shield WAF in the [Arcjet docs](https://docs.arcjet.com/shield/).
    """

    decision = arcjet.protect(request)

    current_app.logger.debug(decision)

    if decision.is_denied():
        return jsonify(message="Forbidden"), 403

    if decision.is_error():
        # Fail open to prevent an Arcjet error from blocking all requests. You
        # may want to fail closed if this route is very sensitive
        current_app.logger.error(f"Arcjet error: {decision.error}")

    return jsonify(message="Hello world!")
