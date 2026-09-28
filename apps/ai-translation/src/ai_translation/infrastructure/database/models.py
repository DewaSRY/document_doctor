from datetime import datetime
from sqlalchemy import String, DateTime, Text, func, Index, LargeBinary, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class TranslationRecord(Base):
    """Model for storing translation records."""

    __tablename__ = "translation_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    translated_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_language: Mapped[str] = mapped_column(String(10), nullable=False)
    target_language: Mapped[str] = mapped_column(String(10), nullable=False)
    emotion_tags: Mapped[str | None] = mapped_column(String(255), nullable=True)
    voice_tags: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    __table_args__ = (
        Index("idx_source_target_lang", "source_language", "target_language"),
        Index("idx_created_at", "created_at"),
    )


class TranslationJob(Base):
    """Model for tracking translation jobs (for batch processing)."""

    __tablename__ = "translation_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    total_records: Mapped[int] = mapped_column(nullable=False)
    processed_records: Mapped[int] = mapped_column(nullable=False, default=0)
    failed_records: Mapped[int] = mapped_column(nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_job_status", "status"),
        Index("idx_job_created_at", "created_at"),
    )


class TranslatedDocument(Base):
    """Model for storing translated documents."""

    __tablename__ = "translated_documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_file_size: Mapped[int] = mapped_column(nullable=False)
    document_type: Mapped[str] = mapped_column(String(10), nullable=False)
    source_language: Mapped[str] = mapped_column(String(10), nullable=False)
    target_language: Mapped[str] = mapped_column(String(10), nullable=False)
    translated_document: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    emotion_tags: Mapped[str | None] = mapped_column(String(255), nullable=True)
    voice_tags: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    __table_args__ = (
        Index("idx_doc_id", "document_id"),
        Index("idx_source_target_lang_doc", "source_language", "target_language"),
        Index("idx_created_at_doc", "created_at"),
    )


class DocumentSegments(Base):
    """
    The original upload and its translated segments, kept so a translated
    document can be edited and rebuilt. A separate table so existing
    databases pick it up through create_all without a migration.
    """

    __tablename__ = "document_segments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    original_document: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    # [{"key": "para_0", "source_text": "...", "translated_text": "..."}, ...] in document order.
    segments: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
