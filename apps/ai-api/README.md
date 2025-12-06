# AI API

Унифицированный сервис для инференса LLM и генерации медиа-контента. Построен на FastAPI с использованием vLLM для языковых моделей и Diffusers для генерации изображений/видео.

## Возможности

- **LLM Chat** — чат с языковыми моделями с поддержкой стриминга
- **Model Comparison** — сравнение ответов нескольких моделей на один промпт
- **Image Generation** — генерация изображений по текстовому описанию (text-to-image)
- **Image-to-Image** — трансформация изображений на основе текстового промпта
- **Video Generation** — генерация видео на основе изображения и текстового промпта
- **Dynamic Model Management** — загрузка и выгрузка моделей на лету для оптимизации GPU памяти

## Требования

- Python 3.11+
- NVIDIA GPU с CUDA 12.1+ (рекомендуется)
- ~24GB+ VRAM для работы с моделями
- FFmpeg (для обработки видео)

## Установка

### Локальный запуск

```bash
# Создание виртуального окружения
python -m venv .venv
source .venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt

# Конфигурация
cp .env.example .env
# Отредактируйте .env под ваши нужды

# Запуск
python main.py
```

### Docker

```bash
docker build -t ai-api .
docker run --gpus all -p 8000:8000 \
  -e MODEL_IDS="NousResearch/Hermes-4-14B-FP8" \
  -v /path/to/models:/models \
  ai-api
```

## Конфигурация

Настройка через переменные окружения:

| Переменная               | Описание                                   | По умолчанию                                        |
| ------------------------ | ------------------------------------------ | --------------------------------------------------- |
| `MODEL_IDS`              | Список моделей HuggingFace (через запятую) | `huihui-ai/Huihui-Qwen3-VL-8B-Instruct-abliterated` |
| `TENSOR_PARALLEL_SIZE`   | Количество GPU для параллелизма тензоров   | `1`                                                 |
| `GPU_MEMORY_UTILIZATION` | Процент использования GPU памяти           | `0.95`                                              |
| `MAX_MODEL_LEN`          | Максимальная длина контекста               | `8192`                                              |
| `IMAGE_MODEL`            | Модель для text-to-image генерации         | `Tongyi-MAI/Z-Image-Turbo`                          |
| `IMAGE2IMAGE_MODEL`      | Модель для image-to-image трансформации    | `Heartsync/NSFW-Uncensored`                         |
| `VIDEO_MODEL`            | Модель для генерации видео                 | `Phr00t/WAN2.2-14B-Rapid-AllInOne`                  |
| `ENABLE_IMAGE`           | Включить text-to-image генерацию           | `true`                                              |
| `ENABLE_IMAGE2IMAGE`     | Включить image-to-image трансформацию      | `true`                                              |
| `ENABLE_VIDEO`           | Включить генерацию видео                   | `true`                                              |
| `HF_HOME`                | Директория кэша HuggingFace                | `/models`                                           |

## API Endpoints

После запуска документация доступна по адресам:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

### Health

```
GET /health
```

Возвращает статус сервиса и информацию о загруженных моделях.

### LLM

#### Список моделей

```
GET /api/tags
```

Возвращает список доступных LLM моделей.

#### Chat Completion

```
POST /api/chat
```

**Тело запроса:**

```json
{
  "model": "Hermes-4-14B-FP8",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "stream": true,
  "temperature": 0.7,
  "top_p": 0.95,
  "top_k": 40,
  "max_tokens": 2048
}
```

При `stream: true` возвращает Server-Sent Events.

#### Сравнение моделей

```
POST /api/compare
```

**Тело запроса:**

```json
{
  "models": ["Hermes-4-14B-FP8", "Qwen3-VL-8B"],
  "messages": [{ "role": "user", "content": "Explain quantum computing" }],
  "temperature": 0.7,
  "max_tokens": 2048
}
```

Возвращает стриминг с ответами от каждой модели последовательно.

### Media Generation

#### Генерация изображений

```
POST /generate/image
```

**Тело запроса:**

