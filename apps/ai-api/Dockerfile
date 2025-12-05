FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks
RUN ln -sf /usr/bin/python3.11 /usr/bin/python && \
    ln -sf /usr/bin/python3.11 /usr/bin/python3

# Upgrade pip
RUN python -m pip install --upgrade pip

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

# Create output directory
RUN mkdir -p outputs

# Environment variables
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

EXPOSE 8000

CMD ["python", "main.py"]

