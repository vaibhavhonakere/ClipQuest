
from constants import pg_conn

def ensure_schema():
    with pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS assets (
                  asset_id UUID PRIMARY KEY,
                  original_filename TEXT NOT NULL,
                  storage_key TEXT NOT NULL,
                  status TEXT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS transcript_chunks (
                  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
                  chunk_index INTEGER NOT NULL,
                  start_time INTEGER NOT NULL,
                  end_time INTEGER NOT NULL,
                  text TEXT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  UNIQUE(asset_id, chunk_index)
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_transcript_chunks_asset_id
                ON transcript_chunks(asset_id);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_transcript_chunks_asset_id_start_time
                ON transcript_chunks(asset_id, start_time);
                """
            )

            # --- pgvector + embeddings ---
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chunk_embeddings (
                  chunk_id UUID PRIMARY KEY
                    REFERENCES transcript_chunks(chunk_id) ON DELETE CASCADE,
                  embedding vector(1024) NOT NULL,
                  model_name TEXT NOT NULL DEFAULT 'Qwen/Qwen3-Embedding-0.6B',
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """
            )

            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_vec
                ON chunk_embeddings
                USING ivfflat (embedding vector_cosine_ops);
                """
            )
        conn.commit()
