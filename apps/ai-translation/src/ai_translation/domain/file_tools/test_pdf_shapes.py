"""Tests that converting a PDF to Word keeps its standalone lines, where they are."""

from io import BytesIO

import pymupdf
import pytest
from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.ns import qn
from docx.shared import Pt

from ai_translation.domain.file_tools import pdf_to_docx

_SHAPE_URI = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"


def _lines(pdf: pymupdf.Document) -> tuple[list[dict], DocxDocument]:
    """Every shape drawn in the converted document: its page rectangle, color and PDF page."""
    doc = Document(BytesIO(pdf_to_docx(pdf.tobytes())))
    shapes, page = [], 0
    for paragraph in doc.element.body.iter(qn("w:p")):
        for anchor in paragraph.xpath(f".//wp:anchor[a:graphic/a:graphicData/@uri='{_SHAPE_URI}']"):
            x = int(anchor.xpath("./wp:positionH/wp:posOffset")[0].text) / Pt(1)
            y = int(anchor.xpath("./wp:positionV/wp:posOffset")[0].text) / Pt(1)
            extent = anchor.find(qn("wp:extent"))
            width, height = int(extent.get("cx")) / Pt(1), int(extent.get("cy")) / Pt(1)
            color = anchor.xpath(".//a:srgbClr/@val")[0]
            shapes.append({"rect": (x, y, x + width, y + height), "color": color, "page": page})
        if paragraph.find(f"{qn('w:pPr')}/{qn('w:sectPr')}") is not None:
            page += 1
    return shapes, doc


def _find(shapes: list[dict], rect: tuple) -> dict:
    matches = [shape for shape in shapes if shape["rect"] == pytest.approx(rect, abs=1.0)]
    assert len(matches) == 1, f"expected one line at {rect}, got {shapes}"
    return matches[0]


def test_horizontal_rules_keep_their_position_length_thickness_and_color():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 80), "Report Title", fontsize=18)
    page.draw_line((72, 90), (523, 90), color=(0, 0, 0), width=1)
    page.insert_text((72, 120), "First paragraph of the body text.", fontsize=11)
    page.draw_line((72, 140), (523, 140), color=(0.5, 0.5, 0.5), width=0.5)
    page.insert_text((72, 160), "Second paragraph after a separator.", fontsize=11)
    page.draw_line((200, 260), (400, 260), color=(1, 0, 0), width=2)

    shapes, doc = _lines(pdf)

    assert len(shapes) == 3
    assert _find(shapes, (71.5, 89.5, 523.5, 90.5))["color"] == "000000"
    assert _find(shapes, (72, 139.75, 523, 140.25))["color"] == "7F7F7F"
    assert _find(shapes, (199, 259, 401, 261))["color"] == "FF0000"
    text = "".join(t.text or "" for t in doc.element.body.iter(qn("w:t")))
    assert "First paragraph of the body text." in text and "Second paragraph after a separator." in text


def test_filled_bar_and_fill_in_line_are_kept():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.draw_rect(pymupdf.Rect(72, 200, 523, 203), color=None, fill=(0.2, 0.3, 0.8))
    page.insert_text((72, 230), "Paragraph after a filled bar.", fontsize=11)
    page.insert_text((72, 320), "Name", fontsize=11)
    page.draw_line((110, 322), (300, 322), width=0.7)

    shapes, _ = _lines(pdf)

    assert _find(shapes, (72, 200, 523, 203))["color"] == "334CCC"
    _find(shapes, (109.65, 321.65, 300.35, 322.35))


def test_vertical_rule_is_kept():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((90, 100), "Text beside a margin rule.", fontsize=11)
    page.draw_line((80, 80), (80, 300), width=1)

    shapes, _ = _lines(pdf)

    _find(shapes, (79.5, 79.5, 80.5, 300.5))


def test_underlines_and_table_borders_are_not_drawn_twice():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 80), "Underlined words here", fontsize=11)
    page.draw_line((72, 82), (180, 82), width=0.8)
    for y in (120, 140, 160):
        page.draw_line((72, y), (372, y), width=1)
    for x in (72, 222, 372):
        page.draw_line((x, 120), (x, 160), width=1)
    for x, y, text in ((80, 135, "A1"), (230, 135, "B1"), (80, 155, "A2"), (230, 155, "B2")):
        page.insert_text((x, y), text, fontsize=10)
    page.draw_line((72, 200), (523, 200), width=1)

    shapes, doc = _lines(pdf)

    assert [shape["rect"] for shape in shapes] == [pytest.approx((71.5, 199.5, 523.5, 200.5), abs=1.0)]
    assert len(doc.tables) == 1
    assert doc.element.body.xpath(".//w:u")


def test_lines_are_drawn_on_their_own_page():
    pdf = pymupdf.open()
    for number in range(2):
        page = pdf.new_page()
        page.insert_text((72, 100), f"Page {number + 1}", fontsize=12)
        page.draw_line((72, 120 + number * 100), (523, 120 + number * 100), width=1)

    shapes, doc = _lines(pdf)

    assert len(doc.sections) == 2
    assert [(shape["page"], round(shape["rect"][1])) for shape in shapes] == [(0, 120), (1, 220)]


def test_page_without_lines_gets_no_shapes():
    pdf = pymupdf.open()
    pdf.new_page().insert_text((72, 100), "Only text on this page.", fontsize=12)

    shapes, _ = _lines(pdf)

    assert shapes == []
