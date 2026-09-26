from io import BytesIO
from docx import Document as DocxDocument

from .base import DocumentHandler


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

        # Replace text in paragraphs
        for para_num, para in enumerate(doc.paragraphs):
            if para.text.strip():
                key = f"para_{para_num}"
                if key in translations:
                    # Clear existing runs and add translated text
                    for run in para.runs:
                        run.text = ""
                    para.clear()
                    para.add_run(translations[key])

        # Replace text in table cells
        for table_num, table in enumerate(doc.tables):
            for row_num, row in enumerate(table.rows):
                for cell_num, cell in enumerate(row.cells):
                    if cell.text.strip():
                        key = f"table_{table_num}_row_{row_num}_cell_{cell_num}"
                        if key in translations:
                            # Clear cell paragraphs and add translated text
                            for para in cell.paragraphs:
                                para.clear()
                            if cell.paragraphs:
                                cell.paragraphs[0].add_run(translations[key])

        core_props = doc.core_properties
        core_props.subject = f"Translated from {source_language} to {target_language}"
        core_props.comments = "Translated by AI Translation Service"

        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output.getvalue()
