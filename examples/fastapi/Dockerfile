FROM astral/uv:python3.10-alpine

WORKDIR /app

EXPOSE 8000

COPY pyproject.toml uv.lock ./
RUN uv sync

COPY . .

CMD ["uv", "run", "fastapi", "run", "--host", "0.0.0.0", "--port", "8000"]