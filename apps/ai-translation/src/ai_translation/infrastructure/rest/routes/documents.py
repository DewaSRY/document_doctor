import asyncio
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Request, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.infrastructure.middleware import limiter

from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_emotion_name,
    get_voice_name,
)
from ai_translation.domain.document import DocumentHandler, PDFHandler, DOCXHandler
from ai_translation.infrastructure.rest.response_normalizer import normalize_success_response
from ai_translation.infrastructure.rest.schemas import SegmentEdit, UpdateSegmentsRequest
from ai_translation.infrastructure.rest.uploads import content_disposition
from ai_translation.infrastructure.rest.exceptions import (
    APIException,
    ValidationError,
    FileTooLargeError,
    UnsupportedFileTypeError,
    NotFoundError,
    DocumentProcessingError,
)
from ai_translation.infrastructure.database import get_db_session
from ai_translation.infrastructure.database.repositories import (
    TranslatedDocumentRepository,
    DocumentSegmentsRepository,
)
from ai_translation.infrastructure.database.schemas import TranslatedDocumentResponse
from ai_translation.infrastructure.database.models import TranslatedDocument, DocumentSegments

router = APIRouter(prefix="/v1", tags=["documents"])


def _get_handler(document_type: str) -> DocumentHandler:
    return PDFHandler() if document_type == "pdf" else DOCXHandler()


