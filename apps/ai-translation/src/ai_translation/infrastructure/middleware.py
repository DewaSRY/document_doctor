import logging
import time
from typing import Callable
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from ai_translation.config import settings


logger = logging.getLogger(__name__)


def setup_cors(app: FastAPI, dev_mode: bool = False) -> None:
    if dev_mode:
        origins = ["*"]
        allow_headers = ["*"]
        allow_credentials = False
    else:
        origins = settings.get_cors_origins_list()
        allow_headers = settings.get_cors_allow_headers_list()
        allow_credentials = True

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=allow_headers,
    )
    logger.info(f"CORS configured with origins: {origins}")
    logger.info(f"CORS allowed headers: {allow_headers}")


limiter = Limiter(key_func=get_remote_address)


def setup_rate_limiter(app: FastAPI) -> Limiter:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("Rate limiter configured")
    return limiter


async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded exceptions."""
    logger.warning(f"Rate limit exceeded for {request.client.host}")
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests",
            "retry_after": exc.detail,
        },
    )


def setup_logging(dev_mode: bool = False) -> None:
    """Setup logging configuration for the application.

    Args:
        dev_mode: If True, sets logging to DEBUG level
    """
    log_level = logging.DEBUG if dev_mode else logging.INFO

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    logger.info(f"Logging configured with level: {logging.getLevelName(log_level)}")


def setup_request_logging_middleware(app: FastAPI) -> None:
    """Setup middleware for logging HTTP requests and responses.

    Args:
        app: FastAPI application instance
    """

    @app.middleware("http")
    async def log_requests(request: Request, call_next: Callable):
        start_time = time.time()

        logger.debug(f"→ {request.method} {request.url.path}")

        try:
            response = await call_next(request)
            process_time = time.time() - start_time

            logger.info(
                f"← {request.method} {request.url.path} "
                f"{response.status_code} ({process_time:.3f}s)"
            )

            response.headers["X-Process-Time"] = str(process_time)
            return response

        except Exception as exc:
            process_time = time.time() - start_time
            logger.error(
                f"✗ {request.method} {request.url.path} "
                f"Error: {str(exc)} ({process_time:.3f}s)",
                exc_info=True,
            )
            raise
