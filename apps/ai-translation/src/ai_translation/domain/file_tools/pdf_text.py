"""
Keep the words of a PDF as wide and as far apart as they are on the page.

PDFs made by Word often draw each word and each space as its own span, most
of all in justified text. pdf2docx discards spans holding only blanks, so the
words of such lines run together ("TERMASUKKUNJUNGANTOKO"). The gap each lost
space leaves between two spans of a line is still there, and a space is added
wherever it is wide enough to have held one.

Such PDFs also often set text tighter than its font's natural width. pdf2docx
writes it at the natural width, so lines grow longer than on the page and wrap
early; the tightening is measured and written as character spacing. Text the
PDF squeezes horizontally (Word's character scale) is reported by PyMuPDF at a
size between its height and its width, and gets the scaling that gives it the
width it has on the page.

A paragraph's lines wrap where they do on the page only while its right indent
leaves each line a little room, and too little for the next line's first word.
pdf2docx rounds the indent of left-aligned text down to a tenth of an inch,
which leaves anything from none of it to a whole word; the indent is set to
leave a small share of the line instead, kept well short of that next word.
For justified text that is measured without the stretch of its spaces, as Word
sets a line before justifying it.
"""

import math
from collections.abc import Iterator
from itertools import pairwise

from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Pt
from pdf2docx.common.share import TextAlignment
from pdf2docx.text.Char import Char
from pdf2docx.text.TextSpan import TextSpan

from .pdf_links import _lines

# Condensing below this many points per character is not worth writing.
_MIN_CONDENSE = 0.05

# Text squeezed or stretched less than this share keeps its natural width.
_MIN_SCALE_CHANGE = 0.03

# Room a wrapping line is given past its width on the page, as a share of the
# paragraph's width: enough for font sizes rounded to half points...
_WRAP_ROOM = 0.01
# ...and at most this share of the room the next line's first word lacks.
_WRAP_ROOM_OF_NEXT_WORD = 0.5
# Width of a space, as a share of the font size; no common font's is narrower.
_SPACE_WIDTH = 0.25

# Two spans are separate words when the gap between them is at least this
# share of the font size; letters and kerning sit much closer.
_MIN_SPACE = 0.15


def restore_spaces(page) -> None:
    """Add the missing spaces between the words of a parsed pdf2docx page."""
    for line in _lines(page):
        if not line.is_horizontal_text:
            continue
        for left, right in pairwise(line.spans):
            if not (isinstance(left, TextSpan) and isinstance(right, TextSpan) and left.chars and right.chars):
                continue
            if left.chars[-1].c.isspace() or right.chars[0].c.isspace():
                continue
            gap = right.bbox.x0 - left.bbox.x1
            if gap < _MIN_SPACE * max(left.size, right.size):
                continue
            last = left.chars[-1]
            # As wide as a space is, not as the gap: the gap can also hold the
            # stretch of justified text.
            width = min(gap, _SPACE_WIDTH * left.size)
            box = (last.bbox.x1, last.bbox.y0, last.bbox.x1 + width, last.bbox.y1)
            origin_y = last.origin[1] if last.origin is not None else last.bbox.y1
            left.chars.append(Char({"c": " ", "bbox": box, "origin": (last.bbox.x1, origin_y)}))


def match_char_spacing(page) -> None:
    """Condense the spans of a parsed pdf2docx page that the PDF sets tighter than their font."""
    for line in _lines(page):
        if not line.is_horizontal_text:
            continue
        for span in line.spans:
            if not isinstance(span, TextSpan) or span.char_spacing or len(span.chars) < 2:
                continue
            # A character's box is as wide as its font makes it; the distance
            # between characters also holds the spacing the PDF adds.
            natural = sum(char.bbox.width for char in span.chars)
            drawn = span.chars[-1].bbox.x1 - span.chars[0].bbox.x0
            spacing = (drawn - natural) / len(span.chars)
            # Wider spacing comes from justification, which Word adds itself.
            if spacing <= -_MIN_CONDENSE:
                span.char_spacing = round(spacing, 2)


