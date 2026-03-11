from __future__ import annotations

import logging
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()

if settings.sentry_dsn:
    try:  # pragma: no cover
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.env)
    except Exception as exc:  # pragma: no cover
        logging.getLogger(__name__).warning("Sentry initialization skipped: %s", exc)

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


def _error(code: str, message: str, details: list[dict] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    _ = request
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error(code=f"http_{exc.status_code}", message=detail),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    _ = request
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error(
            code="validation_error",
            message="Validation failed",
            details=[{"loc": err.get("loc", []), "msg": err.get("msg", ""), "type": err.get("type", "")} for err in exc.errors()],
        ),
    )


@app.get("/healthz", tags=["health"])
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


def _load_contract_openapi() -> dict | None:
    contract_path = Path(settings.openapi_contract_path)
    if not contract_path.is_absolute():
        contract_path = Path(__file__).resolve().parents[4] / contract_path
    if not contract_path.exists():
        return None
    with contract_path.open("r", encoding="utf-8") as fp:
        loaded = yaml.safe_load(fp)
    if isinstance(loaded, dict):
        return loaded
    return None


_openapi_cache: dict | None = None


def custom_openapi():
    global _openapi_cache
    if _openapi_cache is not None:
        return _openapi_cache
    contract = _load_contract_openapi()
    if contract is not None:
        _openapi_cache = contract
        return _openapi_cache
    _openapi_cache = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    return _openapi_cache


app.openapi = custom_openapi
