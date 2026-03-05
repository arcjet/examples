from dataclasses import asdict

from arcjet import Mode, experimental_detect_prompt_injection
from flask import Blueprint, jsonify, request, current_app

from app.arcjet import arcjet_with_rule

blueprint = Blueprint("detect_prompt_injection", __name__)

arcjet = arcjet_with_rule(
    [
        experimental_detect_prompt_injection(mode=Mode.LIVE, threshold=0.5),
    ]
)


@blueprint.route("/detect-prompt-injection", methods=["POST"])
def detect_prompt_injection_route():
    """
    Uses Arcjet to detect prompt injection attacks in user messages.

    Send a JSON body with a `message` field. If the message is detected as a
    prompt injection, the request will be denied with a 400 response.

    **Note:** This feature is experimental and subject to change. It may only
    be available to certain accounts. Contact Arcjet support if you're
    interested in using or providing feedback on this feature.

    Learn more about Arcjet prompt injection detection in the [Arcjet docs](https://docs.arcjet.com).
    """

    body = request.get_json()
    if not body or "message" not in body:
        return jsonify(error="Missing 'message' field"), 400

    decision = arcjet.protect(
        request,
        detect_prompt_injection_message=body["message"],
    )

    current_app.logger.debug(decision)

    if decision.is_denied():
        return jsonify(
            error="Prompt injection detected",
            reason=asdict(decision.reason_v2),
        ), 400

    if decision.is_error():
        # Fail open to prevent an Arcjet error from blocking all requests. You
        # may want to fail closed if this route is very sensitive
        current_app.logger.error(f"Arcjet error: {decision.reason_v2}")

    return jsonify(message="OK", decision=decision.to_dict())
