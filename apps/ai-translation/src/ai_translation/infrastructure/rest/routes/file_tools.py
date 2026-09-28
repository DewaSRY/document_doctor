import asyncio

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import Response

from ai_translation.domain.file_tools import (
    PdfToolError,
    docx_to_pdf,
    merge_pdfs,
    page_count,
    pdf_to_docx,
    split_pdf,
)
from ai_translation.infrastructure.middleware import limiter
from ai_translation.infrastructure.rest.exceptions import (
    APIException,
    DocumentProcessingError,
    FileTooLargeError,
    ValidationError,
)
from ai_translation.infrastructure.rest.response_normalizer import (
    normalize_success_response,
)
from ai_translation.infrastructure.rest.uploads import (
    file_response,
    file_stem,
    read_upload,
)

router = APIRouter(prefix="/v1", tags=["file-tools"])

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "zip": "application/zip",
}
MAX_DOCUMENT_MB = 10
MAX_MERGE_FILES = 20
MAX_MERGE_TOTAL_MB = 50


def _processing_error(exc: Exception) -> APIException:
    if isinstance(exc, APIException):
        return exc
    if isinstance(exc, PdfToolError):
        return ValidationError(message=str(exc))
    return DocumentProcessingError(message=str(exc), details={"exception_type": type(exc).__name__})


@router.post("/convert-document")
@limiter.limit("20/minute")
async def convert_document(request: Request, file: UploadFile = File(...)) -> Response:
    """Convert a PDF into an editable DOCX, or a DOCX into a PDF (max 10MB)."""
    try:
        content, source_type = await read_upload(
            file, max_size_mb=MAX_DOCUMENT_MB, allowed_extensions=["pdf", "docx"]
        )
        if source_type == "pdf":
            page_count(content, file.filename or "document.pdf")
            output, target_type = await asyncio.to_thread(pdf_to_docx, content), "docx"
        else:
            output, target_type = await asyncio.to_thread(docx_to_pdf, content), "pdf"

        return file_response(
            output,
            media_type=MEDIA_TYPES[target_type],
            filename=f"{file_stem(file.filename)}.{target_type}",
        )
    except Exception as exc:
        raise _processing_error(exc)


@router.post("/pdf/info")
async def pdf_info(file: UploadFile = File(...)) -> dict:
    """Return the page count of a PDF, used to plan a split."""
    try:
        content, _ = await read_upload(file, max_size_mb=MAX_DOCUMENT_MB, allowed_extensions=["pdf"])
        return normalize_success_response(
            data={"file_name": file.filename, "page_count": page_count(content, file.filename or "")},
            message="PDF information retrieved successfully",
            code=200,
        )
    except Exception as exc:
        raise _processing_error(exc)


@router.post("/pdf/merge")
@limiter.limit("20/minute")
async def merge_pdf(request: Request, files: list[UploadFile] = File(...)) -> Response:
    """Merge 2 to 20 PDFs, in the order they are sent, into one PDF."""
    try:
        if not 2 <= len(files) <= MAX_MERGE_FILES:
            raise ValidationError(message=f"Choose between 2 and {MAX_MERGE_FILES} PDF files to merge")

        documents: list[tuple[str, bytes]] = []
        total = 0
        for file in files:
            content, _ = await read_upload(file, max_size_mb=MAX_DOCUMENT_MB, allowed_extensions=["pdf"])
            total += len(content)
            if total > MAX_MERGE_TOTAL_MB * 1024 * 1024:
                raise FileTooLargeError(max_size_mb=MAX_MERGE_TOTAL_MB)
            documents.append((file.filename or "document.pdf", content))

        output = await asyncio.to_thread(merge_pdfs, documents)
        return file_response(output, media_type=MEDIA_TYPES["pdf"], filename="merged.pdf")
    except Exception as exc:
        raise _processing_error(exc)


@router.post("/pdf/split")
@limiter.limit("20/minute")
async def split_pdf_document(
    request: Request,
    file: UploadFile = File(...),
    ranges: str | None = Form(None),
    single_file: bool = Form(False),
) -> Response:
    """
    Split a PDF (max 10MB).

    - **ranges**: page ranges such as '1-3, 5'; omit to split into single pages
    - **single_file**: put the selected pages into one PDF instead of one PDF per range

    Returns a PDF when one file is produced, otherwise a ZIP of PDFs.
    """
    try:
        content, _ = await read_upload(file, max_size_mb=MAX_DOCUMENT_MB, allowed_extensions=["pdf"])
        name = file.filename or "document.pdf"
        output, output_type = await asyncio.to_thread(split_pdf, content, name, ranges, single_file)

        suffix = "pages" if output_type == "zip" else "selected"
        return file_response(
            output,
            media_type=MEDIA_TYPES[output_type],
            filename=f"{file_stem(name)}_{suffix}.{output_type}",
        )
    except Exception as exc:
        raise _processing_error(exc)