def loosen_right_indents(page) -> None:
    """Give the wrapping lines of a parsed pdf2docx page's paragraphs a little room."""
    for block in _text_blocks(page):
        if block.alignment in (TextAlignment.LEFT, TextAlignment.JUSTIFY) and block.row_count > 1:
            room = min(_WRAP_ROOM * block.bbox.width, _WRAP_ROOM_OF_NEXT_WORD * _next_word_lack(block))
            _set_right_indent(block, max(block.right_space - max(room, 0), 0))


def _next_word_lack(block) -> float:
    """How much wider than the paragraph each wrapping row would get with the next row's first word, at least."""
    rows = block.lines.group_by_physical_rows()
    lacks = [float("inf")]
    for row, following in pairwise(rows):
        if any(line.line_break for line in row):
            continue
        word = _first_word(following)
        if word is None:
            continue
        width, size = word
        lacks.append(_set_end(row) + _SPACE_WIDTH * size + width - block.bbox.x1)
    return min(lacks)


def _set_end(row) -> float:
    """Where a row of lines ends as Word sets it: its characters at their own width and spacing."""
    # Lines of one row are apart by tab stops; the last one starts at its own.
    last = max(row, key=lambda line: line.bbox.x0)
    end = last.bbox.x0
    for span in last.spans:
        if isinstance(span, TextSpan):
            end += sum(char.bbox.width for char in span.chars) + span.char_spacing * len(span.chars)
        else:
            end += span.bbox.width
    return end


def _first_word(row) -> tuple[float, float] | None:
    """Width and font size of the first word of a row of lines."""
    width, size = 0.0, None
    for line in row:
        for span in line.spans:
            if not isinstance(span, TextSpan):
                continue
            for char in span.chars:
                if char.c.isspace():
                    if size is not None:
                        return width, size
                    continue
                width += char.bbox.width
                size = size or span.size
    return (width, size) if size is not None else None


def _set_right_indent(block, indent: float) -> None:
    make_docx = block.make_docx

    def wrapped(paragraph, *args, **kwargs):
        result = make_docx(paragraph, *args, **kwargs)
        paragraph.paragraph_format.right_indent = Pt(indent)
        return result

    block.make_docx = wrapped


def _text_blocks(page) -> Iterator:
    for section in page.sections:
        for column in section:
            yield from _blocks(column.blocks)


def _blocks(blocks) -> Iterator:
    for block in blocks:
        if block.is_table_block:
            for row in block:
                for cell in row:
                    if cell is not None:
                        yield from _blocks(cell.blocks)
        elif block.is_text_block:
            yield block


def match_char_scaling(page) -> None:
    """Scale the spans of a parsed pdf2docx page that the PDF draws narrower or wider than tall."""
    for line in _lines(page):
        if not line.is_horizontal_text:
            continue
        for span in line.spans:
            if isinstance(span, TextSpan) and span.chars and span.ascender > span.descender:
                scale = _horizontal_scale(span)
                if abs(scale - 1) >= _MIN_SCALE_CHANGE:
                    _set_char_scaling(span, scale)


def _horizontal_scale(span) -> float:
    """
    Width over height of a span's glyphs. PyMuPDF gives the size as the square
    root of both scales and a glyph's box the font's height at the vertical one.
    """
    height = span.chars[0].bbox.height / (span.ascender - span.descender)
    return (span.size / height) ** 2 if height > 0 else 1.0


def _set_char_scaling(span, scale: float) -> None:
    # Keeping the size and scaling by the square root gives the drawn width.
    set_text_format = span._set_text_format

    def wrapped(run):
        set_text_format(run)
        # pdf2docx rounds the size to half points and scales for the rest.
        written = round(span.size * 2) / 2 or span.size
        properties = run._r.get_or_add_rPr()
        for old in properties.findall(qn("w:w")):
            properties.remove(old)
        percent = round(100 * span.size / written * math.sqrt(scale))
        properties.append(parse_xml(f'<w:w {nsdecls("w")} w:val="{percent}"/>'))

    span._set_text_format = wrapped
