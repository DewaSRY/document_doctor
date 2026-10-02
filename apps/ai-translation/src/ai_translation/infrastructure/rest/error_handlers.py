import logging
import uuid
from typing import cast

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.types import ExceptionHandler

from ai_translation.infrastructure.rest.exceptions import APIException
from ai_translation.infrastructure.rest.response_normalizer import (
    normalize_error_response,
)

logger = logging.getLogger(__name__)


def get_request_id(request: Request) -> str:
    """Get or generate request ID"""
    request_id = request.headers.get("x-request-id")
    if not request_id:
        request_id = str(uuid.uuid4())
    return request_id


async def api_exception_handler(request: Request, exc: APIException) -> JSONResponse:
    """Handle custom API exceptions"""
    request_id = get_request_id(request)

    logger.warning(
        f"API Exception: {exc.error_code.value}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "status_code": exc.status_code,
        },
    )

    response_content = normalize_error_response(
        message=exc.message,
        code=exc.status_code,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=response_content,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors"""
    request_id = get_request_id(request)

    # Extract field-level errors
    errors = []
    for error in exc.errors():
        field_path = ".".join(str(x) for x in error["loc"][1:])  # Skip 'body' prefix
        if field_path:
            errors.append({"field": field_path, "message": error["msg"]})

    logger.warning(
        "Validation error",
        extra={
            "request_id": request_id,
            "method": request.method,
            "error_count": len(errors),
        },
    )

    response_content = normalize_error_response(
        message="Request validation failed",
        code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        errors=errors if errors else None,
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response_content,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions"""
    request_id = get_request_id(request)

    logger.error(
        f"Unexpected error: {type(exc).__name__}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "exception_type": type(exc).__name__,
        },
    )

    response_content = normalize_error_response(
        message="Internal server error",
        code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_content,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers with the FastAPI app"""
    app.add_exception_handler(APIException, cast(ExceptionHandler, api_exception_handler))
    app.add_exception_handler(
        RequestValidationError,
        cast(ExceptionHandler, validation_exception_handler),
    )
    app.add_exception_handler(Exception, generic_exception_handler)
