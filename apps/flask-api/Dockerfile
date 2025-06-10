# syntax=docker/dockerfile:1

#######################
# 1️⃣  Builder stage  #
#######################
FROM python:3.12-slim AS builder

# Install build tools and Poetry
RUN apt-get update &&
  apt-get install -y --no-install-recommends build-essential git curl &&
  rm -rf /var/lib/apt/lists/* &&
  pip install --no-cache-dir "poetry==2.1.1"

WORKDIR /opt/app

# Only copy files needed to resolve dependencies first
COPY pyproject.toml poetry.lock* ./

# Install production dependencies directly into the global interpreter
RUN poetry config virtualenvs.create false &&
  poetry install --without docs,dev --no-interaction --no-ansi

# Copy the rest of the source tree
COPY . .

#######################
# 2️⃣  Runtime stage  #
#######################
FROM python:3.12-slim

# Copy the installed dependencies
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# Copy the application code
COPY --from=builder /opt/app /var/task

WORKDIR /var/task
EXPOSE 8080

CMD ["python", "app.py"]