```json
{
  "prompt": "A beautiful sunset over mountains",
  "negative_prompt": "blurry, low quality",
  "width": 1024,
  "height": 1024,
  "num_inference_steps": 4,
  "guidance_scale": 3.5,
  "seed": 42
}
```

**Ответ:**

```json
{
  "image_base64": "iVBORw0KGgo...",
  "seed": 42,
  "generation_time": 2.5
}
```

#### Image-to-Image трансформация

##### Список доступных моделей

```
GET /generate/image2image/models
```

**Ответ:**

```json
{
  "models": [
    "Heartsync/NSFW-Uncensored",
    "stabilityai/stable-diffusion-xl-base-1.0"
  ],
  "current_model": "Heartsync/NSFW-Uncensored"
}
```

##### Трансформация изображения

```
POST /generate/image2image
Content-Type: multipart/form-data

image: <file>               # Исходное изображение
prompt: "Transform to oil painting style"
negative_prompt: "blurry"   # Опционально
strength: 0.75              # Сила трансформации (0.0-1.0)
num_inference_steps: 30
guidance_scale: 7.5
seed: 42                    # Опционально
model: "Heartsync/NSFW-Uncensored"  # Опционально, выбор модели
```

**Ответ:**

```json
{
  "image_base64": "iVBORw0KGgo...",
  "seed": 42,
  "generation_time": 3.5
}
```

**Параметры:**

- `strength` — сила трансформации: 0.0 = почти оригинал, 1.0 = полная трансформация
- `model` — выбор модели для генерации (опционально, по умолчанию используется `IMAGE2IMAGE_MODEL`)
- Чем выше `strength`, тем сильнее изменение относительно исходного изображения

**Доступные модели:**

- `Heartsync/NSFW-Uncensored` — SDXL-based модель без цензуры (по умолчанию)
- `stabilityai/stable-diffusion-xl-base-1.0` — базовая SDXL модель
- `Tongyi-MAI/Z-Image-Edit` — (скоро) модель от Alibaba для редактирования

#### Генерация видео

Поддерживается несколько семейств видео моделей с автоматическим определением pipeline:

| Модель                                 | Описание                                  | VRAM  | FPS | Шаги |
| -------------------------------------- | ----------------------------------------- | ----- | --- | ---- |
| `Phr00t/WAN2.2-14B-Rapid-AllInOne`     | **MEGA** T2V+I2V+VACE, FP8, самая быстрая | ~8GB  | 24  | 4    |
| `Lightricks/LTX-Video`                 | Быстрая, real-time capable                | ~16GB | 30  | 30   |
| `THUDM/CogVideoX-5b-I2V`               | Хорошее качество I2V                      | ~24GB | 8   | 50   |
| `Wan-AI/Wan2.2-I2V-14B-480P-Diffusers` | Высокое качество I2V                      | ~48GB | 24  | 30   |
| `tencent/HunyuanVideo`                 | Лучшее качество T2V                       | 60GB+ | 30  | 50   |

> **Phr00t/WAN2.2-14B-Rapid-AllInOne** — оптимизированная модель с автоматическими параметрами:
>
> - 4 шага инференса
> - CFG 1.0
> - Поддержка T2V, I2V и VACE (first-to-last frame)
> - Работает даже на 8GB VRAM!

Запуск задачи:

```
POST /generate/video
Content-Type: multipart/form-data

image: <file>
prompt: "Camera slowly zooms in"
num_inference_steps: 50
guidance_scale: 6.0
num_frames: 49
seed: 42
```

**Ответ:**

```json
{
  "task_id": "uuid-task-id",
  "status": "pending",
  "progress": 0.0
}
```

Проверка статуса:

```
GET /generate/video/status/{task_id}
```

**Ответ:**

```json
{
  "task_id": "uuid-task-id",
  "status": "completed",
  "progress": 100.0,
  "video_base64": "AAAAIGZ0eXBp..."
}
```

Статусы: `pending`, `processing`, `completed`, `failed`

### Model Management

API для динамического управления моделями позволяет загружать и выгружать модели на лету, освобождая GPU память.

#### Список моделей

