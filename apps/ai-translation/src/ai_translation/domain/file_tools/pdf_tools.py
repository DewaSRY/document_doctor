import re
import zipfile
from io import BytesIO

import pymupdf

_RANGE = re.compile(r"^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$")


class PdfToolError(ValueError):
    """A problem with the user's input, safe to show to them."""


def _open(file_content: bytes, name: str) -> pymupdf.Document:
    try:
        document = pymupdf.open(stream=file_content, filetype="pdf")
    except Exception as exc:
        raise PdfToolError(f"'{name}' is not a valid PDF file") from exc
    if document.needs_pass:
        document.close()
        raise PdfToolError(f"'{name}' is password protected")
    if document.page_count == 0:
        document.close()
        raise PdfToolError(f"'{name}' has no pages")
    return document


def page_count(file_content: bytes, name: str) -> int:
    with _open(file_content, name) as document:
        return document.page_count


def merge_pdfs(files: list[tuple[str, bytes]]) -> bytes:
    """Join the PDFs in the given order."""
    with pymupdf.open() as output:
        for name, content in files:
            with _open(content, name) as document:
                output.insert_pdf(document)
        return output.tobytes(garbage=3, deflate=True)


def parse_ranges(ranges: str, total_pages: int) -> list[tuple[int, int]]:
    """Parse '1-3, 5, 8-10' into 1-based inclusive (first, last) page pairs."""
    result: list[tuple[int, int]] = []
    for part in ranges.split(","):
        if not part.strip():
            continue
        match = _RANGE.match(part)
        if not match:
            raise PdfToolError(f"'{part.strip()}' is not a page range. Use a format like 1-3, 5")
        first = int(match.group(1))
        last = int(match.group(2) or first)
        if first < 1 or last < first or last > total_pages:
            raise PdfToolError(
                f"Page range '{part.strip()}' is outside the document, which has {total_pages} pages"
            )
        result.append((first, last))
    if not result:
        raise PdfToolError("Enter at least one page range")
    return result


def split_pdf(
    file_content: bytes,
    name: str,
    ranges: str | None,
    single_file: bool,
) -> tuple[bytes, str]:
    """
    Split a PDF by page ranges (or into single pages when no ranges are given).

    Returns the output bytes and its type: 'pdf' when one file is produced,
    otherwise 'zip' with one PDF per range.
    """
    stem = name.rsplit(".", 1)[0] or "document"

    with _open(file_content, name) as document:
        page_ranges = (
            parse_ranges(ranges, document.page_count)
            if ranges and ranges.strip()
            else [(page, page) for page in range(1, document.page_count + 1)]
        )

        def build(selected: list[tuple[int, int]]) -> bytes:
            with pymupdf.open() as output:
                for first, last in selected:
                    output.insert_pdf(document, from_page=first - 1, to_page=last - 1)
                return output.tobytes(garbage=3, deflate=True)

        if single_file or len(page_ranges) == 1:
            return build(page_ranges), "pdf"

        archive = BytesIO()
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for first, last in page_ranges:
                label = f"{first}" if first == last else f"{first}-{last}"
                zip_file.writestr(f"{stem}_pages_{label}.pdf", build([(first, last)]))
        return archive.getvalue(), "zip"
