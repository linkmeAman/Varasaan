from pydantic import BaseModel


class InventoryCreateRequest(BaseModel):
    platform: str
    category: str
    username_hint: str | None = None
    importance_level: int = 2


class InventoryResponse(BaseModel):
    id: str
    platform: str
    category: str
    username_hint: str | None = None
    importance_level: int


class InventoryUpdateRequest(BaseModel):
    platform: str
    category: str
    username_hint: str | None = None
    importance_level: int
