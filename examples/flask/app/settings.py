import os

class Settings:
    ARCJET_KEY = os.environ["ARCJET_KEY"]
    """
    Arcjet Key. Get your key from <https://app.arcjet.com>
    """

settings = Settings()