```
GET /models
```

**Ответ:**

```json
{
  "models": [
    {
      "model_id": "NousResearch/Hermes-4-14B-FP8",
      "model_type": "llm",
      "status": "loaded",
      "name": "Hermes-4-14B-FP8",
      "loaded_at": "2024-01-15T10:30:00Z"
    }
  ],
  "gpu_memory_total_mb": 24576,
  "gpu_memory_used_mb": 15000,
  "gpu_memory_free_mb": 9576
}
```

#### Загрузка модели

```
POST /models/load
```

**Тело запроса:**

```json
{
  "model_id": "meta-llama/Llama-3.2-8B-Instruct",
  "model_type": "llm",
  "force": false
}
```

**Ответ:**

```json
{
  "model_id": "meta-llama/Llama-3.2-8B-Instruct",
  "status": "loaded",
  "message": "Model loaded successfully"
}
```

Типы моделей (`model_type`): `llm`, `image`, `image2image`, `video`

#### Выгрузка модели

```
POST /models/unload
```

**Тело запроса:**

```json
{
  "model_id": "NousResearch/Hermes-4-14B-FP8",
  "model_type": "llm"
}
```

**Ответ:**

```json
{
  "model_id": "NousResearch/Hermes-4-14B-FP8",
  "status": "not_loaded",
  "message": "Model unloaded successfully",
  "freed_memory_mb": 14500
}
```

#### Переключение модели

```
POST /models/switch
```

Выгружает текущую модель того же типа и загружает новую.

**Тело запроса:**

```json
{
  "model_id": "Qwen/Qwen2.5-14B-Instruct",
  "model_type": "llm"
}
```

#### Статус модели

```
GET /models/status/{model_id}
```

**Ответ:**

```json
{
  "model_id": "NousResearch/Hermes-4-14B-FP8",
  "type": "llm",
  "status": "loaded",
  "error": null,
  "loaded_at": "2024-01-15T10:30:00Z"
}
```

Статусы: `not_loaded`, `loading`, `loaded`, `unloading`, `error`

## Структура проекта

```
ai-api/
├── main.py              # Точка входа, FastAPI app
├── config.py            # Конфигурация и переменные окружения
├── state.py             # Глобальное состояние (загруженные модели)
├── models/              # Pydantic модели
│   ├── llm.py           # Модели для LLM запросов/ответов
│   ├── media.py         # Модели для медиа генерации
│   └── management.py    # Модели для управления моделями
├── routes/              # API роуты
│   ├── health.py        # Health check
│   ├── llm.py           # LLM endpoints
│   ├── media.py         # Media generation endpoints
│   └── models.py        # Model management endpoints
├── services/            # Бизнес-логика
│   ├── llm.py           # Инференс LLM
│   ├── media.py         # Генерация медиа
│   └── model_manager.py # Динамическая загрузка/выгрузка моделей
├── requirements.txt     # Python зависимости
├── Dockerfile           # Docker образ
└── .env.example         # Пример конфигурации
```

## Примеры использования

### Python

```python
import requests
import base64

# Chat
response = requests.post("http://localhost:8000/api/chat", json={
    "model": "Hermes-4-14B-FP8",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": False
})
print(response.json()["message"]["content"])

# Image generation
response = requests.post("http://localhost:8000/generate/image", json={
    "prompt": "A cat astronaut",
    "num_inference_steps": 4
})
image_data = base64.b64decode(response.json()["image_base64"])
with open("output.png", "wb") as f:
    f.write(image_data)
```

### cURL

```bash
# Chat (non-streaming)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Hermes-4-14B-FP8",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# Chat (streaming)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Hermes-4-14B-FP8",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'

# Image generation
curl -X POST http://localhost:8000/generate/image \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A beautiful landscape"}'
```

## Технологический стек

- **FastAPI** — асинхронный веб-фреймворк
- **vLLM** — высокопроизводительный инференс LLM
- **Diffusers** — библиотека для диффузионных моделей
- **PyTorch** — ML фреймворк
- **Transformers** — загрузка и работа с моделями HuggingFace
