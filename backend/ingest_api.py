import json
import uuid
from constants import *

from typing import Any, Dict, Optional, List
from startup import ensure_schema
from postgres_queries import insert_asset_row
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pgvector.psycopg2 import register_vector
from object_store import upload_bytes

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_schema()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}

def _ms_to_hhmmss(ms: int) -> str:
    s = ms // 1000
    hh = s // 3600
    mm = (s % 3600) // 60
    ss = s % 60
    return f"{hh:02d}:{mm:02d}:{ss:02d}"

def _merge_hits(hits: List[Dict[str, Any]], max_gap_ms: int = 1500) -> List[Dict[str, Any]]:
    """
    Merge hits into ranges if they overlap or are close in time.
    max_gap_ms: if the next chunk starts within this gap, merge.
    """
    if not hits:
        return []

    hits = sorted(hits, key=lambda x: x["start_time"])
    merged = [hits[0].copy()]
    merged[0]["texts"] = [merged[0].pop("text")]

    for h in hits[1:]:
        last = merged[-1]
        if h["start_time"] <= last["end_time"] + max_gap_ms:
            last["end_time"] = max(last["end_time"], h["end_time"])
            last["texts"].append(h["text"])
            last["chunk_indexes"].append(h["chunk_index"])
            last["best_distance"] = min(last["best_distance"], h["distance"])
        else:
            nh = h.copy()
            nh["texts"] = [nh.pop("text")]
            merged.append(nh)

    # join texts
    for m in merged:
        m["text"] = " ".join(m.pop("texts"))
        m["start_ts"] = _ms_to_hhmmss(m["start_time"])
        m["end_ts"] = _ms_to_hhmmss(m["end_time"])
    return merged

def delivery_report(err: Optional[Exception], msg: Any) -> None:
    """Kafka delivery callback."""
    if err is not None:
        print(f"Kafka publish failed: {err}")
        return
    print(
        "Kafka published: "
        f"{msg.topic()} [{msg.partition()}] offset={msg.offset()}"
    )


def save_upload_to_object_storage(
    asset_id: uuid.UUID,
    file: UploadFile
) -> str:
    """
    Save uploaded file bytes to MinIO and return object key.
    """
    storage_key = f"{asset_id}/raw_{file.filename}"
    data = file.file.read()
    upload_bytes(storage_key, data, content_type=file.content_type)
    return storage_key


def publish_asset_uploaded_event(
    asset_id: uuid.UUID,
    original_filename: str,
    storage_key: str,
) -> None:
    """Publish asset.uploaded event to Kafka."""

    event: Dict[str, str] = {
        "event": UPLOADED_EVENT_TOPIC,
        "asset_id": str(asset_id),
        "original_filename": original_filename,
        "storage_key": storage_key,
    }
    payload = json.dumps(event).encode("utf-8")

    producer.produce(
        topic=UPLOADED_EVENT_TOPIC,
        key=str(asset_id),
        value=payload,
        callback=delivery_report,
    )
    producer.flush()


@app.post("/upload")
async def upload(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Upload endpoint:
      - saves raw file to object storage
      - inserts asset row to Postgres
      - publishes Kafka event
    """
    asset_id = uuid.uuid4()

    # Save bytes to MinIO.
    data = await file.read()
    storage_key = f"{asset_id}/raw_{file.filename}"
    upload_bytes(storage_key, data, content_type=file.content_type)

    insert_asset_row(asset_id, file.filename, storage_key)
    publish_asset_uploaded_event(asset_id, file.filename, storage_key)

    return {
        "asset_id": str(asset_id),
        "storage_key": storage_key
    }


@app.get("/search")
def search(asset_id: str, q: str, k: int = 8) -> Dict[str, Any]:
    query_vec = get_model().encode([q], batch_size=16, show_progress_bar=False)[0]
    query_vec = [float(x) for x in query_vec]

    with pg_conn() as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  t.chunk_index,
                  t.start_time,
                  t.end_time,
                  t.text,
                  (e.embedding <=> %s::vector) AS distance
                FROM chunk_embeddings e
                JOIN transcript_chunks t ON t.chunk_id = e.chunk_id
                WHERE t.asset_id = %s
                ORDER BY e.embedding <=> %s::vector
                LIMIT %s;
                """,
                (query_vec, asset_id, query_vec, k),
            )
            rows = cur.fetchall()

    hits = []
    for (chunk_index, start_time, end_time, text, distance) in rows:
        hits.append(
            {
                "chunk_index": chunk_index,
                "chunk_indexes": [chunk_index],
                "start_time": start_time,
                "end_time": end_time,
                "text": text,
                "distance": float(distance),
                "best_distance": float(distance),
            }
        )
    ranges = _merge_hits(hits)

    return {
        "asset_id": asset_id,
        "query": q,
        "top_k": k,
        "hits": hits,
        "ranges": ranges,
    }


@app.get("/assets/{asset_id}/status")
def asset_status(asset_id: str) -> Dict[str, Any]:
    with pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT asset_id::text, original_filename, storage_key, status, created_at
                FROM assets
                WHERE asset_id = %s
                """,
                (asset_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="asset not found")

            cur.execute(
                "SELECT COUNT(*) FROM transcript_chunks WHERE asset_id = %s",
                (asset_id,),
            )
            transcript_count = int(cur.fetchone()[0])

            cur.execute(
                """
                SELECT COUNT(*)
                FROM chunk_embeddings e
                JOIN transcript_chunks t ON t.chunk_id = e.chunk_id
                WHERE t.asset_id = %s
                """,
                (asset_id,),
            )
            embedding_count = int(cur.fetchone()[0])

    (rid, original_filename, storage_key, status, created_at) = row
    return {
        "asset_id": rid,
        "original_filename": original_filename,
        "storage_key": storage_key,
        "status": status,
        "created_at": created_at.isoformat() if created_at else None,
        "transcript_count": transcript_count,
        "embedding_count": embedding_count,
        "ready": status == "EMBEDDED",
    }
