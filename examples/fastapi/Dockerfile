FROM astral/uv:python3.10-alpine

WORKDIR /app

EXPOSE 8000

COPY pyproject.toml uv.lock ./
RUN uv sync

# Temporary fix for Arcjet proto files
COPY fix-arcjet/proto ./.venv/lib/python3.10/site-packages/proto/

COPY . .

CMD ["uv", "run", "fastapi", "run", "--host", "0.0.0.0", "--port", "8000"]