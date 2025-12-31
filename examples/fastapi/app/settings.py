from typing import Literal
from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    arcjet_env: Literal["development"] | None = None
    """
    Arcjet environment setting. Used internally by the Arcjet SDK to determine
    if the app is running in development mode. Omit this in non-development
    environments. Learn more about `ARCJET_ENV` in the
    [Arcjet docs](https://docs.arcjet.com/environment/#arcjet_env-node_env).
    """

    arcjet_key: SecretStr
    """
    Arcjet Key. Get your key from <https://app.arcjet.com>
    """


settings = Settings()
