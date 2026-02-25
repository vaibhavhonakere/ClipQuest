import uuid

from constants import pg_conn


def connect_and_query(sql, params=None):
    """Connect to Postgres and run a simple query."""
    with pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()

def insert_asset_row(
    asset_id: uuid.UUID,
    original_filename: str,
    storage_key: str,
) -> None:
    """Insert asset row into Postgres."""
    sql = (
        "INSERT INTO assets(asset_id, original_filename, storage_key, status) "
        "VALUES (%s, %s, %s, %s)"
    )
    params = (str(asset_id), original_filename, storage_key, "UPLOADED")
    connect_and_query(sql, params)

def insert_transcript_row(
    chunk_index: int,
    asset_id: str,
    start_ms: int,
    end_ms: int,
    text: str
) -> None:
    """Insert Transcript Text and TimeStamps into Postgres."""
    sql = (
        """
        INSERT INTO transcript_chunks
            (chunk_index, asset_id, start_time, end_time, text)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (asset_id, chunk_index) DO UPDATE
        SET start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            text = EXCLUDED.text;
        """
    )
    params = (chunk_index, asset_id, start_ms, end_ms, text)
    connect_and_query(sql, params)
