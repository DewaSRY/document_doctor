import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Request, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.infrastructure.middleware import limiter

from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_emotion_name,
    get_voice_name,
)
from ai_translation.domain.document import PDFHandler, DOCXHandler
from ai_translation.infrastructure.rest.response_normalizer import normalize_success_response
from ai_translation.infrastructure.rest.exceptions import (
    FileTooLargeError,
    UnsupportedFileTypeError,
    NotFoundError,
    DocumentProcessingError,
)
from ai_translation.infrastructure.database import get_db_session
from ai_translation.infrastructure.database.repositories import (
    TranslatedDocumentRepository,
)
from ai_translation.infrastructure.database.schemas import TranslatedDocumentResponse
from ai_translation.infrastructure.database.models import TranslatedDocument

router = APIRouter(prefix="/v1", tags=["documents"])


@router.post("/translate-document")
@limiter.limit("20/minute")
async def translate_document(
    request: Request,
    file: UploadFile = File(...),
    source_language: str = "zh",
    target_language: str = "id",
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
        file_content = b""

        while True:
            chunk = await file.read(8192)
            if not chunk:
                break
            file_size += len(chunk)
            if file_size > max_size:
                raise FileTooLargeError(max_size_mb=5)
            file_content += chunk

        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in ["pdf", "docx"]:
            raise UnsupportedFileTypeError(
                file_type=file_ext,
                supported_types=["pdf", "docx"],
            )

        handler = PDFHandler() if file_ext == "pdf" else DOCXHandler()

        extracted_text = await handler.extract_text(file_content)

        emotion_tags_list = [tag.strip() for tag in (emotion_tags.split(",") if emotion_tags else [])]
        voice_tags_list = [tag.strip() for tag in (voice_tags.split(",") if voice_tags else [])]

        translations = {}
        for key, texts in extracted_text.items():
            for text in texts:
                if text:
                    params = TranslationParams(
                        text=text,
                        source_language=get_language_name(source_language),
                        target_language=get_language_name(target_language),
                        emotions_tags=[get_emotion_name(tag) for tag in emotion_tags_list],
                        voice_tags=[get_voice_name(tag) for tag in voice_tags_list],
                    )
                    translated = get_translator().translate(translation_params=params)
                    translations[key] = translated

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

        return FileResponse(
            content=document.translated_document,
            media_type=media_type,
            filename=filename,
        )
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
    except Exception as exc:
        raise DocumentProcessingError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )
