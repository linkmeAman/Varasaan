from datetime import datetime

from pydantic import BaseModel

from app.models import PolicyType


class LegalPolicyCreateRequest(BaseModel):
    policy_type: PolicyType
    version: str
    effective_from: datetime
    checksum: str
    is_active: bool = False


class LegalPolicyResponse(BaseModel):
    id: str
    policy_type: PolicyType
    version: str
    effective_from: datetime
    is_active: bool
    checksum: str
