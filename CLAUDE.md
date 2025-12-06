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

#### ai-api — Stateless сервис

- **Чистый вычислительный сервис** без бизнес-логики
- Принимает ВСЕ параметры явно (prompt, steps, guidance, width, height, model)
- НЕ знает о пресетах, настройках пользователей, авторизации
- Задача: загрузить модель → выполнить генерацию → вернуть результат
- Можно масштабировать горизонтально, деплоить на GPU-сервера

#### gateway — Бизнес-логика

- **Пресеты моделей** хранятся в `apps/gateway/src/presets.ts`
- Применяет пресеты перед отправкой запроса в ai-api
- Авторизация через `@ai-lab/auth`
- Валидация запросов
- Проксирование к ai-api с обогащением параметров

#### web — UI

- Загружает пресеты из gateway (`/api/media/image/models`)
- Применяет пресеты в UI при выборе модели
- Позволяет пользователю переопределить параметры

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
 │                        │  steps=9, guidance=0, │
 │                        │  width=1024, ...}     │
 │                        │──────────────────────>│
 │                        │                       │ Generate
 │                        │<──────────────────────│
 │<───────────────────────│                       │
```

### Пресеты моделей

Каждая модель имеет оптимальные параметры:

| Модель          | Steps | Guidance | Neg. Prompt |
| --------------- | ----- | -------- | ----------- |
| Z-Image-Turbo   | 9     | 0.0      | ❌          |
| SDXL Base       | 30    | 7.5      | ✅          |
| NSFW-Uncensored | 30    | 7.0      | ✅          |

Пресеты определены в `apps/gateway/src/presets.ts`.

### Переменные окружения

- `DATABASE_URL` — PostgreSQL connection string
- `CORS_ORIGIN` — разрешённый origin для CORS
- `NEXT_PUBLIC_API_URL` — URL gateway для web-клиента
- `AI_API_URL` — URL ai-api для gateway

## Стек технологий

- **Runtime**: Bun
- **Build**: Turborepo
- **Linting**: Biome через Ultracite
- **Web**: Next.js 16, React 19, Tailwind 4, Radix UI
- **Gateway**: Hono
- **Database**: PostgreSQL + Prisma
- **Auth**: better-auth
- **AI API**: Python, FastAPI, vLLM, Diffusers

## Особенности кода

- Используется Biome с пресетом Ultracite (см. `biome.json`)
- React 19: `ref` как prop вместо `forwardRef`
- Tailwind 4 (через `@tailwindcss/postcss`)
- Prisma схема в `packages/db/prisma/schema/schema.prisma`
- UI компоненты в `apps/web/src/components/ui/`
- Пресеты моделей в `apps/gateway/src/presets.ts`
