from __future__ import annotations

import asyncio
import base64
import secrets
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from urllib.parse import urlencode

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
        self._mock_objects: dict[tuple[str, str], bytes] = {}

    def _is_mock_mode(self) -> bool:
        return self._settings.mock_external_services

    def _mock_url(self, *, operation: str, bucket: str, object_key: str, expires_seconds: int) -> str:
        query = urlencode(
            {
                "bucket": bucket,
                "key": object_key,
                "expires": expires_seconds,
            }
        )
        return f"{self._settings.api_base_url}/api/v1/testing/storage/{operation}?{query}"

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
        if self._is_mock_mode():
            _ = encryption_context
            plaintext = secrets.token_bytes(32)
            encrypted = b"mock-encrypted-" + plaintext[:8]
            return EnvelopeDataKey(
                plaintext_key_b64=base64.b64encode(plaintext).decode("ascii"),
                encrypted_key_b64=base64.b64encode(encrypted).decode("ascii"),
                kms_key_id=self._settings.kms_key_id,
            )

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
        target_bucket = bucket or self._settings.s3_bucket_documents
        if self._is_mock_mode():
            _ = content_type
            return self._mock_url(
                operation="upload",
                bucket=target_bucket,
                object_key=object_key,
                expires_seconds=expires_seconds,
            )

        params: dict[str, Any] = {
            "Bucket": target_bucket,
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
        target_bucket = bucket or self._settings.s3_bucket_documents
        if self._is_mock_mode():
            return self._mock_url(
                operation="download",
                bucket=target_bucket,
                object_key=object_key,
                expires_seconds=expires_seconds,
            )

        params = {"Bucket": target_bucket, "Key": object_key}
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
        if self._is_mock_mode():
            _ = content_type
            self._mock_objects[(bucket, object_key)] = payload
            return

        await asyncio.to_thread(
            self._s3_or_create().put_object,
            Bucket=bucket,
            Key=object_key,
            Body=payload,
            ContentType=content_type,
        )

    async def delete_object(
        self,
        *,
        bucket: str,
        object_key: str,
    ) -> None:
        if self._is_mock_mode():
            self._mock_objects.pop((bucket, object_key), None)
            return

        await asyncio.to_thread(
            self._s3_or_create().delete_object,
            Bucket=bucket,
            Key=object_key,
        )

    def get_mock_object(self, *, bucket: str, object_key: str) -> bytes | None:
        return self._mock_objects.get((bucket, object_key))


@lru_cache
def get_aws_storage_crypto_service() -> AwsStorageCryptoService:
    return AwsStorageCryptoService()
