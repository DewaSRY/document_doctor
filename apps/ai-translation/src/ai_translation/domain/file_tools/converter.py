import html
import json
import logging
import os
import re
import shutil
import signal
import subprocess
import tempfile
import threading
import zipfile
from functools import cache
from io import BytesIO
from pathlib import Path

import pymupdf
from docx import Document as DocxDocument
from docx.document import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml.ns import qn
from docx.shared import Pt
from docx.table import Table
from docx.text.hyperlink import Hyperlink
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from pdf2docx import Converter

from .pdf_links import PdfLinks
from .pdf_shapes import add_lines, page_lines
from .pdf_tools import PdfToolError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# PDF -> DOCX
# ---------------------------------------------------------------------------

# Resolution of pages kept as a picture when their layout cannot be rebuilt.
_FALLBACK_PAGE_DPI = 200


def pdf_to_docx(file_content: bytes) -> bytes:
    """
    Rebuild a PDF as an editable Word document: text with its fonts and colors,
    links, lines, tables, images and page geometry. A page whose layout cannot be
    rebuilt is kept as a picture of the page instead of being dropped.
    """
    converter = Converter(stream=file_content)
    try:
        settings = converter.default_settings | {"ignore_page_error": True}
        converter.parse(**settings)

        links = PdfLinks(converter.fitz_doc)
        for page in converter.pages:
            if page.finalized:
                links.apply(page)
        links.place_bookmarks(converter.pages)

        doc = DocxDocument()
        page_starts: dict[int, Paragraph] = {}
        for page in converter.pages:
            before = list(doc.element.body)
            rebuilt = page.finalized and _make_page(doc, page)
            if not rebuilt:
                logger.warning("Keeping PDF page %d as an image, its layout could not be rebuilt", page.id + 1)
                _add_page_image(doc, converter.fitz_doc[page.id])
            if (start := _first_new_paragraph(doc, before)) is None:
                continue
            page_starts[page.id] = start
            # pdf2docx writes no line it does not use as a border or text style.
            if rebuilt:
                add_lines(start, page_lines(page))

        links.finish(doc, page_starts)
        _make_strictly_valid(doc)
        output = BytesIO()
        doc.save(output)
        return output.getvalue()
    finally:
        converter.close()


_NUMBER = re.compile(r"-?\d+\.\d*")
_CELL_MARGINS = {qn("w:tcMar"), qn("w:tblCellMar")}
_LOGICAL_SIDES = {qn("w:start"): qn("w:left"), qn("w:end"): qn("w:right")}


def _make_strictly_valid(doc: Document) -> None:
    """
    Fix the markup pdf2docx writes that Word accepts but stricter readers such
    as Google Docs reject: decimals in whole-number attributes (sizes, widths)
    and start/end cell margins, which older readers only know as left/right.
    """
    _unicode_bullets(doc)
    for root in (doc.element, doc.styles.element):
        for element in root.iter():
            for name, value in element.attrib.items():
                if _NUMBER.fullmatch(value):
                    element.set(name, str(round(float(value))))
            parent = element.getparent()
            if element.tag in _LOGICAL_SIDES and parent is not None and parent.tag in _CELL_MARGINS:
                element.tag = _LOGICAL_SIDES[element.tag]


# Word's bullets are private-use characters of the Symbol and Wingdings fonts,
# which show as empty boxes wherever those fonts are missing.
_SYMBOL_BULLETS = str.maketrans(
    {
        "": "•",
        "": "▪",
        "": "➢",
        "": "❖",
        "": "✓",
        "": "■",
        "": "◆",
    }
)


def _unicode_bullets(doc: Document) -> None:
    for text in doc.element.body.iter(qn("w:t")):
        if text.text and (converted := text.text.translate(_SYMBOL_BULLETS)) != text.text:
            text.text = converted
            # Let the bullet take the document font, which has these characters.
            fonts = text.getparent().find(f"{qn('w:rPr')}/{qn('w:rFonts')}")
            if fonts is not None:
                fonts.getparent().remove(fonts)


def _first_new_paragraph(doc: Document, before: list) -> Paragraph | None:
    """
    The first paragraph a page added. Starting a page ends the previous one's
    section with a paragraph holding its settings, which is skipped.
    """
    existing = set(map(id, before))
    for element in doc.element.body:
        if id(element) in existing:
            continue
        for p in element.iter(qn("w:p")):
            if p.pPr is None or p.pPr.sectPr is None:
                return Paragraph(p, doc._body)
    return None


