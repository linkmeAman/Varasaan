import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def create_audit_log(
    db: AsyncSession,
    *,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    request_id: str | None,
    ip_hash: str | None,
    metadata: dict | None = None,
) -> AuditLog:
    log = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        request_id=request_id,
        ip_hash=ip_hash,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(log)
    await db.flush()
    return log
