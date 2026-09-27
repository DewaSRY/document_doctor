from urllib.parse import quote

from fastapi import UploadFile
from fastapi.responses import Response

from ai_translation.infrastructure.rest.exceptions import (
    FileTooLargeError,
    UnsupportedFileTypeError,
    ValidationError,
)

MB = 1024 * 1024


def file_extension(filename: str | None) -> str:
    return (filename or "").rsplit(".", 1)[-1].lower() if "." in (filename or "") else ""


async def read_upload(
    file: UploadFile,
    *,
    max_size_mb: int,
    allowed_extensions: list[str],
) -> tuple[bytes, str]:
    """Read an upload, enforcing its type and size. Returns (content, extension)."""
    extension = file_extension(file.filename)
    if extension == "jpg" and "jpeg" in allowed_extensions:
        extension = "jpeg"
    if extension not in allowed_extensions:
        raise UnsupportedFileTypeError(file_type=extension or "unknown", supported_types=allowed_extensions)

    max_size = max_size_mb * MB
    size = 0
    chunks: list[bytes] = []
    while chunk := await file.read(64 * 1024):
        size += len(chunk)
        if size > max_size:
            raise FileTooLargeError(max_size_mb=max_size_mb)
        chunks.append(chunk)

    if size == 0:
        raise ValidationError(message=f"'{file.filename}' is empty")
    return b"".join(chunks), extension


def content_disposition(filename: str) -> str:
    """Attachment header that survives non-ASCII file names (RFC 6266)."""
    ascii_name = filename.encode("ascii", "ignore").decode() or "document"
    ascii_name = ascii_name.replace('"', "")
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(filename)}'


def file_response(
    content: bytes,
    *,
    media_type: str,
    filename: str,
    headers: dict[str, str] | None = None,
) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition(filename), **(headers or {})},
    )


def file_stem(filename: str | None, default: str = "document") -> str:
    name = filename or ""
    return (name.rsplit(".", 1)[0] if "." in name else name) or default
