from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class JobRunRequest(BaseModel):
    manual_inputs: dict | None = None
    parameters: dict | None = None


class ArtifactResponse(BaseModel):
    id: UUID
    file_name: str | None
    s3_key: str | None
    file_size_bytes: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeliveryResponse(BaseModel):
    id: UUID
    recipient_email: str
    status: str
    sent_at: datetime | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class JobResponse(BaseModel):
    id: UUID
    template_id: UUID
    trigger_type: str
    status: str
    manual_inputs: dict | None
    parameters: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    retry_count: int
    created_at: datetime
    artifacts: list[ArtifactResponse] = []
    deliveries: list[DeliveryResponse] = []

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
