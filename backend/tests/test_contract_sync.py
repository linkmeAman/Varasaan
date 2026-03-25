from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from fastapi.routing import APIRoute

from app.main import app

HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"}
BACKEND_PENDING_SYNC_OPERATIONS = {
    ("GET", "/api/v1/payments/history"),
    ("GET", "/api/v1/payments/{}/invoice"),
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_generated_contract() -> dict[str, Any]:
    contract_path = _repo_root() / "packages" / "shared" / "openapi" / "openapi.generated.json"
    loaded = json.loads(contract_path.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise AssertionError(f"Invalid OpenAPI artifact at {contract_path}")
    return loaded


def _normalize_path(path: str) -> str:
    normalized = re.sub(r"\{[^}]+\}", "{}", path.rstrip("/"))
    return normalized or "/"


def _collect_contract_operations(contract: dict[str, Any]) -> set[tuple[str, str]]:
    operations: set[tuple[str, str]] = set()
    for raw_path, path_item in contract.get("paths", {}).items():
        if not isinstance(path_item, dict):
            continue
        for method in HTTP_METHODS:
            if method.lower() in path_item:
                operations.add((method, _normalize_path(str(raw_path))))
    return operations


def _collect_app_operations() -> set[tuple[str, str]]:
    operations: set[tuple[str, str]] = set()
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.include_in_schema:
            continue
        for method in route.methods:
            if method in HTTP_METHODS and (route.path == "/healthz" or route.path.startswith("/api/v1/")):
                operations.add((method, _normalize_path(route.path)))
    return operations


def test_generated_openapi_contract_matches_app_routes() -> None:
    contract = _load_generated_contract()
    expected_operations = _collect_contract_operations(contract)
    actual_operations = _collect_app_operations()

    missing_in_app = expected_operations - actual_operations
    missing_in_contract = actual_operations - expected_operations

    missing_in_contract -= BACKEND_PENDING_SYNC_OPERATIONS

    assert not missing_in_app and not missing_in_contract, (
        "Generated OpenAPI/backend route drift detected. "
        f"Missing in app: {sorted(missing_in_app)}. "
        f"Missing in contract: {sorted(missing_in_contract)}."
    )
