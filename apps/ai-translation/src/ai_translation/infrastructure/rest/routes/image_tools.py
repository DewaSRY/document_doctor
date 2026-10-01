import asyncio
import re

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import Response

from ai_translation.domain.image_tools import (
    EXTENSIONS,
    FIT_MODES,
    FORMATS,
    MEDIA_TYPES,
    ImageResult,
    ImageToolError,
    compress_image,
    convert_image,
    resize_image,
)
from ai_translation.infrastructure.middleware import limiter
from ai_translation.infrastructure.rest.exceptions import (
    APIException,
    DocumentProcessingError,
    ValidationError,
)
from ai_translation.infrastructure.rest.uploads import (
    file_response,
    file_stem,
    read_upload,
)

router = APIRouter(prefix="/v1/image", tags=["image-tools"])

MAX_IMAGE_MB = 10


def _output_format(value: str | None) -> str | None:
    if not value:
        return None
    value = "jpeg" if value.lower() == "jpg" else value.lower()
    if value not in FORMATS:
        raise ValidationError(message=f"Format must be one of: {', '.join(EXTENSIONS.values())}")
    return value


def _processing_error(exc: Exception) -> APIException:
    if isinstance(exc, APIException):
        return exc
    if isinstance(exc, ImageToolError):
        return ValidationError(message=str(exc))
    return DocumentProcessingError(message=str(exc), details={"exception_type": type(exc).__name__})


def _image_response(result: ImageResult, filename: str | None, suffix: str, original_size: int) -> Response:
    return file_response(
        result.content,
        media_type=MEDIA_TYPES[result.format],
        filename=f"{file_stem(filename, 'image')}_{suffix}.{EXTENSIONS[result.format]}",
        headers={
            "X-Image-Width": str(result.width),
            "X-Image-Height": str(result.height),
            "X-Original-Size": str(original_size),
            "X-Output-Size": str(len(result.content)),
        },
    )


def _safe_image_stem(filename: str | None) -> str:
    name = (filename or "image").replace("\\", "/").rsplit("/", 1)[-1]
    stem = file_stem(name, "image")
    return re.sub(r"[\x00-\x1f\x7f/\\]", "_", stem).strip(" .")[:120] or "image"


@router.post("/convert")
@limiter.limit("20/minute")
async def convert(
    request: Request,
    file: UploadFile = File(...),
    format: str = Form(...),
) -> Response:
    """Convert a PNG, JPG or WEBP image to a supported target format (max 10MB)."""
    try:
        target_format = format.lower()
        if target_format not in ("webp", "png", "jpg", "jpeg", "svg"):
            raise ValidationError(message="Format must be one of: webp, png, jpg, svg")
        content, source_format = await read_upload(
            file, max_size_mb=MAX_IMAGE_MB, allowed_extensions=list(FORMATS)
        )
        result = await asyncio.to_thread(convert_image, content, target_format, source_format)
        return file_response(
            result.content,
            media_type=MEDIA_TYPES[result.format],
            filename=f"{_safe_image_stem(file.filename)}_converted.{EXTENSIONS[result.format]}",
        )
    except Exception as exc:
        raise _processing_error(exc)


@router.post("/resize")
@limiter.limit("60/minute")
async def resize(
    request: Request,
    file: UploadFile = File(...),
    width: int | None = Form(None),
    height: int | None = Form(None),
    fit: str = Form("cover"),
    format: str | None = Form(None),
) -> Response:
    """
    Resize a JPG, PNG or WEBP image (max 10MB).

    - **width** / **height**: target size in px; with one of them, the ratio is kept
    - **fit**: 'cover' (crop to the exact size), 'contain' (fit inside) or 'stretch'
    - **format**: 'jpg', 'png' or 'webp'; omit to keep the original format
    """
    try:
        if fit not in FIT_MODES:
            raise ValidationError(message=f"Fit must be one of: {', '.join(FIT_MODES)}")
        output_format = _output_format(format)
        content, _ = await read_upload(file, max_size_mb=MAX_IMAGE_MB, allowed_extensions=list(FORMATS))
        result = await asyncio.to_thread(resize_image, content, width, height, fit, output_format)
        return _image_response(result, file.filename, f"{result.width}x{result.height}", len(content))
    except Exception as exc:
        raise _processing_error(exc)


@router.post("/compress")
@limiter.limit("60/minute")
async def compress(
    request: Request,
    file: UploadFile = File(...),
    quality: int = Form(75),
    format: str | None = Form(None),
    max_dimension: int | None = Form(None),
) -> Response:
    """
    Compress a JPG, PNG or WEBP image (max 10MB). Metadata such as EXIF and
    location data is removed.

    - **quality**: 1-100, lower is smaller
    - **format**: 'jpg', 'png' or 'webp'; omit to keep the original format
    - **max_dimension**: optionally shrink the longest side to this many px
    """
    try:
        output_format = _output_format(format)
        content, _ = await read_upload(file, max_size_mb=MAX_IMAGE_MB, allowed_extensions=list(FORMATS))
        result = await asyncio.to_thread(compress_image, content, quality, output_format, max_dimension)
        return _image_response(result, file.filename, "compressed", len(content))
    except Exception as exc:
        raise _processing_error(exc)
