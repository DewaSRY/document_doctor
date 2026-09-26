import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI

from ai_translation.config import settings
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
from ai_translation.infrastructure.middleware import (
    setup_cors,
    setup_rate_limiter,
    setup_logging,
    setup_request_logging_middleware,
)


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
        debug=settings.debug,
    )

    # Setup middleware
    setup_cors(app, dev_mode=settings.dev_mode)
    setup_rate_limiter(app)
    setup_request_logging_middleware(app)

    # Include routers
    app.include_router(health_router)
    app.include_router(translation_router)
    app.include_router(documents_router)

    # Register exception handlers
    register_exception_handlers(app)

    return app


app = create_app()


def main() -> None:
    load_dotenv()

    # Setup logging
    setup_logging(dev_mode=settings.dev_mode)

    uvicorn.run(
        app,
        host=settings.rest_host,
        port=settings.rest_port,
        log_level="debug" if settings.dev_mode else "info",
    )


if __name__ == "__main__":
    main()