def _make_page(doc: Document, page) -> bool:
    """Add a parsed pdf2docx page; on failure, undo whatever it half-wrote."""
    body = doc.element.body
    # Hold the children: lxml reuses the id of an element nothing refers to.
    before = list(body)
    try:
        page.make_docx(doc)
        return True
    except Exception:
        logger.exception("Failed to rebuild PDF page %d", page.id + 1)
        existing = set(map(id, before))
        for child in list(body):
            if id(child) not in existing and child is not body.sectPr:
                body.remove(child)
        return False


def _add_page_image(doc: Document, page: pymupdf.Page) -> None:
    section = doc.add_section(WD_SECTION.NEW_PAGE) if doc.paragraphs else doc.sections[0]
    section.page_width = Pt(page.rect.width)
    section.page_height = Pt(page.rect.height)
    section.left_margin = section.right_margin = Pt(0)
    section.top_margin = section.bottom_margin = Pt(0)
    section.header_distance = section.footer_distance = Pt(0)

    image = BytesIO(page.get_pixmap(dpi=_FALLBACK_PAGE_DPI).tobytes("png"))
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1.0
    # A picture exactly as tall as the page pushes an empty page after it.
    paragraph.add_run().add_picture(image, height=Pt(page.rect.height - 2))


# ---------------------------------------------------------------------------
# DOCX -> PDF
# ---------------------------------------------------------------------------

_SOFFICE_CANDIDATES = (
    "soffice",
    "libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/lib/libreoffice/program/soffice",
)
_SOFFICE_TIMEOUT_SECONDS = 180
# Every conversion starts its own LibreOffice process; cap how many run at once.
_SOFFICE_SLOTS = threading.BoundedSemaphore(2)
# Keep images at their original resolution and quality.
_PDF_EXPORT_OPTIONS = json.dumps(
    {
        "ReduceImageResolution": {"type": "boolean", "value": "false"},
        "UseLosslessCompression": {"type": "boolean", "value": "true"},
        "ExportBookmarks": {"type": "boolean", "value": "true"},
        "ExportFormFields": {"type": "boolean", "value": "false"},
    }
)


@cache
def _soffice() -> str | None:
    configured = os.environ.get("SOFFICE_PATH")
    for candidate in (configured, *_SOFFICE_CANDIDATES):
        if candidate and (path := shutil.which(candidate)):
            return path
    return None


def docx_to_pdf(file_content: bytes) -> bytes:
    """
    Lay out a Word document as a PDF.

    LibreOffice renders the document with Word's own layout rules, so fonts,
    colors, page setup, headers and footers, tables, shapes and floating images
    carry over. Without LibreOffice a simplified HTML rendering is used.
    """
    if not _is_docx(file_content):
        raise PdfToolError("The file is not a valid Word (.docx) document")

    soffice = _soffice()
    if soffice:
        with _SOFFICE_SLOTS:
            return _libreoffice_to_pdf(soffice, file_content)

    logger.warning("LibreOffice is not installed; converting DOCX to PDF with the simplified renderer")
    return _html_to_pdf(file_content)


def _is_docx(file_content: bytes) -> bool:
    try:
        with zipfile.ZipFile(BytesIO(file_content)) as archive:
            return "word/document.xml" in archive.namelist()
    except zipfile.BadZipFile:
        return False


