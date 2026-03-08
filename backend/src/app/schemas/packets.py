from pydantic import BaseModel


class PacketGenerateRequest(BaseModel):
    platform: str


class PacketJobResponse(BaseModel):
    id: str
    status: str
    platform: str
