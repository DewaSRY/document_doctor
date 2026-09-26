import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI

from ai_translation.infrastructure.database import (
    init_db,
    close_db,
)
from ai_translation.infrastructure.rest.routes import (
    health_router,
    translation_router,
    documents_router,
)
from ai_translation.infrastructure.rest.error_handlers import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
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

    app.include_router(health_router)
    app.include_router(translation_router)
    app.include_router(documents_router)

    register_exception_handlers(app)

    return app


def main() -> None:
    load_dotenv()
    host = os.environ.get("REST_HOST", "0.0.0.0")
    port = int(os.environ.get("REST_PORT", "8000"))

    app = create_app()
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
