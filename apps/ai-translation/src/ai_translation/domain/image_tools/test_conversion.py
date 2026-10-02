import asyncio
from io import BytesIO

import pytest
from fastapi import UploadFile
from PIL import Image

from ai_translation.domain.image_tools import ImageToolError, convert_image, images
from ai_translation.infrastructure.rest.exceptions import FileTooLargeError
from ai_translation.infrastructure.rest.uploads import read_upload


def _image_bytes(format: str, mode: str = "RGB", color: tuple = (20, 120, 220)) -> bytes:
    image = Image.new(mode, (8, 6), color)
    output = BytesIO()
    image.save(output, format=format)
    return output.getvalue()


@pytest.mark.parametrize(
    ("source", "target", "expected"),
    [
        ("PNG", "webp", "WEBP"),
        ("JPEG", "webp", "WEBP"),
        ("WEBP", "png", "PNG"),
        ("WEBP", "jpg", "JPEG"),
    ],
)
def test_convert_raster_formats(source: str, target: str, expected: str) -> None:
    result = convert_image(_image_bytes(source), target)

    with Image.open(BytesIO(result.content)) as output:
        assert output.format == expected
        assert output.size == (8, 6)


def test_convert_png_to_svg_traces_vector_paths() -> None:
    result = convert_image(_image_bytes("PNG"), "svg")

    assert result.format == "svg"
    assert b"<svg" in result.content[:1024]
    assert b"<path" in result.content
    assert b"data:image/png" not in result.content


def test_convert_jpeg_to_svg_traces_vector_paths() -> None:
    result = convert_image(_image_bytes("JPEG"), "svg")

    assert result.format == "svg"
    assert b"<svg" in result.content[:1024]
    assert b"<path" in result.content


def test_convert_transparent_webp_to_jpeg_uses_white_background() -> None:
    result = convert_image(_image_bytes("WEBP", "RGBA", (20, 120, 220, 0)), "jpg")

    with Image.open(BytesIO(result.content)) as output:
        assert output.getpixel((0, 0)) == (255, 255, 255)


@pytest.mark.parametrize(
    ("source", "target"),
    [("PNG", "png"), ("WEBP", "webp"), ("GIF", "png")],
)
def test_reject_unsupported_conversion(source: str, target: str) -> None:
    with pytest.raises(ImageToolError):
        convert_image(_image_bytes(source), target)


def test_reject_corrupted_image() -> None:
    with pytest.raises(ImageToolError, match="valid JPG, PNG or WEBP"):
        convert_image(b"not an image", "webp")


def test_reject_mismatched_filename_format() -> None:
    with pytest.raises(ImageToolError, match="extension does not match"):
        convert_image(_image_bytes("PNG"), "webp", "jpeg")


def test_vectorizer_failure_is_not_returned_as_a_raster(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(_: Image.Image) -> bytes:
        raise RuntimeError("vectorizer failed")

    monkeypatch.setattr(images, "_trace_png_to_svg", fail)

    with pytest.raises(RuntimeError, match="vectorizer failed"):
        convert_image(_image_bytes("PNG"), "svg")


def test_reject_oversized_upload() -> None:
    async def check_upload_size() -> None:
        upload = UploadFile(file=BytesIO(b"x" * (10 * 1024 * 1024 + 1)), filename="large.png")
        with pytest.raises(FileTooLargeError):
            await read_upload(upload, max_size_mb=10, allowed_extensions=["png"])

    asyncio.run(check_upload_size())