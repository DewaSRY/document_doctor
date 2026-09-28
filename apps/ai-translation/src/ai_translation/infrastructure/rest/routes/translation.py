import asyncio
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_emotion_name,
    get_voice_name,
)
from ai_translation.infrastructure.rest.schemas import TranslateRequest
from ai_translation.infrastructure.rest.response_normalizer import normalize_success_response
from ai_translation.infrastructure.rest.exceptions import (
    TranslationError,
    NotFoundError,
)
from ai_translation.infrastructure.database import get_db_session
from ai_translation.infrastructure.database.schemas import TranslationRecordCreate
from ai_translation.infrastructure.database.repositories import TranslationRecordRepository
from ai_translation.infrastructure.database.schemas import TranslationRecordResponse
from ai_translation.infrastructure.middleware import limiter

router = APIRouter(prefix="/v1", tags=["translation"])


@router.post("/translate")
@limiter.limit("30/minute")
async def translate(
    request: TranslateRequest,
    http_request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Translate text from source language to target language.

    - **text**: Text to be translated
    - **source_language**: Source language code (e.g., 'zh', 'id')
    - **target_language**: Target language code
    - **emotion_tags**: Optional emotion tags (e.g., 'formal', 'casual')
    - **voice_tags**: Optional voice tags (e.g., 'professional', 'friendly')
    """
    try:
        params = TranslationParams(
            text=request.text,
            source_language=get_language_name(request.source_language),
            target_language=get_language_name(request.target_language),
            emotions_tags=[get_emotion_name(tag) for tag in (request.emotion_tags or [])],
            voice_tags=[get_voice_name(tag) for tag in (request.voice_tags or [])],
        )

        translated_text = await asyncio.to_thread(get_translator().translate, params)
        model_name = get_translator().model.name_or_path

        response_data = {
            "translated_text": translated_text,
            "source_language": request.source_language,
            "target_language": request.target_language,
            "model": model_name,
        }

        record_create = TranslationRecordCreate(
            source_text=request.text,
            translated_text=translated_text,
            source_language=request.source_language,
            target_language=request.target_language,
            emotion_tags=",".join(request.emotion_tags or []),
            voice_tags=",".join(request.voice_tags or []),
            model_name=model_name,
        )

        repo = TranslationRecordRepository(session)
        await repo.create(record_create)
        await session.commit()

        return normalize_success_response(
            data=response_data,
            message="Text translated successfully",
            code=200,
        )
    except Exception as exc:
        await session.rollback()
        raise TranslationError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )


@router.get("/translations/{record_id}")
async def get_translation(
    record_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get a specific translation record by ID."""
    try:
        repo = TranslationRecordRepository(session)
        record = await repo.get_by_id(record_id)

        if record is None:
            raise NotFoundError("Translation record", record_id)

        return normalize_success_response(
            data=TranslationRecordResponse.model_validate(record).model_dump(),
            message="Translation record retrieved successfully",
            code=200,
        )
    except Exception as exc:
        raise TranslationError(
            message=str(exc),
            details={"exception_type": type(exc).__name__},
        )
