import os
import uuid
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_emotion_name,
    get_voice_name,
)
from ai_translation.domain.document import PDFHandler, DOCXHandler
from ai_translation.infrastructure.rest.schemas import (
    TranslateRequest,
    TranslateResponse,
    TranslateDocumentResponse,
)
from ai_translation.infrastructure.database import (
    init_db,
    close_db,
    get_db_session,
)
from ai_translation.infrastructure.database.schemas import (
    TranslationRecordCreate,
    TranslationRecordResponse,
    TranslatedDocumentCreate,
    TranslatedDocumentResponse,
)
from ai_translation.infrastructure.database.repositories import (
    TranslationRecordRepository,
    TranslatedDocumentRepository,
)


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

    @app.post("/v1/translate-document", response_model=TranslateDocumentResponse)
    async def translate_document(
        file: UploadFile = File(...),
        source_language: str = "zh",
        target_language: str = "id",
        emotion_tags: str | None = None,
        voice_tags: str | None = None,
        session: AsyncSession = Depends(get_db_session),
    ) -> TranslateDocumentResponse:
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
                    raise HTTPException(
                        status_code=413,
                        detail=f"File size exceeds 5MB limit",
                    )
                file_content += chunk

            file_ext = file.filename.split(".")[-1].lower()
            if file_ext not in ["pdf", "docx"]:
                raise HTTPException(
                    status_code=400,
                    detail="Only PDF and DOCX files are supported",
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

            from ai_translation.infrastructure.database.models import TranslatedDocument

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

            return TranslateDocumentResponse(
                document_id=document_id,
                file_name=file.filename,
                file_size=file_size,
                source_language=source_language,
                target_language=target_language,
                document_type=file_ext,
                status="completed",
                model=model_name,
                created_at=doc_record.created_at.isoformat(),
            )
        except HTTPException:
            await session.rollback()
            raise
        except Exception as exc:
            await session.rollback()
            raise HTTPException(status_code=500, detail=str(exc))

    @app.get("/v1/translated-document/{document_id}")
    async def download_translated_document(
        document_id: str,
        session: AsyncSession = Depends(get_db_session),
    ):
        try:
            repo = TranslatedDocumentRepository(session)
            document = await repo.get_by_document_id(document_id)

            if not document:
                raise HTTPException(
                    status_code=404,
                    detail="Document not found",
                )

            media_type = "application/pdf" if document.document_type == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = f"translated_{document.original_file_name}"

            return FileResponse(
                content=document.translated_document,
                media_type=media_type,
                filename=filename,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    @app.get("/v1/translated-document/{document_id}/info", response_model=TranslatedDocumentResponse)
    async def get_document_info(
        document_id: str,
        session: AsyncSession = Depends(get_db_session),
    ) -> TranslatedDocumentResponse:
        try:
            repo = TranslatedDocumentRepository(session)
            document = await repo.get_by_document_id(document_id)

            if not document:
                raise HTTPException(
                    status_code=404,
                    detail="Document not found",
                )

            return TranslatedDocumentResponse.model_validate(document)
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
