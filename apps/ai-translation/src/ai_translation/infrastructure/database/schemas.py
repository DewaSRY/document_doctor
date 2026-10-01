from datetime import datetime
from pydantic import BaseModel, Field


class TranslationRecordCreate(BaseModel):
    """Schema for creating a translation record."""

    source_text: str = Field(..., min_length=1, description="Source text to translate")
    translated_text: str = Field(..., min_length=1, description="Translated text")
    source_language: str = Field(..., min_length=2, max_length=10, description="Source language code")
    target_language: str = Field(..., min_length=2, max_length=10, description="Target language code")
    emotion_tags: str | None = Field(default=None, max_length=255, description="Comma-separated emotion tags")
    voice_tags: str | None = Field(default=None, max_length=255, description="Comma-separated voice tags")
    model_name: str = Field(..., max_length=255, description="Model name used")


class TranslationRecordUpdate(BaseModel):
    """Schema for updating a translation record."""

    source_text: str | None = Field(default=None, description="Source text to translate")
    translated_text: str | None = Field(default=None, description="Translated text")
    emotion_tags: str | None = Field(default=None, description="Comma-separated emotion tags")
    voice_tags: str | None = Field(default=None, description="Comma-separated voice tags")


class TranslationRecordResponse(BaseModel):
    """Schema for returning a translation record."""

    id: int
    source_text: str
    translated_text: str
    source_language: str
    target_language: str
    emotion_tags: str | None = None
    voice_tags: str | None = None
    model_name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TranslationJobCreate(BaseModel):
    """Schema for creating a translation job."""

    job_id: str = Field(..., max_length=50, description="Unique job identifier")
    total_records: int = Field(..., gt=0, description="Total records to process")


class TranslationJobUpdate(BaseModel):
    """Schema for updating a translation job."""

    status: str | None = Field(default=None, description="Job status (pending, processing, completed, failed)")
    processed_records: int | None = Field(default=None, ge=0, description="Number of processed records")
    failed_records: int | None = Field(default=None, ge=0, description="Number of failed records")
    error_message: str | None = Field(default=None, description="Error message if job failed")
    started_at: datetime | None = Field(default=None, description="Job start time")
    completed_at: datetime | None = Field(default=None, description="Job completion time")


class TranslationJobResponse(BaseModel):
    """Schema for returning a translation job."""

    id: int
    job_id: str
    status: str
    total_records: int
    processed_records: int
    failed_records: int
    error_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class TranslatedDocumentCreate(BaseModel):
    """Schema for creating a translated document record."""

    document_id: str = Field(..., max_length=50, description="Unique document identifier")
    original_file_name: str = Field(..., max_length=255, description="Original file name")
    original_file_size: int = Field(..., gt=0, description="Original file size in bytes")
    document_type: str = Field(..., max_length=10, description="Document type (pdf or docx)")
    source_language: str = Field(..., min_length=2, max_length=10, description="Source language code")
    target_language: str = Field(..., min_length=2, max_length=10, description="Target language code")
    emotion_tags: str | None = Field(default=None, max_length=255, description="Comma-separated emotion tags")
    voice_tags: str | None = Field(default=None, max_length=255, description="Comma-separated voice tags")
    model_name: str = Field(..., max_length=255, description="Model name used")


class TranslatedDocumentUpdate(BaseModel):
    """Schema for updating a translated document record."""

    original_file_name: str | None = Field(default=None, max_length=255)
    original_file_size: int | None = Field(default=None, gt=0)
    document_type: str | None = Field(default=None, max_length=10)
    source_language: str | None = Field(default=None, min_length=2, max_length=10)
    target_language: str | None = Field(default=None, min_length=2, max_length=10)
    translated_document: bytes | None = None
    status: str | None = Field(default=None, max_length=20)
    emotion_tags: str | None = Field(default=None, max_length=255)
    voice_tags: str | None = Field(default=None, max_length=255)
    model_name: str | None = Field(default=None, max_length=255)


class TranslatedDocumentResponse(BaseModel):
    """Schema for returning a translated document record (without binary content)."""

    id: int
    document_id: str
    original_file_name: str
    original_file_size: int
    document_type: str
    source_language: str
    target_language: str
    status: str
    emotion_tags: str | None = None
    voice_tags: str | None = None
    model_name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
