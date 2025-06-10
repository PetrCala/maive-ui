# Builder stage
FROM python:3.12-slim as build

WORKDIR /opt/build

RUN apt-get update && apt-get install -y --no-install-recommends build-essential git curl && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "poetry==2.1.1"

# Copy poetry and application files
COPY pyproject.toml poetry.lock* ./
COPY app.py ./app.py
COPY app ./app

RUN poetry config virtualenvs.create false && poetry install --without docs,dev --no-interaction --no-ansi

# Final stage
FROM python:3.12-slim

COPY --from=build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=build /opt/build/app.py /app.py
COPY --from=build /opt/build/app /app

# Make port 8080 available
EXPOSE 8080

# Run the application
CMD ["python", "app.py"]
