from pydantic import BaseModel


class ResourceItem(BaseModel):
    id: str
    kind: str
    name: str
    path: str
    url: str
    source: str


class ModelCapabilityRead(BaseModel):
    id: str
    name: str
    role: str
    configured: bool
    endpoint_hint: str = ""
    notes: str = ""