def _libreoffice_to_pdf(soffice: str, file_content: bytes) -> bytes:
    with tempfile.TemporaryDirectory(prefix="docx-to-pdf-") as tmp:
        work = Path(tmp)
        source = work / "document.docx"
        source.write_bytes(file_content)

        command = [
            soffice,
            # A private profile lets conversions run side by side.
            f"-env:UserInstallation={(work / 'profile').as_uri()}",
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nodefault",
            "--convert-to",
            f"pdf:writer_pdf_Export:{_PDF_EXPORT_OPTIONS}",
            "--outdir",
            str(work),
            str(source),
        ]
        # A new session lets a timeout kill LibreOffice's child processes too.
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
            env={**os.environ, "HOME": tmp},
        )
        try:
            _, stderr = process.communicate(timeout=_SOFFICE_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            raise RuntimeError(f"Converting the document took longer than {_SOFFICE_TIMEOUT_SECONDS} seconds")

        output = work / "document.pdf"
        if process.returncode != 0 or not output.exists():
            message = stderr.decode(errors="replace").strip() or f"exit code {process.returncode}"
            raise RuntimeError(f"LibreOffice could not convert the document: {message}")
        return output.read_bytes()


# Simplified renderer, used only when LibreOffice is unavailable.

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

_HIGHLIGHTS = {
    WD_COLOR_INDEX.YELLOW: "#ffff00",
    WD_COLOR_INDEX.BRIGHT_GREEN: "#00ff00",
    WD_COLOR_INDEX.TURQUOISE: "#00ffff",
    WD_COLOR_INDEX.PINK: "#ff00ff",
    WD_COLOR_INDEX.BLUE: "#0000ff",
    WD_COLOR_INDEX.RED: "#ff0000",
    WD_COLOR_INDEX.DARK_BLUE: "#000080",
    WD_COLOR_INDEX.TEAL: "#008080",
    WD_COLOR_INDEX.GREEN: "#008000",
    WD_COLOR_INDEX.VIOLET: "#800080",
    WD_COLOR_INDEX.DARK_RED: "#800000",
    WD_COLOR_INDEX.DARK_YELLOW: "#808000",
    WD_COLOR_INDEX.GRAY_50: "#808080",
    WD_COLOR_INDEX.GRAY_25: "#c0c0c0",
    WD_COLOR_INDEX.BLACK: "#000000",
}


def _shading(element) -> str | None:
    """Background color of a paragraph, run or cell, from its w:shd."""
    fills = element.xpath("./*/w:shd/@w:fill") if element is not None else []
    fill = fills[0] if fills else None
    return f"#{fill}" if fill and fill.lower() != "auto" else None


class _DocxToHtml:
    """Renders the body of a Word document as the HTML subset MuPDF lays out."""

    def __init__(self, doc: Document, content: pymupdf.Rect):
        self.doc = doc
        self.content = content
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

        css: list[str] = []
        if paragraph.alignment is not None and (align := _ALIGNMENTS.get(paragraph.alignment)):
            css.append(f"text-align: {align}")
        if background := _shading(paragraph._p):
            css.append(f"background-color: {background}")
        # Heading colors usually come from the style rather than the runs.
        if paragraph.style is not None and (color := self._color(paragraph.style.font)):
            css.append(f"color: {color}")
        attrs = f' style="{"; ".join(css)}"' if css else ""
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

    @staticmethod
    def _color(font) -> str | None:
        try:
            rgb = font.color.rgb if font.color is not None and font.color.type is not None else None
        except (AttributeError, ValueError):
            return None
        return f"#{rgb}" if rgb is not None else None

    def _run(self, run: Run) -> str:
        text = html.escape(run.text).replace("\n", "<br/>").replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
        if run.bold:
            text = f"<b>{text}</b>"
        if run.italic:
            text = f"<i>{text}</i>"
        if run.underline:
            text = f"<u>{text}</u>"
        if run.font.strike or run.font.double_strike:
            text = f"<s>{text}</s>"
        if run.font.superscript:
            text = f"<sup>{text}</sup>"
        elif run.font.subscript:
            text = f"<sub>{text}</sub>"

        css: list[str] = []
        if color := self._color(run.font):
            css.append(f"color: {color}")
        highlight = run.font.highlight_color
        if background := (_HIGHLIGHTS.get(highlight) if highlight else None) or _shading(run._r):
            css.append(f"background-color: {background}")
        if run.font.size:
            css.append(f"font-size: {run.font.size.pt:g}pt")
        if run.font.name:
            css.append(f"font-family: '{html.escape(run.font.name, quote=True)}', sans-serif")
        if run.font.all_caps:
            css.append("text-transform: uppercase")
        if css and text:
            text = f'<span style="{"; ".join(css)}">{text}</span>'
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
                scale = min(1.0, self.content.width / width, (self.content.height - 20) / height)
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
                background = _shading(cell._tc)
                attrs = f' style="background-color: {background}"' if background else ""
                cells.append(f"<td{attrs}>{content or '&nbsp;'}</td>")
            rows.append(f"<tr>{''.join(cells)}</tr>")
        return f"<table>{''.join(rows)}</table>"


def _page_geometry(doc: Document) -> tuple[pymupdf.Rect, pymupdf.Rect]:
    """Page and content area of the document's first section, A4 if unset."""
    page = pymupdf.paper_rect("a4")
    section = doc.sections[0] if doc.sections else None
    if section is not None and section.page_width and section.page_height:
        page = pymupdf.Rect(0, 0, section.page_width.pt, section.page_height.pt)

    def margin(value, default: float = 72) -> float:
        return value.pt if value is not None else default

    content = page + (
        margin(section and section.left_margin),
        margin(section and section.top_margin),
        -margin(section and section.right_margin),
        -margin(section and section.bottom_margin),
    )
    return page, content


def _html_to_pdf(file_content: bytes) -> bytes:
    doc = DocxDocument(BytesIO(file_content))
    page, content = _page_geometry(doc)
    renderer = _DocxToHtml(doc, content)
    body = renderer.render()

    story = pymupdf.Story(html=f"<body>{body}</body>", user_css=_CSS, archive=renderer.archive)
    pdf = story.write_with_links(lambda rect_num, filled: (page, content, None))
    try:
        return pdf.tobytes(garbage=3, deflate=True)
    finally:
        pdf.close()
