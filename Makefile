.PHONY: up down reset logs ps build restart

COMPOSE_FILES = \
	-f docker/compose.base.yml \
	-f docker/kafka.compose.yml \
	-f docker/postgres.compose.yml \
	-f docker/minio.compose.yml \
	-f docker/ingest-api.compose.yml \
	-f docker/transcription-worker.compose.yml \
	-f docker/embedding-worker.compose.yml \
	-f docker/frontend.compose.yml

DOCKER_COMPOSE = docker compose $(COMPOSE_FILES)

up:
	$(DOCKER_COMPOSE) up -d --build
	@echo "Waiting for API health (http://localhost:8000/health) ..."
	@i=0; until curl -fsS http://localhost:8000/health >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ $$i -ge 90 ]; then \
			echo ""; \
			echo "API did not become ready in time. Recent ingest-api logs:"; \
			$(DOCKER_COMPOSE) logs --tail=120 ingest-api; \
			exit 1; \
		fi; \
		printf "."; \
		sleep 2; \
	done; \
	echo " ok"
	@echo "Waiting for Frontend (http://localhost:5173) ..."
	@i=0; until curl -fsS http://localhost:5173 >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ $$i -ge 90 ]; then echo ""; echo "Frontend did not become ready in time."; exit 1; fi; \
		printf "."; \
		sleep 2; \
	done; \
	echo " ok"
	@echo ""
	@echo "ClipQuest stack is ready:"
	@echo "  Frontend:     http://localhost:5173"
	@echo "  API Health:   http://localhost:8000/health"
	@echo "  API Docs:     http://localhost:8000/docs"
	@echo "  MinIO Console: http://localhost:9090"
	@echo ""
	@echo "Use 'make logs' to follow container logs."

build:
	$(DOCKER_COMPOSE) build

down:
	$(DOCKER_COMPOSE) down

reset:
	$(DOCKER_COMPOSE) down -v --remove-orphans

logs:
	$(DOCKER_COMPOSE) logs -f --tail=200

ps:
	$(DOCKER_COMPOSE) ps

restart:
	$(DOCKER_COMPOSE) down && $(MAKE) up
