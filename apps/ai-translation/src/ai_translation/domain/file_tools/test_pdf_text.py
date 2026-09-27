"""Tests that converting a PDF to Word keeps its words as wide and as far apart as on the page."""

from io import BytesIO

import pymupdf
import pytest
from docx import Document
from docx.oxml.ns import qn

from ai_translation.domain.file_tools import pdf_to_docx


def _convert(pdf: pymupdf.Document):
    return Document(BytesIO(pdf_to_docx(pdf.tobytes())))


def _runs(doc) -> dict[str, object]:
    """The run properties of each run, by the run's text."""
    runs = {}
    for run in doc.element.body.iter(qn("w:r")):
        if text := "".join(t.text or "" for t in run.iter(qn("w:t"))).strip():
            runs[text] = run.find(qn("w:rPr"))
    return runs


def _value(properties, tag: str) -> int | None:
    element = properties.find(qn(tag)) if properties is not None else None
    return int(element.get(qn("w:val"))) if element is not None else None


def _append_content(pdf: pymupdf.Document, page: pymupdf.Page, content: str) -> None:
    """Draw with raw PDF operators, in the Helvetica an earlier insert_text registered."""
    xref = page.get_contents()[0]
    pdf.update_stream(xref, pdf.xref_stream(xref) + f"\n{content}\n".encode())


def test_spaces_drawn_as_their_own_spans_are_kept():
    # Word writes justified text as word, spaces, word; pdf2docx drops the spaces.
    pdf = pymupdf.open()
    page = pdf.new_page()
    x = 72.0
    for word in ("TERMASUK", "KUNJUNGAN", "TOKO"):
        page.insert_text((x, 100), word, fontsize=10)
        x += pymupdf.get_text_length(word, fontsize=10)
        page.insert_text((x, 100), "  ", fontsize=13)
        x += pymupdf.get_text_length("  ", fontsize=13)

    doc = _convert(pdf)

    text = "".join(t.text or "" for t in doc.element.body.iter(qn("w:t")))
    assert text.split() == ["TERMASUK", "KUNJUNGAN", "TOKO"]


def test_letters_close_together_are_not_split():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 100), "Tog", fontsize=11)
    page.insert_text((72 + pymupdf.get_text_length("Tog", fontsize=11), 100), "ether", fontsize=12)

    doc = _convert(pdf)

    assert "".join(t.text or "" for t in doc.element.body.iter(qn("w:t"))).strip() == "Together"


def test_text_set_tighter_than_its_font_is_condensed():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 100), "Plain text at the natural width of its font", fontsize=11)
    text = "Text set tighter than its font with character spacing"
    _append_content(pdf, page, f"BT /helv 11 Tf -0.4 Tc 1 0 0 1 72 650 Tm ({text}) Tj ET")

    runs = _runs(_convert(pdf))

    # -0.4 pt per character, in twentieths of a point.
    assert _value(runs[text], "w:spacing") == -8
    assert _value(runs["Plain text at the natural width of its font"], "w:spacing") is None


def test_text_set_wider_by_justification_is_left_to_the_reader():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 100), "x", fontsize=11)
    text = "Text spread out as justification does it"
    _append_content(pdf, page, f"BT /helv 11 Tf 0.6 Tc 1 0 0 1 72 650 Tm ({text}) Tj ET")

    runs = _runs(_convert(pdf))

    assert _value(runs[text], "w:spacing") is None


def test_squeezed_text_is_scaled_to_the_width_it_has_on_the_page():
    pdf = pymupdf.open()
    page = pdf.new_page()
    squeezed = "Squeezed text drawn at eighty percent width"
    page.insert_text((72, 100), squeezed, fontsize=12, morph=(pymupdf.Point(72, 100), pymupdf.Matrix(0.8, 1)))
    page.insert_text((72, 130), "Normal text at full width", fontsize=12)

    runs = _runs(_convert(pdf))

    size = _value(runs[squeezed], "w:sz") / 2
    scale = _value(runs[squeezed], "w:w") / 100
    assert size * scale == pytest.approx(12 * 0.8, rel=0.02)
    assert _value(runs["Normal text at full width"], "w:w") is None


def test_run_properties_are_in_schema_order():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 100), "x", fontsize=11)
    _append_content(pdf, page, "BT /helv 11 Tf -0.4 Tc 1 0 0 1 72 650 Tm (Condensed and in order) Tj ET")

    properties = _runs(_convert(pdf))["Condensed and in order"]

    tags = [child.tag.split("}")[1] for child in properties]
    assert tags.index("rFonts") < tags.index("color") < tags.index("spacing") < tags.index("sz")


def test_wrapping_paragraph_leaves_its_lines_a_little_room():
    pdf = pymupdf.open()
    page = pdf.new_page()
    lines = [
        "The first line of a paragraph that wraps at the right edge of the",
        "block, as a word processor lays it out, and a second line that is",
        "as long as the first so that the paragraph ends with a short line.",
        "Short last line.",
    ]
    for number, line in enumerate(lines):
        page.insert_text((72, 100 + 14 * number), line, fontsize=11)
    widest = max(pymupdf.get_text_length(line, fontsize=11) for line in lines[:3])

    doc = _convert(pdf)

    paragraph = next(p for p in doc.paragraphs if p.text.startswith("The first line"))
    section = doc.sections[0]
    right_edge = section.page_width.pt - section.right_margin.pt - paragraph.paragraph_format.right_indent.pt
    room = right_edge - (72 + widest)
    # Enough for a slightly wider font, too little for another word.
    assert 0 < room < 0.02 * widest


def test_unicode_text_in_a_symbol_font_takes_the_document_font():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 100), "·", fontsize=11, fontname="symb")
    page.insert_text((90, 100), "Bullet item text", fontsize=11)

    runs = _runs(_convert(pdf))

    assert runs["·"] is None or runs["·"].find(qn("w:rFonts")) is None
    assert runs["Bullet item text"].find(qn("w:rFonts")) is not None
