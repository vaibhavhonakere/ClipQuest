"""
Worker that consumes 'asset.uploaded' events from Kafka and prints them.

Run:
  export KAFKA_BOOTSTRAP=localhost:9092   # optional
  python asset_uploaded_worker.py
"""

import json
import os
import signal
import uuid

from constants import *
from postgres_queries import _update_asset_status
from typing import Any, Dict, List, Optional,Sequence, Tuple
import numpy as np
from confluent_kafka import Consumer, KafkaError, Message, Producer
from pgvector.psycopg2 import register_vector
from constants import pg_conn

TRANSCRIBED_EVENT_TOPIC = "asset.transcribed"

_running = True
EMBED_DIM = 1024
TOPIC_OUT = "asset.embedded"

def _handle_signal(signum: int, frame: Optional[object]) -> None:
    """Stop the polling loop on SIGINT/SIGTERM."""
    global _running
    _running = False
    print(f"\nReceived signal {signum}. Shutting down...")

def _publish(producer: Producer, topic: str, payload: Dict[str, Any]) -> None:
    producer.produce(topic=topic, value=json.dumps(payload).encode("utf-8"))
    producer.flush()

def _parse_event(msg: Message) -> Optional[Dict[str, Any]]:
    """Decode and parse Kafka message value as JSON."""
    raw = msg.value()
    if raw is None:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        print(f"Failed to decode/parse message: {exc}")
        return None
    
def _fetch_chunks(asset_id: str) -> List[Tuple[str, str]]:
    """
    Returns list of (chunk_id, text) ordered by chunk_index.
    """
    with pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT chunk_id::text, text
                FROM transcript_chunks
                WHERE asset_id = %s
                ORDER BY chunk_index;
                """,
                (asset_id,),
            )
            rows = cur.fetchall()
    return [(row[0], row[1]) for row in rows]

def _store_embeddings(
    embeddings: Sequence[Sequence[float]],
    chunk_ids: Sequence[str],
    model_name: str,
) -> None:
    if len(embeddings) != len(chunk_ids):
        raise ValueError("embeddings and chunk_ids length mismatch")

    with pg_conn() as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            for chunk_id, vec in zip(chunk_ids, embeddings):
                # vec might be a numpy array of float32
                vec_np = np.asarray(vec, dtype=np.float32)

                if vec_np.shape[0] != EMBED_DIM:
                    raise ValueError(
                        f"Embedding dim mismatch: got {vec_np.shape[0]} expected {EMBED_DIM}"
                    )

                # IMPORTANT: convert to plain Python floats
                vec_py = vec_np.astype(float).tolist()

                cur.execute(
                    """
                    INSERT INTO chunk_embeddings (chunk_id, embedding, model_name)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (chunk_id) DO UPDATE
                    SET embedding = EXCLUDED.embedding,
                        model_name = EXCLUDED.model_name;
                    """,
                    (chunk_id, vec_py, model_name),
                )
        conn.commit()

def main() -> int:
    """Entrypoint."""
    bootstrap = os.getenv("KAFKA_BOOTSTRAP", DEFAULT_BOOTSTRAP)

    consumer = Consumer(
        {
            "bootstrap.servers": bootstrap,
            "group.id": EMBEDDING_WORKER_GROUP_ID,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": True,
            "max.poll.interval.ms": 1800000,
        }
    )

    consumer.subscribe([TRANSCRIBED_EVENT_TOPIC])
    print(
        f"Listening on topic '{TRANSCRIBED_EVENT_TOPIC}' @ {bootstrap} "
        f"(group={EMBEDDING_WORKER_GROUP_ID})"
    )

    try:
        while _running:
            msg = consumer.poll(1.0)
            if msg is None:
                continue

            err = msg.error()
            if err is not None:
                # Ignore end-of-partition signals; they are not real errors.
                if err.code() == KafkaError._PARTITION_EOF:
                    continue
                print(f"Kafka error: {err}")
                continue

            event = _parse_event(msg)
            if event is None:
                continue

            asset_id = event.get("asset_id")
            chunks = _fetch_chunks(asset_id)
            if not chunks:
                print(f"No transcript chunks found for asset_id {asset_id}")
                continue
            
            chunk_ids = [cid for (cid, _) in chunks]
            texts = [t for (_, t) in chunks]


            vectors = get_model().encode(texts, batch_size=16, show_progress_bar=False)
            _store_embeddings(vectors, chunk_ids, MODEL_NAME)

            _update_asset_status(asset_id, "EMBEDDED")

            out_event = {
                "event": TOPIC_OUT,
                "asset_id": asset_id,
                "chunk_count": len(chunks),
                "model_name": MODEL_NAME,
            }
            _publish(producer, TOPIC_OUT, out_event)
            print("Published:", out_event)


    finally:
        consumer.close()
        print("Consumer closed.")

    return 0


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)
    raise SystemExit(main())
