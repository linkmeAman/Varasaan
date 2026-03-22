## Backend Changelog

- Rebuilt the API backend with migration-driven persistence (SQLAlchemy async + Alembic) and removed runtime schema creation.
- Replaced mocked storage/crypto flows with AWS S3 presigned upload/download and KMS envelope-key generation.
- Added malware scan orchestration with explicit state transitions (`PENDING -> RUNNING -> CLEAN/INFECTED/ERROR`) and document lifecycle updates.
- Implemented asynchronous packet/export workers using Celery + Redis queues with queued/processing/running/ready/failed transitions and S3 artifact writes.
- Fixed payment webhook linkage and ordering logic with signature verification, user/order mapping, replay handling, out-of-order rejection, and regression protection.
- Completed unauthenticated account recovery request/assist/confirm flows, including backup email and trusted-contact assisted recovery logic.
- Added the first after-loss slice with executor-backed pending cases, case activation, task snapshot generation, executor-only routes, and critical-path coverage.
- Published a complete contract-first OpenAPI spec and wired the app to serve that contract.
- Added integration tests for session rotation/revocation, document upload/scan/download authorization, export one-time tokens, and payment webhook replay/out-of-order behavior.
