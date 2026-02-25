"""
Worker that consumes 'asset.uploaded' events from Kafka and prints them.

Run:
  export KAFKA_BOOTSTRAP=localhost:9092   # optional
  python asset_uploaded_worker.py
"""

import json
import os
import signal
import whisper
import uuid
from pathlib import Path

from postgres_queries import _update_asset_status
from constants import *
from typing import Any, Dict, Optional
from postgres_queries import insert_transcript_row
from confluent_kafka import Consumer, KafkaError, Message
from object_store import download_to_tempfile, upload_text

TRANSCRIBED_EVENT_TOPIC = "asset.transcribed"

_running = True

def transcribe_report(err: Optional[Exception], msg: Any) -> None:
    """Kafka delivery callback."""
    if err is not None:
        print(f"Kafka publish failed: {err}")
        return
    print(
        "Kafka published: "
        f"{msg.topic()} [{msg.partition()}] offset={msg.offset()}"
    )

def publish_asset_transcribed_event(
    asset_id: uuid.UUID,
    chunk_count: int,
) -> None:
    """Publish asset.transcribed event to Kafka."""

    event: Dict[str, str] = {
        "event": TRANSCRIBED_EVENT_TOPIC,
        "asset_id": str(asset_id),
        "chunk_count": chunk_count,
    }
    payload = json.dumps(event).encode("utf-8")

    producer.produce(
        topic=TRANSCRIBED_EVENT_TOPIC,
        key=str(asset_id),
        value=payload,
        callback=transcribe_report,
    )
    producer.flush()

def _handle_signal(signum: int, frame: Optional[object]) -> None:
    """Stop the polling loop on SIGINT/SIGTERM."""
    global _running
    _running = False
    print(f"\nReceived signal {signum}. Shutting down...")


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

def main() -> int:
    """Entrypoint."""
    bootstrap = os.getenv("KAFKA_BOOTSTRAP", DEFAULT_BOOTSTRAP)
    whisper_model_name = os.getenv("WHISPER_MODEL", "base")
    print(f"Loading Whisper model '{whisper_model_name}'...")
    model = whisper.load_model(whisper_model_name)
    print("Whisper model ready.")

    consumer = Consumer(
        {
            "bootstrap.servers": bootstrap,
            "group.id": UPLOADED_WORKER_GROUP_ID,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": True,
            # A single video can take minutes to transcribe on CPU.
            "max.poll.interval.ms": 1800000,
        }
    )

    consumer.subscribe([UPLOADED_EVENT_TOPIC])
    print(
        f"Listening on topic '{UPLOADED_EVENT_TOPIC}' @ {bootstrap} "
        f"(group={UPLOADED_WORKER_GROUP_ID})"
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

            print("GOT EVENT:", event)


            asset_id = event.get("asset_id")
            storage_key = event.get("storage_key")
            if not asset_id or not storage_key:
                print("Invalid event payload; missing asset_id/storage_key:", event)
                continue

            try:
                suffix = Path(storage_key).suffix
                temp_media_path = download_to_tempfile(storage_key, suffix=suffix)
                try:
                    result = model.transcribe(str(temp_media_path), verbose=False)
                finally:
                    temp_media_path.unlink(missing_ok=True)

                segments = result.get("segments", [])
                lines = []
                for index, seg in enumerate(segments):
                    start = seg["start"]
                    end = seg["end"]
                    text = seg["text"].strip()
                    lines.append(f"[{start:0.2f} - {end:0.2f}] {text}")
                    insert_transcript_row(
                        asset_id=asset_id,
                        chunk_index=index,
                        start_ms=int(start * 1000),
                        end_ms=int(end * 1000),
                        text=text,
                    )

                transcript_key = f"{asset_id}/transcription.txt"
                upload_text(transcript_key, "\n".join(lines) + "\n")

                _update_asset_status(asset_id, "TRANSCRIBED")
                publish_asset_transcribed_event(
                    asset_id=asset_id,
                    chunk_count=len(result.get("segments", [])),
                )
                print(
                    f"Transcription complete for asset_id={asset_id} "
                    f"chunks={len(result.get('segments', []))}"
                )
                print("Finished processing event for asset_id:", asset_id)
            except Exception as exc:
                print(f"Failed processing asset_id={asset_id}: {exc}")
                _update_asset_status(asset_id, "ERROR")
                continue

    finally:
        consumer.close()
        print("Consumer closed.")

    return 0


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)
    raise SystemExit(main())
