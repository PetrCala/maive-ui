# Builder stage
FROM python:3.12-slim as builder

# Install poetry
RUN pip install poetry==2.1.1

# Set working directory
WORKDIR /app

# Copy poetry files
COPY pyproject.toml poetry.lock* ./

# Configure poetry to not use a virtual environment
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --no-dev --no-interaction --no-ansi

# Final stage
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Make port 8080 available
EXPOSE 8080

# Run the application
CMD ["python", "app.py"]
