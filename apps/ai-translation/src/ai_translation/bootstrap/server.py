import os
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

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


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Translation Service",
        description="Translation service powered by Qwen",
        version="0.1.0",
    )

    @app.post("/v1/translate", response_model=TranslateResponse)
    async def translate(request: TranslateRequest) -> TranslateResponse:
        try:
            params = TranslationParams(
                text=request.text,
                source_language=get_language_name(request.source_language),
                target_language=get_language_name(request.target_language),
                emotions_tags=[get_emotion_name(tag) for tag in (request.emotion_tags or [])],
                voice_tags=[get_voice_name(tag) for tag in (request.voice_tags or [])],
            )

            translated_text = get_translator().translate(translation_params=params)

            return TranslateResponse(
                translated_text=translated_text,
                source_language=request.source_language,
                target_language=request.target_language,
                model=get_translator().model.name_or_path,
            )
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
