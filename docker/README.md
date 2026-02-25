# Docker Stack

This folder contains the split Docker Compose stack used by the root `Makefile`.

## Files
- `compose.base.yml` - project name + shared volumes
- `kafka.compose.yml` - Kafka (KRaft)
- `postgres.compose.yml` - Postgres + pgvector
- `minio.compose.yml` - MinIO + bucket bootstrap (`minio-init`)
- `ingest-api.compose.yml` - FastAPI service
- `transcription-worker.compose.yml` - Whisper worker
- `embedding-worker.compose.yml` - embedding worker
- `frontend.compose.yml` - Vite frontend container

## Run Manually (without Makefile)
```bash
docker compose \
  -f docker/compose.base.yml \
  -f docker/kafka.compose.yml \
  -f docker/postgres.compose.yml \
  -f docker/minio.compose.yml \
  -f docker/ingest-api.compose.yml \
  -f docker/transcription-worker.compose.yml \
  -f docker/embedding-worker.compose.yml \
  -f docker/frontend.compose.yml \
  up -d --build
```

Stop:
```bash
docker compose \
  -f docker/compose.base.yml \
  -f docker/kafka.compose.yml \
  -f docker/postgres.compose.yml \
  -f docker/minio.compose.yml \
  -f docker/ingest-api.compose.yml \
  -f docker/transcription-worker.compose.yml \
  -f docker/embedding-worker.compose.yml \
  -f docker/frontend.compose.yml \
  down
```

Recommended shortcut:
```bash
make up
make down
```
