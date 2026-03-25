# Codex Agent Instructions — Varasaan

> Codex: read this file before every task. It defines the rules, structure, and verification requirements for this project.

## Project Overview

Varasaan is an India-first digital bereavement platform. It has two modes:
- **Planning Mode**: living user prepares their digital estate
- **After-Loss Mode**: executor/family closes, recovers, and documents accounts after death

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 + FastAPI (async, Pydantic v2) |
| ORM | SQLAlchemy 2.0 (async) + Alembic |
| Database | PostgreSQL + Redis |
| Task Queue | Celery + Redis |
| Frontend | Next.js (App Router) + React + TypeScript |
| Testing | pytest + Playwright |
| Infra | Docker + Terraform (AWS) |

## Directory Structure

```
backend/
  src/app/
    main.py              → FastAPI app factory (create_app)
    core/
      config.py          → Pydantic Settings class (get_settings)
      security.py        → JWT + password hashing
      rate_limit.py      → Redis/in-memory rate limiter
      redis_client.py    → Redis singleton
    api/
      deps.py            → Dependency injection (db_session_dep, get_current_user)
      router.py          → Root API router
      routes/            → One file per feature (auth.py, cases.py, payments.py, etc.)
    models/
      entities.py        → All SQLAlchemy models
      __init__.py        → Re-exports (User, Case, etc.)
    schemas/             → Pydantic request/response DTOs
    services/            → Business logic (one file per feature)
    integrations/        → External service clients (AWS, malware scan)
    workers/             → Celery task definitions
    db/
      session.py         → get_engine, get_session_factory, get_db_session
      base.py            → SQLAlchemy Base
  alembic/               → Database migrations
  tests/
    conftest.py          → test_context fixture with FakeAwsService, FakeMalwareClient
    test_*.py            → Integration test files

frontend/
  src/
    app/                 → Next.js App Router pages
    components/          → React components
    lib/
      api.ts             → API client wrapper
      generated/         → AUTO-GENERATED — do not hand-edit
        api-client.ts    → Generated from OpenAPI
      auth-context.tsx   → Auth provider
      use-*.ts           → Custom hooks (one per feature workspace)
    api/
      openapi-types.ts   → AUTO-GENERATED — do not hand-edit
    types/               → Shared TypeScript types
    views/               → Page-level view components
  tests/e2e/             → Playwright specs

packages/shared/
  openapi/
    openapi.yaml         → Source of truth OpenAPI spec
    openapi.generated.json → Generated JSON from YAML

scripts/                 → CI, ops, and sync scripts
infra/                   → Terraform deployment stacks
```

## Three-Stream Delivery Model

Every phase is delivered in this strict order:

1. **Backend** — schema, models, services, routes, tests
2. **Sync / QA / Docs** — OpenAPI, generated client/types, doc updates
3. **Frontend** — hooks, screens, UX, Playwright specs

### Rules
- Backend lands on `main` first. Sync starts from refreshed `main`.
- Sync lands on `main` second. Frontend starts from refreshed `main`.
- Never continue stale branches — always branch from latest `main`.
- Frontend never handwrites API types — consume generated client only.
- A phase is not complete until all 3 streams are merged with passing CI.

### Branch Naming
```
codex/<phase>-backend
codex/<phase>-sync
codex/<phase>-frontend
```

## Coding Principles (Non-Negotiable)

- No `os.environ.get` — use Pydantic `Settings` class
- No sync SQLAlchemy — use `create_async_engine` + `AsyncSession`
- No handwritten frontend API types — use generated client from `frontend/src/lib/generated/`
- All new endpoints must have integration tests
- All user-visible changes must have Playwright spec coverage
- Never store credentials, seeds, or secrets for users — non-custodial only

## Required Patterns (Follow These Exactly)

### Configuration — Always Use Settings

```python
# ✅ CORRECT — use the Settings singleton
from app.core.config import get_settings
settings = get_settings()
value = settings.database_url

# ❌ WRONG — never do this
import os
value = os.environ.get("DATABASE_URL")
```

### Database — Always Async

```python
# ✅ CORRECT — async session from dependency injection
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db_session

async def my_route(db: AsyncSession = Depends(db_session_dep)):
    result = await db.execute(select(User).where(User.id == user_id))

# ❌ WRONG — never use sync session
from sqlalchemy.orm import Session
```

### Adding a New Setting

Add the field to `backend/src/app/core/config.py` in the `Settings` class:
```python
class Settings(BaseSettings):
    # ... existing fields ...
    my_new_setting: str = "default-value"
```

### Adding a New Model

Add to `backend/src/app/models/entities.py` and re-export in `__init__.py`:
```python
# In entities.py — follow existing patterns (UUID PK, timestamps, soft delete)
class MyNewModel(Base):
    __tablename__ = "my_new_table"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
```

### Adding a New Route

