from typing import Annotated, Any, Literal
from pydantic import BaseModel, Field, model_validator


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
    """
    Overrides of a segment's style; unset fields keep the document's value.
    Text fields apply to the whole segment; paragraph fields (DOCX only) to its paragraph.
    """

    bold: bool | None = None
    italic: bool | None = None
    font_size: float | None = Field(default=None, ge=4, le=96, description="Font size in points")
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    align: Literal["left", "center", "right", "justify"] | None = None
    family: str | None = Field(
        default=None,
        max_length=64,
        pattern=r"^[\w .\-]+$",
        description="PDF: Helvetica, Times or Courier (other fonts map to the closest). DOCX: any font name.",
    )
    heading: Literal["normal", "title", "subtitle", "h1", "h2", "h3", "h4", "h5", "h6"] | None = Field(
        default=None, description="DOCX only: the paragraph style."
    )
    line_spacing: float | None = Field(default=None, ge=0.5, le=5, description="DOCX only: a multiple of single spacing")
    space_before: float | None = Field(default=None, ge=0, le=400, description="DOCX only: in points")
    space_after: float | None = Field(default=None, ge=0, le=400, description="DOCX only: in points")
    indent_left: float | None = Field(default=None, ge=-200, le=800, description="DOCX only: in points")


class RunStyle(BaseModel):
    """Formatting of a range of text; unset fields keep the segment's formatting."""

    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    strike: bool | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    highlight: str | None = Field(
        default=None, pattern=r"^(#[0-9a-fA-F]{6}|transparent)$", description="'transparent' removes a highlight"
    )


class SegmentRun(BaseModel):
    text: str
    style: RunStyle | None = None


class SegmentEdit(BaseModel):
    key: str = Field(..., description="Segment key as returned by the segments endpoint (e.g. 'para_3')")
    translated_text: str = Field(..., description="New translated text for the segment")
    style: SegmentStyle | None = Field(
        default=None,
        description="Replaces the segment's style overrides when sent; null or {} clears them.",
    )
    runs: list[SegmentRun] | None = Field(
        default=None,
        description="Formatting of ranges of the text, whose texts join to translated_text. "
        "Replaces the stored runs when sent; null or [] clears them (the text takes the segment's formatting).",
    )

    @model_validator(mode="after")
    def _runs_match_text(self) -> "SegmentEdit":
        if self.runs and "".join(run.text for run in self.runs) != self.translated_text:
            raise ValueError("The texts of runs must join to translated_text")
        return self


_InsertedTextKind = Literal[
    "normal", "title", "subtitle", "h1", "h2", "h3", "h4", "h5", "h6",
    "bullet", "numbered", "todo", "quote", "code",
]


class _InsertedBase(BaseModel):
    after: int = Field(
        ...,
        ge=-1,
        description="Index of the element of the original body (the layout's body_index) "
        "the block follows; -1 for the start of the document.",
    )


class InsertedParagraph(_InsertedBase):
    type: Literal["paragraph"]
    kind: _InsertedTextKind = "normal"
    runs: list[SegmentRun] = Field(default_factory=list, max_length=500)
    align: Literal["left", "center", "right", "justify"] | None = None
    level: int = Field(default=0, ge=0, le=4, description="Nesting of a list item")
    checked: bool = False


class InsertedTableCell(BaseModel):
    paragraphs: list[list[SegmentRun]] = Field(default_factory=lambda: [[]], min_length=1, max_length=50)


class InsertedTableRow(BaseModel):
    cells: list[InsertedTableCell] = Field(..., min_length=1, max_length=30)


class InsertedTable(_InsertedBase):
    type: Literal["table"]
    header_row: bool = False
    rows: list[InsertedTableRow] = Field(..., min_length=1, max_length=200)


class InsertedImage(_InsertedBase):
    type: Literal["image"]
    src: str = Field(..., pattern=r"^upload/[0-9a-f]{32}\.(png|jpeg|gif)$", description="A name from the media upload")
    width: float = Field(..., gt=0, le=2000, description="In points")
    height: float = Field(..., gt=0, le=3000, description="In points")
    align: Literal["left", "center", "right"] = "center"
    alt: str = Field(default="", max_length=500)


class InsertedDivider(_InsertedBase):
    type: Literal["divider"]


class InsertedPageBreak(_InsertedBase):
    type: Literal["page_break"]


InsertedBlock = Annotated[
    InsertedParagraph | InsertedTable | InsertedImage | InsertedDivider | InsertedPageBreak,
    Field(discriminator="type"),
]


class UpdateSegmentsRequest(BaseModel):
    segments: list[SegmentEdit] = Field(..., description="Segments to update")
    insertions: list[InsertedBlock] | None = Field(
        default=None,
        max_length=2000,
        description="DOCX only: blocks added to the document, in order. Replaces the stored ones when sent.",
    )


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    detail: str | None = Field(default=None, description="Additional error details")
