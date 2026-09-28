from enum import Enum
from typing import Any


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE"
    NOT_FOUND = "NOT_FOUND"
    DATABASE_ERROR = "DATABASE_ERROR"
    TRANSLATION_ERROR = "TRANSLATION_ERROR"
    DOCUMENT_PROCESSING_ERROR = "DOCUMENT_PROCESSING_ERROR"
    LANGUAGE_NOT_SUPPORTED = "LANGUAGE_NOT_SUPPORTED"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"


class APIException(Exception):
    """Base exception for API errors"""

    def __init__(
        self,
        message: str,
        error_code: ErrorCode,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(APIException):
    """Raised when request validation fails"""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
            details=details,
        )


class FileError(APIException):
    """Base exception for file-related errors"""

    pass


class FileTooLargeError(FileError):
    """Raised when uploaded file exceeds size limit"""

    def __init__(self, max_size_mb: int, details: dict[str, Any] | None = None):
        super().__init__(
            message=f"File size exceeds {max_size_mb}MB limit",
            error_code=ErrorCode.FILE_TOO_LARGE,
            status_code=413,
            details=details,
        )


class UnsupportedFileTypeError(FileError):
    """Raised when file type is not supported"""

    def __init__(self, file_type: str, supported_types: list[str], details: dict[str, Any] | None = None):
        super().__init__(
            message=f"File type '{file_type}' is not supported. Supported types: {', '.join(supported_types)}",
            error_code=ErrorCode.UNSUPPORTED_FILE_TYPE,
            status_code=400,
            details=details or {"file_type": file_type, "supported_types": supported_types},
        )


class NotFoundError(APIException):
    """Raised when resource is not found"""

    def __init__(self, resource: str, identifier: str | int, details: dict[str, Any] | None = None):
        super().__init__(
            message=f"{resource} with id '{identifier}' not found",
            error_code=ErrorCode.NOT_FOUND,
            status_code=404,
            details=details or {"resource": resource, "identifier": str(identifier)},
        )


class DatabaseError(APIException):
    """Raised when database operations fail"""

    def __init__(self, message: str = "Database operation failed", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code=ErrorCode.DATABASE_ERROR,
            status_code=500,
            details=details,
        )


class TranslationError(APIException):
    """Raised when translation fails"""

    def __init__(self, message: str = "Translation failed", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code=ErrorCode.TRANSLATION_ERROR,
            status_code=500,
            details=details,
        )


class DocumentProcessingError(APIException):
    """Raised when document processing fails"""

    def __init__(self, message: str = "Document processing failed", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code=ErrorCode.DOCUMENT_PROCESSING_ERROR,
            status_code=422,
            details=details,
        )


class LanguageNotSupportedError(APIException):
    """Raised when language is not supported"""

    def __init__(self, language: str, supported_languages: list[str], details: dict[str, Any] | None = None):
        super().__init__(
            message=f"Language '{language}' is not supported. Supported languages: {', '.join(supported_languages)}",
            error_code=ErrorCode.LANGUAGE_NOT_SUPPORTED,
            status_code=400,
            details=details or {"language": language, "supported_languages": supported_languages},
        )


class UnauthorizedError(APIException):
    """Raised when authentication fails"""

    def __init__(self, message: str = "Unauthorized", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code=ErrorCode.UNAUTHORIZED,
            status_code=401,
            details=details,
        )


class ForbiddenError(APIException):
    """Raised when authorization fails"""

    def __init__(self, message: str = "Forbidden", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code=ErrorCode.FORBIDDEN,
            status_code=403,
            details=details,
        )
