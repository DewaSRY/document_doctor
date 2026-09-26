import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_emotion_name,
    get_voice_name,
)
from ai_translation.infrastructure.rest.schemas import (
    TranslateRequest,
    TranslateResponse,
)
from ai_translation.infrastructure.database import (
    init_db,
    close_db,
    get_db_session,
)
from ai_translation.infrastructure.database.schemas import (
    TranslationRecordCreate,
    TranslationRecordResponse,
)
from ai_translation.infrastructure.database.repositories import TranslationRecordRepository


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle (startup and shutdown)."""
    await init_db()
    yield
    await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Translation Service",
        description="Translation service powered by Qwen",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.post("/v1/translate", response_model=TranslateResponse)
    async def translate(
        request: TranslateRequest,
        session: AsyncSession = Depends(get_db_session),
    ) -> TranslateResponse:
        try:
            params = TranslationParams(
                text=request.text,
                source_language=get_language_name(request.source_language),
                target_language=get_language_name(request.target_language),
                emotions_tags=[get_emotion_name(tag) for tag in (request.emotion_tags or [])],
                voice_tags=[get_voice_name(tag) for tag in (request.voice_tags or [])],
            )

            translated_text = get_translator().translate(translation_params=params)
            model_name = get_translator().model.name_or_path

            response = TranslateResponse(
                translated_text=translated_text,
                source_language=request.source_language,
                target_language=request.target_language,
                model=model_name,
            )

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

            return response
        except Exception as exc:
            await session.rollback()
            raise HTTPException(status_code=500, detail=str(exc))

    @app.get("/v1/translations/{record_id}", response_model=TranslationRecordResponse)
    async def get_translation(
        record_id: int,
        session: AsyncSession = Depends(get_db_session),
    ) -> TranslationRecordResponse:
        try:
            repo = TranslationRecordRepository(session)
            record = await repo.get_by_id(record_id)

            if record is None:
                raise HTTPException(status_code=404, detail="Translation record not found")

            return TranslationRecordResponse.model_validate(record)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


def main() -> None:
    load_dotenv()
    host = os.environ.get("REST_HOST", "0.0.0.0")
    port = int(os.environ.get("REST_PORT", "8000"))

    app = create_app()
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
