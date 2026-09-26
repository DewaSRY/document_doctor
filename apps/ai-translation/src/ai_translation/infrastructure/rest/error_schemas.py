from typing import Any
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Normalized error response"""

    error_code: str = Field(..., description="Error code identifier")
    message: str = Field(..., description="Human-readable error message")
    status_code: int = Field(..., description="HTTP status code")
    timestamp: str = Field(..., description="ISO 8601 timestamp when error occurred")
    path: str | None = Field(default=None, description="Request path that caused the error")
    method: str | None = Field(default=None, description="HTTP method of the request")
    details: dict[str, Any] | None = Field(default=None, description="Additional error context")
    request_id: str | None = Field(default=None, description="Request ID for tracking")


class ValidationErrorDetail(ErrorDetail):
    """Validation error response with field-level details"""

    fields: dict[str, list[str]] | None = Field(default=None, description="Field-level validation errors")
