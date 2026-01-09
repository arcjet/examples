from typing import Sequence
from arcjet import arcjet_sync as arcjet_python, Arcjet, RuleSpec

from .settings import settings

def arcjet_with_rule(rules: Sequence[RuleSpec]) -> Arcjet:
    """
    Creates and configures an Arcjet instance with the given rules.
    TODO: Use Ad hoc rules when supported in Python SDK.
    """
    return arcjet_python(
        # Get your key from https://app.arcjet.com
        key=settings.ARCJET_KEY,
        rules=rules,
    )