from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_DIMENSION = 10_000
MAX_IMAGE_PIXELS = 50_000_000
MAX_VECTOR_PIXELS = 25_000_000

# Output formats and how Pillow names them.
FORMATS = {"jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}
MEDIA_TYPES = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
EXTENSIONS = {"jpeg": "jpg", "png": "png", "webp": "webp"}
MEDIA_TYPES["svg"] = "image/svg+xml"
EXTENSIONS["svg"] = "svg"

CONVERSION_TARGETS = {
    "jpeg": ("webp",),
    "png": ("webp", "svg"),
    "webp": ("png", "jpeg"),
}

FIT_MODES = ("cover", "contain", "stretch")


class ImageToolError(ValueError):
    """A problem with the user's input, safe to show to them."""


@dataclass
class ImageResult:
    content: bytes
    format: str
    width: int
    height: int


def _open(file_content: bytes) -> tuple[Image.Image, str]:
    try:
        image = Image.open(BytesIO(file_content))
    except Image.DecompressionBombError as exc:
        raise ImageToolError("This image is too large to process") from exc
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageToolError("This file is not a valid JPG, PNG or WEBP image") from exc

    if image.width > MAX_DIMENSION or image.height > MAX_DIMENSION:
        raise ImageToolError(f"Image dimensions must not exceed {MAX_DIMENSION} px per side")
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ImageToolError("This image has too many pixels to process")

    try:
        image.load()
    except Image.DecompressionBombError as exc:
        raise ImageToolError("This image is too large to process") from exc
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageToolError("This file is not a valid JPG, PNG or WEBP image") from exc

    source_format = (image.format or "").lower()
    if source_format not in FORMATS:
        raise ImageToolError("This file is not a valid JPG, PNG or WEBP image")

    # Apply the camera rotation, since EXIF data is not written back.
    return ImageOps.exif_transpose(image), source_format


def _save(image: Image.Image, output_format: str, quality: int = 90, lossy_png: bool = False) -> bytes:
    output = BytesIO()

    if output_format == "jpeg":
        if image.mode in ("RGBA", "LA", "P"):
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.getchannel("A"))
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")
        image.save(output, "JPEG", quality=quality, optimize=True, progressive=True)
    elif output_format == "webp":
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() or image.mode == "P" else "RGB")
        image.save(output, "WEBP", quality=quality, method=6)
    else:
        if lossy_png and image.mode != "P":
            # Reduce to a 256-colour palette: the main way to shrink a PNG.
            image = image.convert("RGBA").quantize(colors=256, method=Image.Quantize.FASTOCTREE)
        image.save(output, "PNG", optimize=True)

    return output.getvalue()


def resize_image(
    file_content: bytes,
    width: int | None,
    height: int | None,
    fit: str,
    output_format: str | None,
) -> ImageResult:
    """
    Resize to the given size. With one side only, the other keeps the ratio.

    - cover: fill the exact size, cropping the overflow from the centre
    - contain: fit inside the size without cropping (may be smaller on one side)
    - stretch: exact size, ignoring the aspect ratio
    """
    if not width and not height:
        raise ImageToolError("Enter a width, a height, or both")
    for value in (width, height):
        if value is not None and not 1 <= value <= MAX_DIMENSION:
            raise ImageToolError(f"Width and height must be between 1 and {MAX_DIMENSION} px")

    image, source_format = _open(file_content)
    target_format = output_format or source_format

    if not width or not height:
        ratio = image.width / image.height
        width = width or max(1, round(height * ratio))
        height = height or max(1, round(width / ratio))
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
    elif fit == "contain":
        resized = ImageOps.contain(image, (width, height), Image.Resampling.LANCZOS)
    elif fit == "stretch":
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
    else:
        resized = ImageOps.fit(image, (width, height), Image.Resampling.LANCZOS)

    return ImageResult(
        content=_save(resized, target_format),
        format=target_format,
        width=resized.width,
        height=resized.height,
    )


def compress_image(
    file_content: bytes,
    quality: int,
    output_format: str | None,
    max_dimension: int | None,
) -> ImageResult:
    """
    Re-encode the image smaller. Metadata is dropped. When the result is not
    smaller than the upload in the same format, the upload is returned as is.
    """
    if not 1 <= quality <= 100:
        raise ImageToolError("Quality must be between 1 and 100")
    if max_dimension is not None and not 1 <= max_dimension <= MAX_DIMENSION:
        raise ImageToolError(f"The maximum size must be between 1 and {MAX_DIMENSION} px")

    image, source_format = _open(file_content)
    target_format = output_format or source_format

    if max_dimension and max(image.size) > max_dimension:
        image = ImageOps.contain(image, (max_dimension, max_dimension), Image.Resampling.LANCZOS)

    content = _save(image, target_format, quality=quality, lossy_png=quality < 90)
    if target_format == source_format and not max_dimension and len(content) >= len(file_content):
        content = file_content

    return ImageResult(content=content, format=target_format, width=image.width, height=image.height)


def _trace_png_to_svg(image: Image.Image) -> bytes:
    import vtracer

    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    background.alpha_composite(rgba)

    with TemporaryDirectory(prefix="image-vectorize-") as directory:
        source_path = Path(directory) / "source.png"
        output_path = Path(directory) / "result.svg"
        background.convert("RGB").save(source_path, format="PNG")
        vtracer.convert_image_to_svg_py(
            str(source_path),
            str(output_path),
            colormode="color",
            hierarchical="stacked",
        )
        content = output_path.read_bytes()

    if b"<svg" not in content[:1024]:
        raise ImageToolError("The image could not be vectorized")
    return content


def convert_image(
    file_content: bytes,
    target_format: str,
    expected_source_format: str | None = None,
) -> ImageResult:
    """Convert only the supported image-format pairs; SVG output is traced paths."""
    image, source_format = _open(file_content)
    if expected_source_format:
        expected = "jpeg" if expected_source_format.lower() == "jpg" else expected_source_format.lower()
        if expected != source_format:
            raise ImageToolError("The file extension does not match the image format")
    target_format = "jpeg" if target_format.lower() in ("jpg", "jpeg") else target_format.lower()
    if target_format not in CONVERSION_TARGETS.get(source_format, ()):
        raise ImageToolError(f"Conversion from {source_format.upper()} to {target_format.upper()} is not supported")

    if target_format == "svg":
        if image.width * image.height > MAX_VECTOR_PIXELS:
            raise ImageToolError("PNG images above 25 million pixels cannot be vectorized")
        content = _trace_png_to_svg(image)
    else:
        content = _save(image, target_format, quality=95)

    return ImageResult(content=content, format=target_format, width=image.width, height=image.height)
