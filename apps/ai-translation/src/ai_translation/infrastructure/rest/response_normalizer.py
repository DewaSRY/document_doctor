from typing import Any, Optional
from ai_translation.infrastructure.rest.schemas import (
    SuccessResponse,
    ErrorResponseData,
    ErrorItem,
    PaginationMeta,
)


def normalize_success_response(
    data: Any,
    message: str = "Success",
    code: int = 200,
    pagination: Optional[dict] = None,
) -> dict:

    meta = None
    if pagination:
        meta = PaginationMeta(**pagination).model_dump()

    response = SuccessResponse(
        data=data,
        meta=meta,
        error=None,
        code=code,
        message=message,
    )
    return response.model_dump(exclude_none=True)


def normalize_error_response(
    message: str,
    code: int = 500,
    errors: Optional[list[dict]] = None,
) -> dict:
    error_items = None
    if errors:
        error_items = [ErrorItem(**err).model_dump() for err in errors]

    response = ErrorResponseData(
        data=[],
        meta=None,
        error=error_items,
        code=code,
        message=message,
    )
    return response.model_dump(exclude_none=True)
