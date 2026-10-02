"""
Main entry point for the AI Translation Service application.

- Author: Dewasurya Ariesta
There are improvements needed for production.
"""

import asyncio
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI

from ai_translation.config import settings
from ai_translation.domain.translation import get_translator
from ai_translation.infrastructure.database import (
    close_db,
    init_db,
)
from ai_translation.infrastructure.middleware import (
    setup_cors,
    setup_logging,
    setup_portal_api_auth,
    setup_rate_limiter,
    setup_request_logging_middleware,
)
from ai_translation.infrastructure.rest.error_handlers import (
    register_exception_handlers,
)
from ai_translation.infrastructure.rest.routes import (
    constant_router,
    document_ai_router,
    documents_router,
    file_tools_router,
    health_router,
    image_tools_router,
    translation_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.dev_mode and not settings.portal_api_token:
        raise RuntimeError("PORTAL_API_TOKEN is required when DEV_MODE is false")

    await init_db()
    # Load the model at startup so the first request does not pay for it.
    await asyncio.to_thread(get_translator)
    try:
        yield
    finally:
        await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Translation Service",
        description="Document, file and image tools; AI features powered by Qwen",
        version="0.1.0",
        lifespan=lifespan,
        debug=settings.debug,
        docs_url="/docs" if settings.dev_mode else None,
        redoc_url="/redoc" if settings.dev_mode else None,
        openapi_url="/openapi.json" if settings.dev_mode else None,
    )

    # Setup middleware
    setup_cors(app, dev_mode=settings.dev_mode)
    setup_portal_api_auth(app)
    setup_rate_limiter(app)
    setup_request_logging_middleware(app)

    # Include routers
    app.include_router(health_router, prefix="/api")
    app.include_router(translation_router, prefix="/api")
    app.include_router(documents_router, prefix="/api")
    app.include_router(document_ai_router, prefix="/api")
    app.include_router(file_tools_router, prefix="/api")
    app.include_router(image_tools_router, prefix="/api")
    app.include_router(constant_router, prefix="/api")

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
        timeout_keep_alive=5,
        timeout_graceful_shutdown=30,
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
