# Backend

Backend services for the ClipQuest pipeline:
- `ingest_api.py` (FastAPI API)
- `asset_uploaded_worker.py` (Whisper transcription worker)
- `asset_transcriber_worker.py` (embedding worker)
- `object_store.py` (MinIO integration)
- `postgres_queries.py` + `startup.py` (DB schema + SQL helpers)

## Runtime Flow
1. `POST /upload` stores media in MinIO, inserts `assets` row, publishes `asset.uploaded`.
2. Transcription worker consumes `asset.uploaded`, writes transcript chunks, publishes `asset.transcribed`.
3. Embedding worker consumes `asset.transcribed`, writes vectors to `chunk_embeddings`.
4. `GET /search` performs pgvector similarity over chunk embeddings.

## API Endpoints
- `GET /health`
- `POST /upload`
- `GET /assets/{asset_id}/status`
- `GET /search?asset_id=...&q=...&k=...`

## Local Run (without backend container)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Terminal 1:
```bash
cd backend
source .venv/bin/activate
uvicorn ingest_api:app --reload --port 8000
```

Terminal 2:
```bash
cd backend
source .venv/bin/activate
python asset_uploaded_worker.py
```

Terminal 3:
```bash
cd backend
source .venv/bin/activate
python asset_transcriber_worker.py
```

## Required Environment
- `KAFKA_BOOTSTRAP`
- `PG_HOST`, `PG_PORT`, `PG_DB`, `PG_USER`, `PG_PASS`
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
- Optional:
  - `WHISPER_MODEL` (default `base`)
  - `UPLOADED_WORKER_GROUP_ID`
  - `EMBEDDING_WORKER_GROUP_ID`
