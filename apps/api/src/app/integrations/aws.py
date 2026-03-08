from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from app.core.config import get_settings

try:
    import boto3
except Exception:  # pragma: no cover
    boto3 = None


class AwsDependencyError(RuntimeError):
    pass


@dataclass(slots=True)
class EnvelopeDataKey:
    plaintext_key_b64: str
    encrypted_key_b64: str
    kms_key_id: str


class AwsStorageCryptoService:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._session = None
        self._s3_client = None
        self._kms_client = None

    def _require_boto3(self) -> None:
        if boto3 is None:
            raise AwsDependencyError("boto3 is required for AWS storage and KMS operations")

    def _session_or_create(self):
        self._require_boto3()
        if self._session is None:
            self._session = boto3.session.Session(
                aws_access_key_id=self._settings.aws_access_key_id,
                aws_secret_access_key=self._settings.aws_secret_access_key,
                aws_session_token=self._settings.aws_session_token,
                region_name=self._settings.aws_region,
            )
        return self._session

    def _s3_or_create(self):
        if self._s3_client is None:
            self._s3_client = self._session_or_create().client(
                "s3",
                endpoint_url=self._settings.aws_s3_endpoint_url,
                region_name=self._settings.aws_region,
            )
        return self._s3_client

    def _kms_or_create(self):
        if self._kms_client is None:
            self._kms_client = self._session_or_create().client(
                "kms",
                endpoint_url=self._settings.aws_kms_endpoint_url,
                region_name=self._settings.aws_region,
            )
        return self._kms_client

    async def generate_data_key(self, *, encryption_context: dict[str, str]) -> EnvelopeDataKey:
        response = await asyncio.to_thread(
            self._kms_or_create().generate_data_key,
            KeyId=self._settings.kms_key_id,
            KeySpec="AES_256",
            EncryptionContext=encryption_context,
        )
        plaintext: bytes = response["Plaintext"]
        encrypted_blob: bytes = response["CiphertextBlob"]
        return EnvelopeDataKey(
            plaintext_key_b64=base64.b64encode(plaintext).decode("ascii"),
            encrypted_key_b64=base64.b64encode(encrypted_blob).decode("ascii"),
            kms_key_id=str(response.get("KeyId", self._settings.kms_key_id)),
        )

    async def presign_upload(
        self,
        *,
        object_key: str,
        expires_seconds: int,
        content_type: str = "application/octet-stream",
        bucket: str | None = None,
    ) -> str:
        params: dict[str, Any] = {
            "Bucket": bucket or self._settings.s3_bucket_documents,
            "Key": object_key,
            "ContentType": content_type,
        }
        return await asyncio.to_thread(
            self._s3_or_create().generate_presigned_url,
            "put_object",
            Params=params,
            ExpiresIn=expires_seconds,
        )

    async def presign_download(
        self,
        *,
        object_key: str,
        expires_seconds: int,
        bucket: str | None = None,
    ) -> str:
        params = {"Bucket": bucket or self._settings.s3_bucket_documents, "Key": object_key}
        return await asyncio.to_thread(
            self._s3_or_create().generate_presigned_url,
            "get_object",
            Params=params,
            ExpiresIn=expires_seconds,
        )

    async def upload_bytes(
        self,
        *,
        bucket: str,
        object_key: str,
        payload: bytes,
        content_type: str = "application/octet-stream",
    ) -> None:
        await asyncio.to_thread(
            self._s3_or_create().put_object,
            Bucket=bucket,
            Key=object_key,
            Body=payload,
            ContentType=content_type,
        )


@lru_cache
def get_aws_storage_crypto_service() -> AwsStorageCryptoService:
    return AwsStorageCryptoService()
