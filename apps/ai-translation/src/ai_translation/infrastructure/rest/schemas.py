from typing import Any, Literal
from pydantic import BaseModel, Field


class PaginationMeta(BaseModel):
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    total_count: int = Field(..., description="Total number of items")
    total_page: int = Field(..., description="Total number of pages")


class SuccessResponse(BaseModel):
    data: Any = Field(..., description="Response payload - single object or list of objects")
    meta: PaginationMeta | None = Field(default=None, description="Pagination info (only for list endpoints)")
    error: None = Field(default=None, description="Always None on success")
    code: int = Field(..., description="HTTP status code")
    message: str = Field(..., description="Human-readable success message")


class ErrorItem(BaseModel):
    field: str = Field(..., description="Field name with validation error")
    message: str = Field(..., description="Error message for this field")


class ErrorResponseData(BaseModel):
    data: list = Field(default_factory=list, description="Always empty array on error")
    meta: None = Field(default=None, description="Always None on error")
    error: list[ErrorItem] | None = Field(default=None, description="Array of field-level errors")
    code: int = Field(..., description="HTTP status code")
    message: str = Field(..., description="Human-readable error message")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Health status of the service")


class TranslateRequest(BaseModel):
    text: str = Field(..., description="Text to translate")
    source_language: str = Field(..., description="Source language code (e.g., 'zh', 'id')")
    target_language: str = Field(..., description="Target language code (e.g., 'id', 'zh')")
    emotion_tags: list[str] | None = Field(default=None, description="Emotion tags (e.g., 'formal', 'casual')")
    voice_tags: list[str] | None = Field(default=None, description="Voice tags (e.g., 'professional', 'friendly')")


class TranslateResponse(BaseModel):
    translated_text: str = Field(..., description="Translated text")
    source_language: str = Field(..., description="Source language code")
    target_language: str = Field(..., description="Target language code")
    model: str = Field(..., description="Model name used for translation")


class TranslateDocumentResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier for the translated document")
    file_name: str = Field(..., description="Original document file name")
    file_size: int = Field(..., description="Size of the original document in bytes")
    source_language: str = Field(..., description="Source language code")
    target_language: str = Field(..., description="Target language code")
    document_type: str = Field(..., description="Document type (pdf or docx)")
    status: str = Field(..., description="Translation status")
    model: str = Field(..., description="Model name used for translation")
    created_at: str = Field(..., description="Timestamp when translation was created")


class SegmentStyle(BaseModel):
    """Overrides of a PDF segment's detected style; unset fields keep the detected value."""

    bold: bool | None = None
    italic: bool | None = None
    font_size: float | None = Field(default=None, ge=4, le=96, description="Font size in points")
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    align: Literal["left", "center", "right", "justify"] | None = None
    family: Literal["Helvetica", "Times", "Courier"] | None = None


class SegmentEdit(BaseModel):
    key: str = Field(..., description="Segment key as returned by the segments endpoint (e.g. 'para_3')")
    translated_text: str = Field(..., description="New translated text for the segment")
    style: SegmentStyle | None = Field(
        default=None,
        description="PDF only. Replaces the segment's style overrides when sent; null or {} clears them.",
    )


class UpdateSegmentsRequest(BaseModel):
    segments: list[SegmentEdit] = Field(..., description="Segments to update")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    detail: str | None = Field(default=None, description="Additional error details")
