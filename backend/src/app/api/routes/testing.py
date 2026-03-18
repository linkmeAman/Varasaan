from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, Response, status

from app.core.config import get_settings
from app.integrations.aws import get_aws_storage_crypto_service

router = APIRouter(prefix="/testing", tags=["testing"], include_in_schema=False)


def _ensure_mock_mode() -> None:
    if not get_settings().mock_external_services:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.put("/storage/upload", include_in_schema=False)
async def mock_storage_upload(
    request: Request,
    bucket: str = Query(..., min_length=1),
    key: str = Query(..., min_length=1),
) -> dict[str, str]:
    _ensure_mock_mode()
    payload = await request.body()
    await get_aws_storage_crypto_service().upload_bytes(
        bucket=bucket,
        object_key=key,
        payload=payload,
        content_type=request.headers.get("content-type", "application/octet-stream"),
    )
    return {"status": "stored", "bucket": bucket, "key": key}


@router.get("/storage/download", include_in_schema=False)
async def mock_storage_download(
    bucket: str = Query(..., min_length=1),
    key: str = Query(..., min_length=1),
) -> Response:
    _ensure_mock_mode()
    payload = get_aws_storage_crypto_service().get_mock_object(bucket=bucket, object_key=key)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found")
    return Response(content=payload, media_type="application/octet-stream")
