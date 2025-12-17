# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Команды разработки

```bash
# Разработка
bun dev              # Запуск всех приложений (turbo)
bun dev:web          # Только web (Next.js на порту 3001)
bun dev:gateway      # Только gateway (Hono на Bun)

# База данных
bun db:start         # Запустить PostgreSQL в Docker
bun db:stop          # Остановить PostgreSQL
bun db:studio        # Открыть Prisma Studio
bun db:push          # Применить схему к БД
bun db:generate      # Сгенерировать Prisma Client
bun db:migrate       # Создать миграцию

# Линтинг и форматирование
bun check            # Biome check + fix
bun x ultracite fix  # Форматирование через Ultracite

# Docker (через Makefile)
make dev             # Запуск в dev режиме
make dev-db          # Только PostgreSQL
make build           # Собрать Docker образы
make up              # Запустить продакшен
make down            # Остановить сервисы
make logs            # Логи всех сервисов
```

## Архитектура

Monorepo на Bun workspaces + Turborepo:

```
apps/
├── web/         # Next.js 16 (React 19), порт 3001
├── gateway/     # Hono API на Bun (бизнес-логика, пресеты, авторизация)
└── ai-api/      # Python FastAPI (stateless, vLLM, Diffusers)

packages/
├── db/          # Prisma + PostgreSQL
├── auth/        # better-auth (email/password)
└── config/      # Общая конфигурация
```

### Принципы архитектуры

#### ai-api — Stateless вычислительный сервис

- **Чистый вычислительный сервис** без бизнес-логики
- Принимает ВСЕ параметры явно (prompt, steps, guidance, width, height, model)
- НЕ знает о пресетах, настройках пользователей, авторизации
- **ModelOrchestrator** — singleton для умного управления GPU памятью (LRU eviction)
- **Task Queue** — Redis-based очередь для асинхронных задач (video, image, etc.)
- Задача: загрузить модель → выполнить генерацию → вернуть результат
- Можно масштабировать горизонтально, деплоить на GPU-сервера

**Типы моделей** (`ModelType`):

- `llm` — языковые модели (vLLM)
- `image` — text-to-image (Diffusers)
- `image2image` — image-to-image transformation
- `video` — text-to-video / image-to-video
- `image_to_3d` — image-to-3D reconstruction (point clouds, depth, normals, gaussians)

**Типы задач** (`TaskType`):

- `video` — генерация видео (асинхронно)
- `image` — генерация изображений
- `image2image` — трансформация изображений
- `image_to_3d` — 3D-реконструкция из изображения
- `llm_compare` — сравнение ответов нескольких LLM

#### gateway — Бизнес-логика

- **Пресеты моделей** хранятся в `apps/gateway/src/presets.ts`
- Применяет пресеты перед отправкой запроса в ai-api
- Авторизация через `@ai-lab/auth`
- Валидация запросов
- Проксирование к ai-api с обогащением параметров

#### web — UI

- Загружает пресеты из gateway (`/api/models/*`)
- Применяет пресеты в UI при выборе модели
- Позволяет пользователю переопределить параметры
- Task Queue UI для отслеживания асинхронных задач

### Поток данных

```
web                    gateway                 ai-api
 │                        │                       │
 │ POST /api/media/image  │                       │
 │ {prompt, model}        │                       │
 │───────────────────────>│                       │
 │                        │ Apply preset          │
 │                        │ Add defaults          │
 │                        │                       │
 │                        │ POST /generate/image  │
 │                        │ {prompt, model,       │
 │                        │  steps, guidance,     │
 │                        │  width, height, ...}  │
 │                        │──────────────────────>│
 │                        │                       │ Orchestrator:
 │                        │                       │ - ensure memory
 │                        │                       │ - load model
 │                        │                       │ - generate
 │                        │<──────────────────────│
 │<───────────────────────│                       │

Async tasks (video, heavy operations):

web                    gateway                 ai-api
 │ POST /api/tasks        │                       │
 │ {type: "video", ...}   │                       │
 │───────────────────────>│ POST /queue/tasks    │
 │                        │──────────────────────>│
 │                        │                       │ Create task (Redis)
 │<───────────────────────│<──────────────────────│ {task_id}
 │                        │                       │
 │ GET /api/tasks/:id     │                       │ Worker processes
 │───────────────────────>│ GET /queue/tasks/:id │ task in background
 │                        │──────────────────────>│
 │<───────────────────────│<──────────────────────│ {status, progress}
```

### Пресеты моделей

Каждая модель имеет оптимальные параметры. Пресеты определены в `apps/gateway/src/presets.ts`.

**LLM Presets:**

| Модель                | Temperature | Top P | Max Tokens | Vision |
| --------------------- | ----------- | ----- | ---------- | ------ |
| NemoMix-Unleashed-12B | 1.0         | 0.95  | 4096       | ❌     |
| Qwen 2.5 7B           | 0.7         | 0.95  | 4096       | ❌     |
| Qwen 2 VL 7B          | 0.7         | 0.95  | 4096       | ✅     |

