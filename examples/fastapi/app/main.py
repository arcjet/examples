from fastapi import FastAPI
from fastapi.responses import PlainTextResponse, RedirectResponse

from .routers.attack import router as attack_router
from .routers.bots import router as bot_router
from .routers.rate_limiting import router as rate_limiting_router

app = FastAPI(
    description="Expand the routes below and try out the interactive examples!",
    # Hides the schema models section by default
    # See https://github.com/fastapi/fastapi/issues/2633#issuecomment-1037268609
    swagger_ui_parameters={"defaultModelsExpandDepth": -1},
    title="Arcjet FastAPI example",
)

app.include_router(attack_router, tags=["Arcjet examples"])
app.include_router(bot_router, tags=["Arcjet examples"])
app.include_router(rate_limiting_router, tags=["Arcjet examples"])


@app.get("/health", include_in_schema=False)
def health():
    """
    Health check endpoint
    """
    return PlainTextResponse("Ok")


@app.get("/", include_in_schema=False)
def index():
    """
    Redirect `/` to the API docs
    """
    return RedirectResponse(url="/docs")
