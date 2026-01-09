FROM astral/uv:python3.10-alpine

WORKDIR /app

EXPOSE 5000

COPY pyproject.toml uv.lock ./
RUN uv sync

COPY . .

CMD ["uv", "run", "gunicorn", "app:app", "--bind", "0.0.0.0:5000"]