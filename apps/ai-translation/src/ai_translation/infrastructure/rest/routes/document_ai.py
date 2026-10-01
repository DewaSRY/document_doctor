import asyncio

from fastapi import APIRouter, File, Form, Request, UploadFile

from ai_translation.domain.document_ai import (
    SUMMARY_LENGTHS,
    extract,
    extract_plain_text,
    summarize,
)
from ai_translation.domain.translation import get_translator
from ai_translation.domain.translation.utils import LANGUAGES
from ai_translation.infrastructure.middleware import limiter
from ai_translation.infrastructure.rest.exceptions import (
    APIException,
    DocumentProcessingError,
    LanguageNotSupportedError,
    ValidationError,
)
from ai_translation.infrastructure.rest.response_normalizer import (
    normalize_success_response,
)
from ai_translation.infrastructure.rest.uploads import read_upload

router = APIRouter(prefix="/v1", tags=["document-ai"])

DOCUMENT_TYPES = ["pdf", "docx"]
MAX_DOCUMENT_MB = 5


async def _read_document_text(file: UploadFile) -> tuple[list[str], str]:
    content, document_type = await read_upload(
        file, max_size_mb=MAX_DOCUMENT_MB, allowed_extensions=DOCUMENT_TYPES
    )
    try:
        paragraphs = await extract_plain_text(content, document_type)
    except Exception as exc:
        raise DocumentProcessingError(
            message="The document could not be read. It may be damaged.",
            details={"exception_type": type(exc).__name__},
        )
    if not paragraphs:
        raise ValidationError(
            message="No text was found in the document. Scanned documents are not supported yet."
        )
    return paragraphs, document_type


@router.post("/summarize-document")
@limiter.limit("100/minute")
async def summarize_document(
    request: Request,
    file: UploadFile = File(...),
    length: str = Form("medium"),
    language: str | None = Form(None),
) -> dict:
    """
    Summarize a PDF or DOCX document (max 5MB).

    - **length**: 'short', 'medium' or 'detailed'
    - **language**: language code of the summary; omit to use the document's language
    """
    try:
        if length not in SUMMARY_LENGTHS:
            raise ValidationError(
                message=f"Length must be one of: {', '.join(SUMMARY_LENGTHS)}",
                details={"length": length},
            )
        if language and language not in LANGUAGES:
            raise LanguageNotSupportedError(language, list(LANGUAGES))

        paragraphs, document_type = await _read_document_text(file)
        summary = await asyncio.to_thread(
            summarize, paragraphs, length, LANGUAGES.get(language) if language else None
        )

        return normalize_success_response(
            data={
                "file_name": file.filename,
                "document_type": document_type,
                "length": length,
                "language": language or None,
                "overview": summary.overview,
                "key_points": summary.key_points,
                "truncated": summary.truncated,
                "model": get_translator().model.name_or_path,
            },
            message="Document summarized successfully",
            code=200,
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(message=str(exc), details={"exception_type": type(exc).__name__})


@router.post("/extract-document")
@limiter.limit("100/minute")
async def extract_document(
    request: Request,
    file: UploadFile = File(...),
) -> dict:
    """
    Extract people, organizations, dates, amounts, locations, e-mail
    addresses, phone numbers and links from a PDF or DOCX document (max 5MB).
    """
    try:
        paragraphs, document_type = await _read_document_text(file)
        extraction = await asyncio.to_thread(extract, paragraphs)

        return normalize_success_response(
            data={
                "file_name": file.filename,
                "document_type": document_type,
                "fields": extraction.fields,
                "truncated": extraction.truncated,
                "model": get_translator().model.name_or_path,
            },
            message="Document information extracted successfully",
            code=200,
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(message=str(exc), details={"exception_type": type(exc).__name__})