1. Create `backend/src/app/api/routes/my_feature.py`
2. Use `APIRouter` with prefix and tags
3. Inject dependencies via `Depends()`:
   - `db: AsyncSession = Depends(db_session_dep)` for database
   - `user: User = Depends(get_current_user)` for auth
   - `Depends(enforce_csrf)` for CSRF on mutating cookie-auth endpoints
4. Register the router in `backend/src/app/api/routes/__init__.py`

### Adding a New Service

Create `backend/src/app/services/my_feature.py`:
- Business logic lives here, not in routes
- Routes call services; services use the database session
- Services receive `AsyncSession` as a parameter

### Writing Integration Tests

Follow the existing `test_context` fixture pattern in `conftest.py`:
```python
@pytest.mark.asyncio
async def test_my_feature(test_context: dict):
    client = test_context["client"]
    # 1. Setup: create user, login, get cookies
    # 2. Act: call API endpoint
    # 3. Assert: check response status and body
```

Test files go in `backend/tests/test_<feature>.py`.

### Adding a Frontend Hook

Create `frontend/src/lib/use-my-feature.ts`:
- Import types from `frontend/src/lib/generated/api-client.ts` or `frontend/src/api/openapi-types.ts`
- Use the API client from `frontend/src/lib/api.ts`
- Never define request/response types manually

### Adding a Frontend Page

- Add to `frontend/src/app/<route>/page.tsx` (Next.js App Router convention)
- Protected routes: `/dashboard/*` and `/executor/*` are guarded by middleware
- Add to middleware matcher in `frontend/src/middleware.ts` if needed

## Migration Rules

- Alembic autogenerate: `uv run alembic -c backend/alembic.ini revision --autogenerate -m "description"`
- Always review generated migration before applying
- Never edit migration files after they've been applied to shared environments
- Test migration: `uv run alembic -c backend/alembic.ini upgrade head`

## Verification Commands

Run these BEFORE creating a PR or marking any checklist item complete:

### Backend
```bash
uv run --project backend ruff check backend/src backend/tests
uv run --project backend mypy backend/src
uv run --project backend pytest -c backend/pyproject.toml
```

### Frontend
```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test:smoke
npm --prefix frontend run build
```

### Contract Sync
```bash
npm run verify:sync
```

### Artifact Regeneration (Sync stream only)
```bash
python backend/scripts/generate_openapi.py
npm --prefix frontend run generate:api
```

## Doc Ownership

The **Sync / QA / Docs** stream must update these 4 files every phase:
1. `PROGRESS_CHECKLIST.md` — high-level phase tracking
2. `PRODUCT_DEVELOPMENT.md` — detailed roadmap
3. `CHANGELOG.md` — release notes
4. `INTEGRATION_CHECKLIST.md` — API contract status

Other docs update only when their scope changes:
- `EXECUTION_PLAN.md` — execution rules/sequence
- `IMPLEMENTATION_CHECKLIST.md` — CI/CD governance
- `LAUNCH_RUNBOOK.md` — deploy/rollback procedures
- `CODEX_CHECKLIST.md` — master task checklist (mark items `[x]` after merge)

## Current Project State (2026-03-26)

| Phase | Status |
|-------|--------|
| Pre-Phase Baseline | ✅ Complete |
| Phase A — After-Loss Hardening | 🔶 Implementation done, awaiting staging sign-off |
| Phase B — Tiered Billing | ❌ Not started |
| Quick Wins | ❌ Not started |
| Phase C — Family Workspace | ❌ Not started |
| Phase D — Crypto Inheritance | ❌ Not started |
| Launch Closure | ❌ Not started |

## What To Do When Assigned A Task

1. Read this file first
2. Read `CODEX_CHECKLIST.md` for the specific phase/stream checklist
3. Read `INTEGRATION_CHECKLIST.md` for current API contract state
4. Branch from latest `main`
5. Complete all `[ ]` items for your assigned stream
6. Run the verification commands for your stream
7. Ensure all checks pass before finishing
8. Do NOT modify files owned by another stream

## What NOT To Do

- Do not modify `openapi.yaml` or generated files during a backend stream
- Do not modify backend code during a frontend stream
- Do not mark checklist items `[x]` without passing CI evidence
- Do not add new dependencies without justification
- Do not use `any` types in TypeScript
- Do not use raw SQL — use SQLAlchemy models
- Do not skip tests for "simple" changes

## Common Mistakes To Avoid

| Mistake | Fix |
|---------|-----|
| Using `os.environ` | Use `get_settings().field_name` |
| Creating sync DB session | Use `AsyncSession` from `get_db_session` |
| Hardcoding API types in frontend | Import from `lib/generated/` |
| Adding route without test | Add test in `backend/tests/test_<feature>.py` |
| Editing generated files | Only edit `openapi.yaml`, then regenerate |
| Forgetting CSRF on mutating routes | Add `Depends(enforce_csrf)` for cookie-auth mutations |
| Using `@app.on_event("startup")` | Use the `lifespan` async context manager |
| Continuing a stale branch | Always `git checkout main && git pull` first |
| Skipping contract sync check | Always run `npm run verify:sync` |
