# ==============================================================================
# Production Dockerfile for Codebase Analyzer (Antigravity Ecosystem)
# ==============================================================================
FROM python:3.11-slim-bookworm

# Metadata
LABEL maintainer="CoreNow Antigravity Team"
LABEL description="Codebase Analyzer & 3D CodeCity Knowledge Base Server"

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8084 \
    WORKSPACE_DIR=/workspace \
    CACHE_FILE=/workspace/.codebase_cache.json \
    RESULTS_FILE=/workspace/.codebase_results.json \
    LLM_URL=http://ollama:11434/v1/chat/completions \
    LLM_MODEL=qwen2.5-coder:7b

# Set workdir
WORKDIR /app

# Install security updates & minimal build tools if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY codebase_analyzer.py .
COPY codebase_knowledge_base_app.html .
COPY index.html .
COPY static/ ./static/
COPY assets/ ./assets/
COPY db_manager.py .
COPY auth_manager.py .
COPY db_schema.sql .

# Create workspace directory
RUN mkdir -p /workspace

# Expose Web & API Port
EXPOSE 8084

# Healthcheck to verify the server is healthy
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/status || exit 1

# Start the analyzer web server
ENTRYPOINT ["python", "codebase_analyzer.py"]
CMD ["--serve"]
