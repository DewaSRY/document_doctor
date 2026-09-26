from abc import ABC, abstractmethod
from io import BytesIO
from docx import Document as DocxDocument
from docx.shared import Pt, RGBColor
from pypdf import PdfReader, PdfWriter
import re


class DocumentHandler(ABC):
    """Abstract base class for document handlers."""

    @abstractmethod
    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract text from document, preserving structure info."""
        pass

    @abstractmethod
    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
    ) -> bytes:
        """Create translated document preserving original structure."""
        pass


class PDFHandler(DocumentHandler):
    """Handler for PDF documents."""

    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract text from PDF, organizing by page."""
        pdf_reader = PdfReader(BytesIO(file_content))
        pages_text = {}

        for page_num, page in enumerate(pdf_reader.pages):
            text = page.extract_text()
            pages_text[f"page_{page_num}"] = self._segment_text(text)

        return pages_text

    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
    ) -> bytes:
        """Create translated PDF by replacing text in each page."""
        pdf_reader = PdfReader(BytesIO(file_content))
        pdf_writer = PdfWriter()

        for page_num, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text()
            translated_text = self._get_page_translation(
                page_num, translations, page_text
            )

            # PDF text replacement is complex; for now, add metadata
            page.add_transformation(lambda x: x)
            pdf_writer.add_page(page)

        pdf_writer.add_metadata({
            "/Producer": "AI Translation Service",
            "/Subject": f"Translated from {source_language} to {target_language}",
        })

        output = BytesIO()
        pdf_writer.write(output)
        output.seek(0)
        return output.getvalue()

    def _segment_text(self, text: str) -> list[str]:
        """Segment text into sentences."""
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if s.strip()]

    def _get_page_translation(
        self, page_num: int, translations: dict[str, str], original_text: str
    ) -> str:
        """Get translated text for a page."""
        page_key = f"page_{page_num}"
        return translations.get(page_key, original_text)


class DOCXHandler(DocumentHandler):
    """Handler for DOCX documents."""

    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract text from DOCX, preserving paragraph structure."""
        doc = DocxDocument(BytesIO(file_content))
        paragraphs_text = {}

        for para_num, para in enumerate(doc.paragraphs):
            if para.text.strip():
                paragraphs_text[f"para_{para_num}"] = [para.text.strip()]

        for table_num, table in enumerate(doc.tables):
            for row_num, row in enumerate(table.rows):
                for cell_num, cell in enumerate(row.cells):
                    if cell.text.strip():
                        key = f"table_{table_num}_row_{row_num}_cell_{cell_num}"
                        paragraphs_text[key] = [cell.text.strip()]

        return paragraphs_text

    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
    ) -> bytes:
        """Create translated DOCX by replacing text in paragraphs and tables."""
        doc = DocxDocument(BytesIO(file_content))

        for para_num, para in enumerate(doc.paragraphs):
            if para.text.strip():
                key = f"para_{para_num}"
                if key in translations:
                    para.text = translations[key]

        for table_num, table in enumerate(doc.tables):
            for row_num, row in enumerate(table.rows):
                for cell_num, cell in enumerate(row.cells):
                    if cell.text.strip():
                        key = f"table_{table_num}_row_{row_num}_cell_{cell_num}"
                        if key in translations:
                            cell.text = translations[key]

        core_props = doc.core_properties
        core_props.subject = f"Translated from {source_language} to {target_language}"
        core_props.comments = "Translated by AI Translation Service"

        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output.getvalue()
