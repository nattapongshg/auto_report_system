from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TemplateCreate(BaseModel):
    template_id: str
    name: str
    description: str | None = None
    definition: dict


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    definition: dict | None = None
    is_active: bool | None = None


class TemplateResponse(BaseModel):
    id: UUID
    template_id: str
    name: str
    description: str | None
    definition: dict
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    items: list[TemplateResponse]
    total: int
