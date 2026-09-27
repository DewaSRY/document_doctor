"""
Turn the side-by-side regions pdf2docx writes as section columns into tables.

pdf2docx lays out a region with two columns (a logo beside a logo, text beside
a photo) as a two-column section: the first column's content, a continuous
section break, the second column's content, then a break that starts the next
column. Word follows that, but LibreOffice and Google Docs do not: they drop
the column break, so the second column is pushed down or onto another page and
images go missing. A borderless table with one cell per column looks the same
in every reader, so each such region is rewritten as one.
"""

from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn

_NO_BORDERS = "".join(f'<w:{side} w:val="nil"/>' for side in ("top", "left", "bottom", "right", "insideH", "insideV"))
_NO_MARGINS = "".join(f'<w:{side} w:w="0" w:type="dxa"/>' for side in ("top", "left", "bottom", "right"))


def columns_to_tables(body) -> None:
    """Rewrite each two-column region of the document body as a table."""
    elements = list(body)
    breaks = [i for i, element in enumerate(elements) if _section(element) is not None]
    for previous, first, second in zip([-1, *breaks], breaks, breaks[1:]):
        first_break, second_break = elements[first], elements[second]
        widths = _column_widths(_section(first_break))
        # pdf2docx writes at most two columns.
        if _type(_section(second_break)) != "nextColumn" or widths is None or len(widths) != 2:
            continue
        left, right = elements[previous + 1 : first], elements[first + 1 : second]
        table = _table(widths)
        first_break.addprevious(table)
        left_cell, right_cell = table.iter(qn("w:tc"))
        for cell, content in ((left_cell, left), (right_cell, right)):
            for element in content:
                cell.append(element)
        # The space set on the second break is measured from the end of the
        # second column, where Word shows that break.
        if second_break.tag == qn("w:p"):
            right_cell.append(_spacer(_take_space(second_break)))
        for cell in (left_cell, right_cell):
            if len(cell) == 1 or cell[-1].tag != qn("w:p"):
                # A cell has to end with a paragraph.
                cell.append(_spacer(0))

        # The region now fits in one column; the second break keeps the page
        # setup, starting where the first did.
        second_section = _section(second_break)
        _set_type(second_section, _type(_section(first_break)))
        second_section.replace(second_section.find(qn("w:cols")), parse_xml(f'<w:cols {nsdecls("w")} w:space="720"/>'))
        body.remove(first_break)


def merge_sections(body) -> None:
    """
    Join each section into the next one where no break separates them, and turn
    the paragraphs that held the breaks into plain spacing.

    pdf2docx ends every region of a page with a continuous section break and
    sets the space below the region on the paragraph holding the break. Readers
    other than Word do not show such paragraphs, so the space is lost; once the
    columns are tables, the breaks separate nothing and can go.
    """
    holders = [p for p in body.iterchildren(qn("w:p")) if _section(p) is not None]
    for holder, following in zip(holders, [*holders[1:], None]):
        current = _section(holder)
        after = _section(following) if following is not None else body.find(qn("w:sectPr"))
        if after is None or _type(after) != "continuous" or not _same_layout(current, after):
            continue
        # The joined section starts where the first one did.
        _set_type(after, _type(current))
        current.getparent().remove(current)
        _to_spacer(holder)


def _same_layout(first, second) -> bool:
    """Whether two sections have the same page setup and both a single column."""

    def page(section) -> list[dict]:
        parts = (section.find(qn(tag)) for tag in ("w:pgSz", "w:pgMar"))
        return [dict(part.attrib) if part is not None else {} for part in parts]

    return page(first) == page(second) and _column_widths(first) is None and _column_widths(second) is None


# Height of the line a spacer paragraph keeps, in twips.
_SPACER_LINE = 20


def _to_spacer(paragraph) -> None:
    """Make an empty break paragraph take only the space set around it, or none."""
    if any(child.tag != qn("w:pPr") for child in paragraph):
        return
    space = _take_space(paragraph)
    if space > _SPACER_LINE:
        paragraph.addprevious(_spacer(space))
    paragraph.getparent().remove(paragraph)


def _take_space(paragraph) -> int:
    """Remove the space set before and after a paragraph and return it, in twips."""
    spacing = paragraph.find(f"{qn('w:pPr')}/{qn('w:spacing')}")
    if spacing is None:
        return 0
    spacing.getparent().remove(spacing)
    return sum(round(float(spacing.get(qn(f"w:{side}"), 0))) for side in ("before", "after"))


def _spacer(space: int):
    """An empty paragraph `space` twips tall, or as short as it can be."""
    after = max(space - _SPACER_LINE, 0)
    return parse_xml(
        f'<w:p {nsdecls("w")}><w:pPr>'
        f'<w:spacing w:before="0" w:after="{after}" w:line="{_SPACER_LINE}" w:lineRule="exact"/>'
        '<w:rPr><w:sz w:val="2"/></w:rPr>'
        "</w:pPr></w:p>"
    )


def _section(element):
    """The settings of the section `element` ends, if it ends one: a paragraph or the body's last settings."""
    if element.tag == qn("w:sectPr"):
        return element
    if element.tag != qn("w:p"):
        return None
    return element.find(f"{qn('w:pPr')}/{qn('w:sectPr')}")


def _type(section) -> str | None:
    start = section.find(qn("w:type"))
    return start.get(qn("w:val")) if start is not None else None


def _set_type(section, value: str | None) -> None:
    start = section.find(qn("w:type"))
    if value is None:
        if start is not None:
            section.remove(start)
        return
    if start is None:
        start = parse_xml(f'<w:type {nsdecls("w")}/>')
        section.insert(0, start)
    start.set(qn("w:val"), value)


def _column_widths(section) -> list[int] | None:
    """Width of each column with the space after it, in twips, for two or more columns."""
    columns = section.find(qn("w:cols"))
    if columns is None:
        return None
    widths = [round(float(col.get(qn("w:w"), 0))) + round(float(col.get(qn("w:space"), 0))) for col in columns]
    return widths if len(widths) >= 2 and all(widths) else None


def _table(widths: list[int]):
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    cells = "".join(
        f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/><w:tcMar>{_NO_MARGINS}</w:tcMar></w:tcPr></w:tc>'
        for width in widths
    )
    return parse_xml(
        f'<w:tbl {nsdecls("w")}>'
        "<w:tblPr>"
        f'<w:tblW w:w="{sum(widths)}" w:type="dxa"/>'
        '<w:tblInd w:w="0" w:type="dxa"/>'
        f"<w:tblBorders>{_NO_BORDERS}</w:tblBorders>"
        '<w:tblLayout w:type="fixed"/>'
        f"<w:tblCellMar>{_NO_MARGINS}</w:tblCellMar>"
        '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>'
        "</w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        # Keep the columns side by side on one page.
        f"<w:tr><w:trPr><w:cantSplit/></w:trPr>{cells}</w:tr>"
        "</w:tbl>"
    )
