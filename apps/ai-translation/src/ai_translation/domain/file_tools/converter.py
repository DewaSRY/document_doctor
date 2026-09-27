import html
from io import BytesIO

import pymupdf
from docx import Document as DocxDocument
from docx.document import Document
from docx.table import Table
from docx.text.hyperlink import Hyperlink
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from pdf2docx import Converter

_PAGE = pymupdf.paper_rect("a4")
_MARGIN = 60
_CONTENT = _PAGE + (_MARGIN, _MARGIN, -_MARGIN, -_MARGIN)
_EMU_PER_POINT = 12700

_CSS = """
body { font-family: sans-serif; font-size: 11pt; line-height: 1.35; }
p { margin: 0 0 6pt 0; }
h1 { font-size: 20pt; margin: 12pt 0 6pt 0; }
h2 { font-size: 16pt; margin: 10pt 0 6pt 0; }
h3 { font-size: 13pt; margin: 8pt 0 4pt 0; }
h4, h5, h6 { font-size: 11pt; margin: 6pt 0 4pt 0; }
ul, ol { margin: 0 0 6pt 0; }
table { border-collapse: collapse; margin: 0 0 8pt 0; }
td { border: 1px solid #999; padding: 3pt 5pt; vertical-align: top; }
"""

_ALIGNMENTS = {0: "left", 1: "center", 2: "right", 3: "justify"}


def pdf_to_docx(file_content: bytes) -> bytes:
    """Rebuild a PDF as an editable Word document (text, tables and images)."""
    converter = Converter(stream=file_content)
    try:
        output = BytesIO()
        converter.convert(output)
        return output.getvalue()
    finally:
        converter.close()


class _DocxToHtml:
    """Renders the body of a Word document as the HTML subset MuPDF lays out."""

    def __init__(self, doc: Document):
        self.doc = doc
        self.archive = pymupdf.Archive()
        self._image_count = 0

    def render(self) -> str:
        parts: list[str] = []
        open_list: str | None = None

        for block in self.doc.iter_inner_content():
            list_tag = self._list_tag(block) if isinstance(block, Paragraph) else None
            if open_list and list_tag != open_list:
                parts.append(f"</{open_list}>")
                open_list = None
            if list_tag and not open_list:
                parts.append(f"<{list_tag}>")
                open_list = list_tag

            if isinstance(block, Table):
                parts.append(self._table(block))
            elif list_tag:
                parts.append(f"<li>{self._inline(block)}</li>")
            else:
                parts.append(self._paragraph(block))

        if open_list:
            parts.append(f"</{open_list}>")
        return "".join(parts)

    @staticmethod
    def _list_tag(paragraph: Paragraph) -> str | None:
        style = (paragraph.style.name if paragraph.style else "") or ""
        if style.startswith("List Number"):
            return "ol"
        if style.startswith("List") or paragraph._p.pPr is not None and paragraph._p.pPr.numPr is not None:
            return "ul"
        return None

    def _paragraph(self, paragraph: Paragraph) -> str:
        style = (paragraph.style.name if paragraph.style else "") or ""
        tag = "p"
        if style == "Title":
            tag = "h1"
        elif style.startswith("Heading "):
            level = style.removeprefix("Heading ").strip()
            tag = f"h{min(int(level), 6)}" if level.isdigit() else "h2"

        align = _ALIGNMENTS.get(paragraph.alignment) if paragraph.alignment is not None else None
        attrs = f' style="text-align: {align}"' if align else ""
        content = self._inline(paragraph) or "&nbsp;"
        return f"<{tag}{attrs}>{content}</{tag}>"

    def _inline(self, paragraph: Paragraph) -> str:
        parts: list[str] = []
        for item in paragraph.iter_inner_content():
            if isinstance(item, Hyperlink):
                text = "".join(self._run(run) for run in item.runs)
                url = item.url
                parts.append(f'<a href="{html.escape(url, quote=True)}">{text}</a>' if url else text)
            elif isinstance(item, Run):
                parts.append(self._run(item))
        return "".join(parts)

    def _run(self, run: Run) -> str:
        text = html.escape(run.text).replace("\n", "<br/>").replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
        if run.bold:
            text = f"<b>{text}</b>"
        if run.italic:
            text = f"<i>{text}</i>"
        if run.underline:
            text = f"<u>{text}</u>"
        if run.font.superscript:
            text = f"<sup>{text}</sup>"
        elif run.font.subscript:
            text = f"<sub>{text}</sub>"
        return text + "".join(self._images(run))

    def _images(self, run: Run) -> list[str]:
        tags: list[str] = []
        for drawing in run._r.xpath(".//w:drawing"):
            blips = drawing.xpath(".//a:blip/@r:embed")
            extents = drawing.xpath(".//wp:extent")
            if not blips or blips[0] not in self.doc.part.related_parts:
                continue
            blob = self.doc.part.related_parts[blips[0]].blob

            width = height = None
            if extents:
                width = int(extents[0].get("cx")) / _EMU_PER_POINT
                height = int(extents[0].get("cy")) / _EMU_PER_POINT
                # Shrink images that would not fit on the page.
                scale = min(1.0, _CONTENT.width / width, (_CONTENT.height - 20) / height)
                width, height = width * scale, height * scale

            self._image_count += 1
            name = f"image{self._image_count}"
            self.archive.add(blob, name)
            size = f' width="{width:.0f}" height="{height:.0f}"' if width and height else ""
            tags.append(f'<img src="{name}"{size}/>')
        return tags

    def _table(self, table: Table) -> str:
        rows: list[str] = []
        for row in table.rows:
            cells: list[str] = []
            previous = None
            for cell in row.cells:
                # Horizontally merged cells are returned once per grid column.
                if cell._tc is previous:
                    continue
                previous = cell._tc
                content = "<br/>".join(self._inline(p) for p in cell.paragraphs)
                cells.append(f"<td>{content or '&nbsp;'}</td>")
            rows.append(f"<tr>{''.join(cells)}</tr>")
        return f"<table>{''.join(rows)}</table>"


def docx_to_pdf(file_content: bytes) -> bytes:
    """Lay out a Word document on A4 pages as a PDF."""
    renderer = _DocxToHtml(DocxDocument(BytesIO(file_content)))
    body = renderer.render()

    story = pymupdf.Story(html=f"<body>{body}</body>", user_css=_CSS, archive=renderer.archive)
    pdf = story.write_with_links(lambda rect_num, filled: (_PAGE, _CONTENT, None))
    try:
        return pdf.tobytes(garbage=3, deflate=True)
    finally:
        pdf.close()