@router.post("/translate-document")
@limiter.limit("20/minute")
async def translate_document(
    request: Request,
    file: UploadFile = File(...),
    source_language: str = "id",
    target_language: str = "zh",
    emotion_tags: str | None = Query(None),
    voice_tags: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Translate a document (PDF or DOCX) from source language to target language.

    - **file**: PDF or DOCX document to translate (max 5MB)
    - **source_language**: Source language code (default: 'zh')
    - **target_language**: Target language code (default: 'id')
    - **emotion_tags**: Optional comma-separated emotion tags
    - **voice_tags**: Optional comma-separated voice tags
    """
    try:
        max_size = 5 * 1024 * 1024
        file_size = 0
        chunks: list[bytes] = []

        while True:
            chunk = await file.read(64 * 1024)
            if not chunk:
                break
            file_size += len(chunk)
            if file_size > max_size:
                raise FileTooLargeError(max_size_mb=5)
            chunks.append(chunk)
        file_content = b"".join(chunks)

        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in ["pdf", "docx"]:
            raise UnsupportedFileTypeError(
                file_type=file_ext,
                supported_types=["pdf", "docx"],
            )

        handler = _get_handler(file_ext)

        extracted_text = await handler.extract_text(file_content)

        emotion_tags_list = [tag.strip() for tag in (emotion_tags.split(",") if emotion_tags else [])]
        voice_tags_list = [tag.strip() for tag in (voice_tags.split(",") if voice_tags else [])]

        source_language_name = get_language_name(source_language)
        target_language_name = get_language_name(target_language)
        emotion_names = [get_emotion_name(tag) for tag in emotion_tags_list]
        voice_names = [get_voice_name(tag) for tag in voice_tags_list]

        # Translate each distinct sentence once, in batches, off the event loop.
        unique_sentences = list(
            dict.fromkeys(text for texts in extracted_text.values() for text in texts if text)
        )
        translated_sentences = await asyncio.to_thread(
            get_translator().translate_batch,
            [
                TranslationParams(
                    text=text,
                    source_language=source_language_name,
                    target_language=target_language_name,
                    emotions_tags=emotion_names,
                    voice_tags=voice_names,
                )
                for text in unique_sentences
            ],
        )
        sentence_translations = dict(zip(unique_sentences, translated_sentences))

        translations = {}
        segments = []
        for key, texts in extracted_text.items():
            translations[key] = " ".join(sentence_translations[text] for text in texts if text)
            segments.append(
                {
                    "key": key,
                    "source_text": " ".join(texts),
                    "translated_text": translations[key],
                }
            )

        translated_content = await handler.create_translated_document(
            file_content,
            translations,
            source_language,
            target_language,
        )

        document_id = str(uuid.uuid4())
        model_name = get_translator().model.name_or_path

        doc_record = TranslatedDocument(
            document_id=document_id,
            original_file_name=file.filename,
            original_file_size=file_size,
            document_type=file_ext,
            source_language=source_language,
            target_language=target_language,
            translated_document=translated_content,
            status="completed",
            emotion_tags=",".join(emotion_tags_list) if emotion_tags_list else None,
            voice_tags=",".join(voice_tags_list) if voice_tags_list else None,
            model_name=model_name,
        )
        session.add(doc_record)
        session.add(
            DocumentSegments(
                document_id=document_id,
                original_document=file_content,
                segments=segments,
            )
        )
        await session.commit()
        await session.refresh(doc_record)

        response_data = {
            "document_id": document_id,
            "file_name": file.filename,
            "file_size": file_size,
            "source_language": source_language,
            "target_language": target_language,
            "document_type": file_ext,
            "status": "completed",
            "model": model_name,
            "created_at": doc_record.created_at.isoformat(),
        }

        return normalize_success_response(
            data=response_data,
            message="Document translated successfully",
            code=200,
        )
    except APIException:
        await session.rollback()
        raise
    except Exception as exc:
        await session.rollback()
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


@router.get("/translated-document/{document_id}")
async def download_translated_document(
    document_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Download the translated document by document ID."""
    try:
        repo = TranslatedDocumentRepository(session)
        document = await repo.get_by_document_id(document_id)

        if not document:
            raise NotFoundError("Document", document_id)

        media_type = "application/pdf" if document.document_type == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"translated_{document.original_file_name}"

        return Response(
            content=document.translated_document,
            media_type=media_type,
            headers={"Content-Disposition": content_disposition(filename)},
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


@router.get("/translated-document/{document_id}/info")
async def get_document_info(
    document_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get metadata and information about a translated document."""
    try:
        repo = TranslatedDocumentRepository(session)
        document = await repo.get_by_document_id(document_id)

        if not document:
            raise NotFoundError("Document", document_id)

        return normalize_success_response(
            data=TranslatedDocumentResponse.model_validate(document).model_dump(),
            message="Document information retrieved successfully",
            code=200,
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


def _segments_response(document: TranslatedDocument, stored: DocumentSegments) -> dict:
    return {
        "document_id": document.document_id,
        "file_name": document.original_file_name,
        "document_type": document.document_type,
        "source_language": document.source_language,
        "target_language": document.target_language,
        "segments": stored.segments,
        "updated_at": stored.updated_at.isoformat(),
    }


async def _get_document_with_segments(
    session: AsyncSession, document_id: str
) -> tuple[TranslatedDocument, DocumentSegments]:
    document = await TranslatedDocumentRepository(session).get_by_document_id(document_id)
    stored = await DocumentSegmentsRepository(session).get_by_document_id(document_id)
    # Documents translated before segments were stored cannot be edited.
    if not document or not stored:
        raise NotFoundError("Document segments", document_id)
    return document, stored


@router.get("/translated-document/{document_id}/segments")
async def get_document_segments(
    document_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get the source and translated text of every segment, in document order."""
    try:
        document, stored = await _get_document_with_segments(session, document_id)
        return normalize_success_response(
            data=_segments_response(document, stored),
            message="Document segments retrieved successfully",
            code=200,
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


def _apply_edit(segment: dict, edit: SegmentEdit | None) -> dict:
    if edit is None:
        return segment
    updated = {**segment, "translated_text": edit.translated_text}
    # A style that is sent replaces the stored one; a style that is not sent is kept.
    if "style" in edit.model_fields_set:
        style = edit.style.model_dump(exclude_none=True) if edit.style else {}
        updated.pop("style", None)
        if style:
            updated["style"] = style
    # Runs belong to the text they format: new text without runs clears them.
    if "runs" in edit.model_fields_set or edit.translated_text != segment.get("translated_text"):
        runs = [run.model_dump(exclude_none=True) for run in edit.runs or []]
        updated.pop("runs", None)
        if runs:
            updated["runs"] = runs
    return updated


async def _get_pdf_original(session: AsyncSession, document_id: str) -> bytes:
    document, stored = await _get_document_with_segments(session, document_id)
    if document.document_type != "pdf":
        raise ValidationError(
            message="Page images are only available for PDF documents",
            details={"document_type": document.document_type},
        )
    return stored.original_document


@router.get("/translated-document/{document_id}/layout")
async def get_document_layout(
    document_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    How the document looks, for the editor. Style overrides are not applied.

    - PDF: the size of every page and, per segment, the area (in PDF points)
      and style its translation is written with.
    - DOCX: per section the page size, margins and headers and footers, and the
      paragraphs, tables and images in document order, with resolved formatting.
      Translatable text is referenced by segment key.
    """
    try:
        document, stored = await _get_document_with_segments(session, document_id)
        if document.document_type == "pdf":
            pages = await asyncio.to_thread(PDFHandler().page_layouts, stored.original_document)
            data = {"document_id": document_id, "format": "pdf", "pages": pages}
        else:
            layout = await asyncio.to_thread(DOCXHandler().document_layout, stored.original_document)
            data = {"document_id": document_id, **layout}
        return normalize_success_response(
            data=data,
            message="Document layout retrieved successfully",
            code=200,
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


@router.get("/translated-document/{document_id}/media/{name:path}")
async def get_document_media(
    document_id: str,
    name: str,
    session: AsyncSession = Depends(get_db_session),
):
    """DOCX only: an image of the original upload, by the part name the layout returns."""
    try:
        document, stored = await _get_document_with_segments(session, document_id)
        if document.document_type != "docx":
            raise NotFoundError("Media", name)
        found = await asyncio.to_thread(DOCXHandler.media, stored.original_document, name)
        if found is None:
            raise NotFoundError("Media", name)
        blob, content_type = found
        return Response(
            content=blob,
            media_type=content_type,
            headers={"Cache-Control": "private, max-age=86400, immutable"},
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


@router.get("/translated-document/{document_id}/pages/{page_num}/image")
async def get_page_image(
    document_id: str,
    page_num: int,
    scale: float = Query(2.0, ge=0.5, le=4.0, description="Pixels per PDF point"),
    original: bool = Query(False, description="Keep the source text instead of removing it"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    PDF only: a PNG of one page of the original upload. By default the translatable
    text is removed, so the editor can place the translations over it.
    """
    try:
        pdf = await _get_pdf_original(session, document_id)
        try:
            png = await asyncio.to_thread(PDFHandler().render_page, pdf, page_num, scale, original)
        except IndexError:
            raise NotFoundError("Page", str(page_num))
        # The original upload never changes, so neither does the image.
        return Response(
            content=png,
            media_type="image/png",
            headers={"Cache-Control": "private, max-age=86400, immutable"},
        )
    except APIException:
        raise
    except Exception as exc:
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


@router.put("/translated-document/{document_id}/segments")
@limiter.limit("30/minute")
async def update_document_segments(
    request: Request,
    document_id: str,
    body: UpdateSegmentsRequest,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Replace the translation of the given segments and rebuild the translated
    document from the original upload, so its layout is kept.

    Segments that are not sent keep their current translation. A segment sent
    with empty text keeps the original (untranslated) text in the document.
    """
    try:
        document, stored = await _get_document_with_segments(session, document_id)

        edits = {segment.key: segment for segment in body.segments}
        known_keys = {segment["key"] for segment in stored.segments}
        unknown_keys = sorted(edits.keys() - known_keys)
        if unknown_keys:
            raise ValidationError(
                message=f"Unknown segment keys: {', '.join(unknown_keys)}",
                details={"unknown_keys": unknown_keys},
            )

        # Reassign rather than mutate so SQLAlchemy sees the JSON change.
        stored.segments = [_apply_edit(segment, edits.get(segment["key"])) for segment in stored.segments]

        document.translated_document = await _get_handler(document.document_type).create_translated_document(
            stored.original_document,
            {segment["key"]: segment["translated_text"] for segment in stored.segments},
            document.source_language,
            document.target_language,
            styles={segment["key"]: segment["style"] for segment in stored.segments if segment.get("style")},
            runs={segment["key"]: segment["runs"] for segment in stored.segments if segment.get("runs")},
        )
        await session.commit()
        await session.refresh(stored)

        return normalize_success_response(
            data=_segments_response(document, stored),
            message="Document segments updated successfully",
            code=200,
        )
    except APIException:
        await session.rollback()
        raise
    except Exception as exc:
        await session.rollback()
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )
