# ---- constants / config ----
import os
import psycopg2
from confluent_kafka import Producer
from sentence_transformers import SentenceTransformer


UPLOADED_EVENT_TOPIC = "asset.uploaded"
DEFAULT_KAFKA_BOOTSTRAP = "localhost:9092"
DEFAULT_BOOTSTRAP = "localhost:9092"
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", DEFAULT_KAFKA_BOOTSTRAP)

# Use separate consumer groups per worker so they do not rebalance each other.
UPLOADED_WORKER_GROUP_ID = os.getenv(
    "UPLOADED_WORKER_GROUP_ID", "asset_uploaded_transcription_workers"
)
EMBEDDING_WORKER_GROUP_ID = os.getenv(
    "EMBEDDING_WORKER_GROUP_ID", "asset_transcribed_embedding_workers"
)

producer = Producer({"bootstrap.servers": KAFKA_BOOTSTRAP})

PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", 5432))
PG_DB = os.getenv("PG_DB", "clipquest_postgres")
PG_USER = os.getenv("PG_USER", "clipquest_username")
PG_PASS = os.getenv("PG_PASS", "clipquest_password")

MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"
_model = None


def get_model() -> SentenceTransformer:
    """Lazy-load embedding model so startup does not block/crash services."""
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model

def pg_conn():
    """Create a new Postgres connection."""
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        dbname=PG_DB,
        user=PG_USER,
        password=PG_PASS,
    )
