.PHONY: help dev dev-db build up down logs clean

help:
	@echo "AI Lab - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev        - Start development mode (all services with hot reload)"
	@echo "  make dev-db     - Start only PostgreSQL for local development"
	@echo ""
	@echo "Docker:"
	@echo "  make build      - Build all Docker images"
	@echo "  make up         - Start all services in production mode"
	@echo "  make down       - Stop all services"
	@echo "  make logs       - Show logs from all services"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean      - Remove all containers, volumes, and images"

# Development with hot reload
dev:
	@echo "Starting development mode..."
	bun run dev

# Start only database for local development
dev-db:
	@echo "Starting PostgreSQL..."
	docker compose -f docker-compose.dev.yml up -d

# Build all Docker images
build:
	@echo "Building Docker images..."
	docker compose build

# Start all services in production mode
up:
	@echo "Starting all services..."
	docker compose up -d

# Stop all services
down:
	@echo "Stopping all services..."
	docker compose down

# Show logs
logs:
	docker compose logs -f

# Clean everything
clean:
	@echo "Cleaning up..."
	docker compose down -v --rmi all
	docker compose -f docker-compose.dev.yml down -v


