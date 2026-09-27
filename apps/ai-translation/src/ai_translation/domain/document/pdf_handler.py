import html
import re
from dataclasses import dataclass, field
import pymupdf
from .base import DocumentHandler


@dataclass
class _Segment:
    """A translatable piece of text on a page and the area it occupies."""

    key: str
    page_num: int
    text: str
    rects: list[pymupdf.Rect] = field(default_factory=list)
    font_size: float = 11.0
    color: int = 0
    bold: bool = False

    @property
    def bbox(self) -> pymupdf.Rect:
        bbox = pymupdf.Rect(self.rects[0])
        for rect in self.rects[1:]:
            bbox |= rect
        return bbox


class PDFHandler(DocumentHandler):
    """
    Handler for PDF documents.

    Text is extracted line by line (wrapped lines of one paragraph are merged),
    so every translation can be written back into the area of its source text.
    Keys look like 'page_0_seg_3' and are stable between extraction and rebuild.
    """

    _HAS_LETTER = re.compile(r"[^\W\d_]")

    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract translatable text segments from the PDF."""
        with pymupdf.open(stream=file_content, filetype="pdf") as pdf_document:
            return {
                segment.key: self._segment_text(segment.text)
                for segment in self._collect_segments(pdf_document)
            }

    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
    ) -> bytes:
        """Replace each source segment with its translation, keeping the layout."""
        with pymupdf.open(stream=file_content, filetype="pdf") as pdf_document:
            segments = [
                segment
                for segment in self._collect_segments(pdf_document)
                if translations.get(segment.key, "").strip()
            ]

            for page in pdf_document:
                page_segments = [s for s in segments if s.page_num == page.number]
                if not page_segments:
                    continue

                # Redaction deletes link annotations over the text; restore them afterwards.
                links = page.get_links()

                # Remove the original text only; keep images and table lines.
                for segment in page_segments:
                    for rect in segment.rects:
                        page.add_redact_annot(rect, fill=False)
                        
                page.apply_redactions(
                    images=pymupdf.PDF_REDACT_IMAGE_NONE,
                    graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                )

                for segment in page_segments:
                    self._write_segment(page, segment, translations[segment.key])

                self._restore_links(page, links)

            pdf_document.set_metadata(
                {
                    **(pdf_document.metadata or {}),
                    "subject": f"Translated from {source_language} to {target_language}",
                }
            )

            pdf_bytes = pdf_document.tobytes(
                garbage=4,
                deflate=True,
                clean=True,
            )
            return pdf_bytes

    def _collect_segments(self, pdf_document: pymupdf.Document) -> list[_Segment]:
        segments: list[_Segment] = []

        for page in pdf_document:
            page_segments: list[_Segment] = []
            text_dict = page.get_text("dict", flags=pymupdf.TEXTFLAGS_TEXT)

            for block in text_dict.get("blocks", []):
                if block.get("type") != 0:
                    continue

                lines = [line for line in block.get("lines", []) if self._line_text(line)]
                block_right = max((line["bbox"][2] for line in lines), default=0)
                previous_line = None

                for line in lines:
                    text = self._line_text(line)
                    rect = pymupdf.Rect(line["bbox"])

                    if previous_line is not None and self._continues_paragraph(
                        previous_line, line, block_right
                    ):
                        current = page_segments[-1]
                        current.text = f"{current.text} {text}"
                        current.rects.append(rect)
                    else:
                        first_span = max(line["spans"], key=lambda s: len(s["text"].strip()))
                        page_segments.append(
                            _Segment(
                                key=f"page_{page.number}_seg_{len(page_segments)}",
                                page_num=page.number,
                                text=text,
                                rects=[rect],
                                font_size=first_span["size"],
                                color=first_span["color"],
                                bold="bold" in first_span["font"].lower()
                                or bool(first_span["flags"] & pymupdf.TEXT_FONT_BOLD),
                            )
                        )
                    previous_line = line

            segments.extend(s for s in page_segments if self._HAS_LETTER.search(s.text))

        return segments

    @staticmethod
    def _line_text(line: dict) -> str:
        return " ".join("".join(span["text"] for span in line["spans"]).split())

    @staticmethod
    def _continues_paragraph(previous_line: dict, line: dict, block_right: float) -> bool:
        """A line continues the previous one when the previous line was wrapped."""
        prev_x0, prev_y0, prev_x1, prev_y1 = previous_line["bbox"]
        x0, y0, _, _ = line["bbox"]
        height = prev_y1 - prev_y0
        return (
            abs(x0 - prev_x0) < 3
            and 0 <= y0 - prev_y1 < height * 0.6
            and prev_x1 >= block_right - height * 3
        )

    @staticmethod
    def _restore_links(page: pymupdf.Page, links: list[dict]) -> None:
        """Re-add links, moved onto their URL text if the translation shifted it."""
        existing = {(link.get("uri"), tuple(link["from"])) for link in page.get_links()}
        for link in links:
            if (link.get("uri"), tuple(link["from"])) in existing:
                continue
            uri = link.get("uri") or ""
            display = uri.removeprefix("mailto:")
            hits = page.search_for(display) if display else []
            if hits:
                # Prefer the occurrence closest to where the link used to be.
                link["from"] = min(
                    hits,
                    key=lambda rect: abs(rect.y0 - link["from"].y0) + abs(rect.x0 - link["from"].x0),
                )
            link.pop("xref", None)
            link.pop("id", None)
            page.insert_link(link)

    @staticmethod
    def _write_segment(page: pymupdf.Page, segment: _Segment, translated_text: str) -> None:
        red, green, blue = pymupdf.sRGB_to_rgb(segment.color)
        css = (
            f"* {{font-family: sans-serif; font-size: {segment.font_size:.1f}px; "
            f"color: rgb({red}, {green}, {blue}); "
            f"font-weight: {'bold' if segment.bold else 'normal'}; "
            "margin: 0; padding: 0; line-height: 1.15;}"
        )
        # scale_low=0 lets the text shrink as needed to fit the original area.
        page.insert_htmlbox(segment.bbox, html.escape(translated_text), css=css, scale_low=0)

    def _segment_text(self, text: str) -> list[str]:
        """Segment text into sentences."""
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if s.strip()]
