from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from pathlib import Path
from typing import Any, cast

import yaml  # type: ignore[import-untyped]
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()


def _init_sentry() -> None:
    settings = get_settings()
    if not settings.sentry_dsn:
        return

    try:  # pragma: no cover
        import sentry_sdk  # type: ignore[import-not-found]

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.env,
            release=settings.sentry_release,
            traces_sample_rate=settings.sentry_traces_sample_rate,
        )
    except Exception as exc:  # pragma: no cover
        logging.getLogger(__name__).warning("Sentry initialization skipped: %s", exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.auto_create_schema:
        from app.db.base import Base
        from app.db.session import get_engine

        engine = get_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield


def _error(code: str, message: str, details: list[dict] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    _ = request
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error(code=f"http_{exc.status_code}", message=detail),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    _ = request
    return JSONResponse(
        status_code=422,
        content=_error(
            code="validation_error",
            message="Validation failed",
            details=[{"loc": err.get("loc", []), "msg": err.get("msg", ""), "type": err.get("type", "")} for err in exc.errors()],
        ),
    )


async def healthz() -> dict[str, str]:
    return {"status": "ok"}


def _load_contract_openapi() -> dict[str, Any] | None:
    settings = get_settings()
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


def create_app() -> FastAPI:
    settings = get_settings()
    _init_sentry()
    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    app.exception_handler(HTTPException)(http_exception_handler)
    app.exception_handler(RequestValidationError)(validation_exception_handler)
    app.get("/healthz", tags=["health"])(healthz)

    openapi_cache: dict[str, Any] | None = None

    def custom_openapi() -> dict[str, Any]:
        nonlocal openapi_cache
        if openapi_cache is not None:
            return openapi_cache
        contract = _load_contract_openapi()
        if contract is not None:
            openapi_cache = contract
            return openapi_cache
        openapi_cache = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        return openapi_cache

    cast(Any, app).openapi = custom_openapi
    return app


app = create_app()
