import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ReportJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "report_jobs"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("report_templates.id"), nullable=False
    )
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False)  # scheduled | manual | retry
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | waiting_input | running | completed | failed | cancelled
    manual_inputs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    parameters: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    template = relationship("ReportTemplate", back_populates="jobs")
    artifacts = relationship("ReportArtifact", back_populates="job", lazy="selectin")
    deliveries = relationship("ReportDelivery", back_populates="job", lazy="selectin")