**Image Presets:**

| Модель              | Steps | Guidance | Neg. Prompt | VRAM  | Notes                      |
| ------------------- | ----- | -------- | ----------- | ----- | -------------------------- |
| Z-Image-Turbo       | 9     | 0.0      | ❌          | ~14GB | Быстрая генерация          |
| SDXL Base           | 30    | 7.5      | ✅          | ~7GB  | Универсальная              |
| NSFW-Uncensored     | 30    | 7.0      | ✅          | ~7GB  | SDXL без цензуры           |
| Flux NSFW Uncensored| 28    | 3.5      | ❌          | ~16GB | Flux LoRA, высокое качество|

**Image2Image Presets:**

| Модель             | Steps | Guidance | Strength | VRAM  | Notes                                    |
| ------------------ | ----- | -------- | -------- | ----- | ---------------------------------------- |
| SDXL Refiner       | 30    | 7.5      | 0.3      | ~7GB  | Улучшает детали существующих изображений |
| SDXL Base          | 30    | 7.5      | 0.75     | ~7GB  | Стандартная трансформация                |
| NSFW-Uncensored    | 30    | 7.0      | 0.75     | ~7GB  | Без цензуры                              |
| LongCat-Image-Edit | 50    | 4.5      | N/A      | ~19GB | SOTA билингвальный редактор (CN/EN)      |
| NSFW Undress       | 30    | 7.0      | 0.65     | ~8GB  | NSFW + sexy LoRA для раздевания          |

**Video Models:**

| Модель           | VRAM  | Notes                 |
| ---------------- | ----- | --------------------- |
| WAN2.2-14B-Rapid | ~8GB  | FP8, 4 steps, fastest |
| LTX-Video        | ~16GB | 30fps, fast           |
| CogVideoX-5b-I2V | ~24GB | Good quality I2V      |
| HunyuanVideo     | ~60GB | Highest quality T2V   |

**Image-to-3D Models:**

| Модель              | VRAM  | Outputs                                         |
| ------------------- | ----- | ----------------------------------------------- |
| HunyuanWorld-Mirror | ~16GB | Point clouds, depth maps, normals, 3D Gaussians |

### Переменные окружения

**ai-api:**

- `MODEL_IDS` — LLM модели (через запятую)
- `TENSOR_PARALLEL_SIZE` — количество GPU для vLLM
- `GPU_MEMORY_UTILIZATION` — % GPU памяти для vLLM
- `MAX_MODEL_LEN` — максимальная длина контекста
- `IMAGE_MODEL` — модель для text-to-image
- `IMAGE2IMAGE_MODEL` — модель для img2img
- `VIDEO_MODEL` — модель для video generation
- `IMAGE_TO_3D_MODEL` — модель для image-to-3D
- `ENABLE_IMAGE` / `ENABLE_IMAGE2IMAGE` / `ENABLE_VIDEO` / `ENABLE_IMAGE_TO_3D` — включить/выключить
- `REDIS_URL` — URL Redis для task queue
- `TASK_TTL_HOURS` — время жизни задач в часах

**gateway:**

- `PORT` — порт gateway (default: 3000)
- `DATABASE_URL` — PostgreSQL connection string
- `CORS_ORIGIN` — разрешённый origin для CORS
- `AI_API_URL` — URL ai-api для проксирования
- `REDIS_URL` — Redis для прямого чтения статуса задач

**web:**

- `NEXT_PUBLIC_GATEWAY_URL` — URL gateway для клиента

## Стек технологий

- **Runtime**: Bun
- **Build**: Turborepo
- **Linting**: Biome через Ultracite
- **Web**: Next.js 16, React 19, Tailwind 4, Radix UI
- **Gateway**: Hono
- **Database**: PostgreSQL + Prisma
- **Auth**: better-auth
- **Cache/Queue**: Redis
- **AI API**: Python, FastAPI, vLLM, Diffusers, PyTorch

## Особенности кода

- Используется Biome с пресетом Ultracite (см. `biome.json`)
- React 19: `ref` как prop вместо `forwardRef`
- Tailwind 4 (через `@tailwindcss/postcss`)
- Prisma схема в `packages/db/prisma/schema/`
- UI компоненты в `apps/web/src/components/ui/`
- Пресеты моделей в `apps/gateway/src/presets.ts`

## Ключевые файлы

**ai-api:**

- `services/orchestrator.py` — ModelOrchestrator, управление GPU памятью
- `services/queue.py` — Redis task queue
- `services/loaders/` — загрузчики моделей (llm, image, video, image_to_3d)
- `routes/` — API endpoints (health, llm, media, models, queue)

**gateway:**

- `src/presets.ts` — пресеты для всех типов моделей
- `src/routes/` — API routes (llm, media, models, tasks)

**web:**

- `src/components/task-queue.tsx` — UI для очереди задач
- `src/hooks/use-task.ts` — хуки для работы с задачами
