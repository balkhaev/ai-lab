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
├── gateway/     # Hono API на Bun (проксирует к ai-api, авторизация)
└── ai-api/      # Python FastAPI (vLLM для LLM, Diffusers для медиа)

packages/
├── db/          # Prisma + PostgreSQL
├── auth/        # better-auth (email/password)
└── config/      # Общая конфигурация
```

### Поток данных

1. **web** → **gateway** (через `NEXT_PUBLIC_API_URL`)
2. **gateway** → **ai-api** (через `AI_API_URL`)
3. **gateway** обрабатывает авторизацию через **@ai-lab/auth**
4. **@ai-lab/auth** использует **@ai-lab/db** для хранения сессий

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
