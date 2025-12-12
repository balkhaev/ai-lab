# AI API Dockerfile with CUDA support
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create symlinks for python
RUN ln -sf /usr/bin/python3.11 /usr/bin/python && \
    ln -sf /usr/bin/python3.11 /usr/bin/python3

# Upgrade pip
RUN python -m pip install --upgrade pip

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup appuser

# Create necessary directories
RUN mkdir -p outputs && chown -R appuser:appgroup /app

# Copy application code
COPY --chown=appuser:appgroup config.py .
COPY --chown=appuser:appgroup state.py .
COPY --chown=appuser:appgroup main.py .
COPY --chown=appuser:appgroup models/ ./models/
COPY --chown=appuser:appgroup routes/ ./routes/
COPY --chown=appuser:appgroup services/ ./services/

# Environment variables (defaults, override in docker-compose)
ENV MODEL_IDS="NousResearch/Hermes-4-14B-FP8"
ENV TENSOR_PARALLEL_SIZE=1
ENV GPU_MEMORY_UTILIZATION=0.7
ENV MAX_MODEL_LEN=8192
ENV IMAGE_MODEL="Tongyi-MAI/Z-Image-Turbo"
ENV VIDEO_MODEL="FX-FeiHou/wan2.2-Remix"
ENV ENABLE_IMAGE=true
ENV ENABLE_VIDEO=true

# HuggingFace settings
ENV HF_HUB_ENABLE_HF_TRANSFER=1

# Run as non-root user
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["python", "main.py"]
