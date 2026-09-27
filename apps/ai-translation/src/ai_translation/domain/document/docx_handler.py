import re
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

    @staticmethod
    def _write_paragraph(paragraph: Paragraph, translated_text: str) -> None:
        """Put the translation in the first text run so its style is kept; empty the rest."""
        runs: list[Run] = []
        for item in paragraph.iter_inner_content():
            runs.extend(item.runs if isinstance(item, Hyperlink) else [item])

        # Only touch runs with text, so images and other inline objects survive.
        text_runs = [run for run in runs if run.text]
        if not text_runs:
            paragraph.add_run(translated_text)
            return

        text_runs[0].text = translated_text
        for run in text_runs[1:]:
            run.text = ""

    def _segment_text(self, text: str) -> list[str]:
        """Segment text into sentences."""
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if s.strip()]
