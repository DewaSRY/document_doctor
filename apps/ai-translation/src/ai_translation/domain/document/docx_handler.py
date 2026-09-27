import re
from copy import deepcopy
from io import BytesIO

from docx import Document as DocxDocument
from docx.document import Document
from docx.text.hyperlink import Hyperlink
from docx.text.paragraph import Paragraph
from docx.text.run import Run

from .base import DocumentHandler


class DOCXHandler(DocumentHandler):
    """
    Handler for DOCX documents.

    Every paragraph (body, tables, headers and footers) is one segment.
    Keys look like 'para_3' and are stable between extraction and rebuild.
    """

    _HAS_LETTER = re.compile(r"[^\W\d_]")

    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract translatable paragraphs from the DOCX."""
        doc = DocxDocument(BytesIO(file_content))
        return {
            key: self._segment_text(paragraph.text)
            for key, paragraph in self._collect_paragraphs(doc).items()
        }

    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
    ) -> bytes:
        """Replace each paragraph with its translation, keeping the formatting."""
        doc = DocxDocument(BytesIO(file_content))

        for key, paragraph in self._collect_paragraphs(doc).items():
            translated_text = translations.get(key, "").strip()
            if translated_text:
                self._write_paragraph(paragraph, translated_text)

        doc.core_properties.subject = f"Translated from {source_language} to {target_language}"
        doc.core_properties.comments = "Translated by AI Translation Service"

        output = BytesIO()
        doc.save(output)
        return output.getvalue()

    def _collect_paragraphs(self, doc: Document) -> dict[str, Paragraph]:
        paragraphs: list[Paragraph] = []

        def walk(container) -> None:
            """Add the paragraphs of a document, cell, header or footer, including nested tables."""
            paragraphs.extend(container.paragraphs)
            for table in container.tables:
                for row in table.rows:
                    for cell in row.cells:
                        walk(cell)

        walk(doc)
        for section in doc.sections:
            walk(section.header)
            walk(section.footer)

        # Merged cells and linked headers return the same paragraph more than once.
        result: dict[str, Paragraph] = {}
        seen = set()
        for paragraph in paragraphs:
            if paragraph._p in seen or not self._HAS_LETTER.search(paragraph.text):
                continue
            seen.add(paragraph._p)
            result[f"para_{len(result)}"] = paragraph
        return result

    @classmethod
    def _write_paragraph(cls, paragraph: Paragraph, translated_text: str) -> None:
        """
        Write the translation back, keeping the formatting of the first text run.

        Hyperlinks whose text still appears in the translation (URLs, e-mail
        addresses) are left untouched, so the link keeps working; the translated
        text around them goes into the plain runs before and after each link.
        """
        items = list(paragraph.iter_inner_content())

        kept_links: list[tuple[int, Hyperlink]] = []
        pieces: list[str] = []
        cursor = 0
        for index, item in enumerate(items):
            if not isinstance(item, Hyperlink) or not item.text.strip():
                continue
            position = translated_text.find(item.text, cursor)
            if position < 0:
                continue
            kept_links.append((index, item))
            pieces.append(translated_text[cursor:position])
            cursor = position + len(item.text)
        pieces.append(translated_text[cursor:])

        template = next(
            (item for item in items if isinstance(item, Run) and item.text),
            None,
        )
        bounds = [-1] + [index for index, _ in kept_links] + [len(items)]

        for group, piece in enumerate(pieces):
            group_items = items[bounds[group] + 1:bounds[group + 1]]
            runs: list[Run] = []
            for item in group_items:
                runs.extend(item.runs if isinstance(item, Hyperlink) else [item])

            # Only touch runs with text, so images and other inline objects survive.
            text_runs = [run for run in runs if run.text]
            if text_runs:
                text_runs[0].text = piece
                for run in text_runs[1:]:
                    run.text = ""
                continue

            if not piece.strip():
                continue

            new_run = Run(
                deepcopy(template._r) if template else paragraph._p.add_r(),
                paragraph,
            )
            new_run.text = piece
            if group > 0:
                kept_links[group - 1][1]._hyperlink.addnext(new_run._r)
            elif kept_links:
                kept_links[0][1]._hyperlink.addprevious(new_run._r)

    def _segment_text(self, text: str) -> list[str]:
        """Segment text into sentences."""
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if s.strip()]
