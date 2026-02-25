import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "clipquest-media")
MINIO_REGION = "us-east-1"

def _s3_client():
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency 'boto3'. Install it with: pip install boto3"
        ) from exc

    return boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        region_name="us-east-1",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )

def ensure_bucket_exists(bucket: str = MINIO_BUCKET) -> None:
    try:
        from botocore.exceptions import ClientError
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency 'boto3'. Install it with: pip install boto3"
        ) from exc

    s3 = _s3_client()
    try:
        s3.create_bucket(Bucket=bucket)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
            return
        if code in {"AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch"}:
            raise RuntimeError(
                "MinIO auth failed. Check MINIO_ENDPOINT/MINIO_ACCESS_KEY/"
                "MINIO_SECRET_KEY and make sure they match docker/minio.yaml."
            ) from exc
        raise


def upload_bytes(storage_key: str, data: bytes, content_type: Optional[str] = None) -> None:
    ensure_bucket_exists()
    s3 = _s3_client()
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    s3.put_object(Bucket=MINIO_BUCKET, Key=storage_key, Body=data, **extra)


def upload_text(storage_key: str, text: str, encoding: str = "utf-8") -> None:
    upload_bytes(storage_key, text.encode(encoding), content_type="text/plain")


def download_to_tempfile(storage_key: str, suffix: str = "") -> Path:
    ensure_bucket_exists()
    s3 = _s3_client()
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        s3.download_fileobj(MINIO_BUCKET, storage_key, tmp)
        return Path(tmp.name)
