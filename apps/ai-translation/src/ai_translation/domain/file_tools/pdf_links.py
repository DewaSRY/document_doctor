"""
Carry a PDF's links over to the Word document pdf2docx rebuilds from it.

pdf2docx only keeps links to web addresses, never on images, and misses some
depending on the order of the text on the page. This module reads every link
annotation itself and, on the layout pdf2docx parsed, attaches each one to the
characters and images it covers, so the Word document gets a real hyperlink
over exactly the same text: external links to their address, links within the
document to a bookmark at their target.
"""

import itertools
import logging
from collections.abc import Callable, Iterator
from dataclasses import dataclass

import pymupdf
from docx.document import Document
from docx.opc.constants import RELATIONSHIP_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from pdf2docx.common.share import RectType
from pdf2docx.image.ImageSpan import ImageSpan
from pdf2docx.text.TextSpan import TextSpan

logger = logging.getLogger(__name__)

# How far outside a link's area a character's center may be and still belong
# to it, as a share of the character's height: link areas are often drawn
# tight around the glyphs, a little shorter than the line.
_CHAR_TOLERANCE = 0.2
# Share of an image a link must cover to apply to the whole image.
_IMAGE_COVERAGE = 0.5
# How far above a link's target position the targeted line may start.
_TARGET_TOLERANCE = 2.0


@dataclass(frozen=True)
class PdfLink:
    """A clickable area of a page, in the page coordinates pdf2docx uses."""

    areas: tuple[pymupdf.Rect, ...]
    uri: str | None = None
    # Target of a link within the document: 0-based page and, when the link
    # names one, the vertical position on it.
    page: int | None = None
    y: float | None = None

    @property
    def target(self) -> tuple[int, float | None] | None:
        return (self.page, self.y) if self.page is not None else None


def read_links(page: pymupdf.Page) -> list[PdfLink]:
    """Every link of the page that points somewhere a Word document can link to."""
    links: list[PdfLink] = []
    for link in page.get_links():
        areas = _link_areas(page, link)
        kind = link["kind"]
        if kind == pymupdf.LINK_URI and link.get("uri"):
            links.append(PdfLink(areas, uri=link["uri"]))
        elif kind in (pymupdf.LINK_GOTOR, pymupdf.LINK_LAUNCH) and link.get("file"):
            links.append(PdfLink(areas, uri=link["file"]))
        elif kind in (pymupdf.LINK_GOTO, pymupdf.LINK_NAMED) and (target := _internal_target(page, link)):
            links.append(PdfLink(areas, page=target[0], y=target[1]))
    return links


def _link_areas(page: pymupdf.Page, link: dict) -> tuple[pymupdf.Rect, ...]:
    """
    The link's clickable areas. A link over text that wraps can be one
    rectangle around every line it touches, with QuadPoints marking the part
    of each line that is actually linked.
    """
    rect = pymupdf.Rect(link["from"])
    kind, value = page.parent.xref_get_key(link["xref"], "QuadPoints") if link.get("xref") else ("null", "")
    if kind != "array":
        return (rect,)

    try:
        numbers = [float(n) for n in value.strip("[]").split()]
    except ValueError:
        return (rect,)
    # QuadPoints are in PDF space: bottom-up and unrotated.
    to_page = page.transformation_matrix * page.rotation_matrix
    areas = []
    for i in range(0, len(numbers) - len(numbers) % 8, 8):
        quad = numbers[i : i + 8]
        points = [pymupdf.Point(quad[j], quad[j + 1]) * to_page for j in range(0, 8, 2)]
        area = pymupdf.Rect(points[0], points[0])
        for point in points[1:]:
            area.include_point(point)
        if not area.is_empty and area.intersects(rect + (-1, -1, 1, 1)):
            areas.append(area)
    return tuple(areas) or (rect,)


def _internal_target(page: pymupdf.Page, link: dict) -> tuple[int, float | None] | None:
    doc = page.parent
    number, point = link.get("page", -1), link.get("to")
    if (number is None or number < 0) and link.get("nameddest"):
        try:
            destination = doc.resolve_names().get(link["nameddest"], {})
        except (RuntimeError, ValueError):
            destination = {}
        number, point = destination.get("page", -1), destination.get("to")
    if number is None or not 0 <= number < doc.page_count:
        return None
    if not point:
        return number, None
    # The target position is on the unrotated target page.
    y = (pymupdf.Point(point) * doc[number].rotation_matrix).y
    return number, max(y, 0.0) or None


class PdfLinks:
    """
    Attaches a PDF's links to the pdf2docx layout of its pages before the
    Word document is made, then gives link targets their bookmarks.
    """

    def __init__(self, pdf: pymupdf.Document):
        self._pdf = pdf
        self._bookmarks: dict[tuple[int, float | None], str] = {}
        self._placed: set[str] = set()

    def apply(self, page) -> None:
        """Attach the links of a parsed pdf2docx page to its text and images."""
        _drop_pdf2docx_links(page)
        links = read_links(self._pdf[page.id])
        used: set[int] = set()
        for line in _lines(page):
            _link_line(line, links, used, self._write_link)
        for image in _float_images(page):
            if (link := _link_over(image.bbox, links)) is not None:
                used.add(id(link))
                _around_make_docx(image, after=lambda p, new, link=link: self._write_link(p, new, link))
        for link in links:
            if id(link) in used and link.target is not None:
                self._bookmark_name(link.target)
        if missed := len(links) - len(used):
            logger.debug("%d link(s) on PDF page %d cover no text or image", missed, page.id + 1)

    def place_bookmarks(self, pages: list) -> None:
        """
        Put a bookmark where each link within the document points: before the
        first line at or below its target position. Must run after every page
        has been given its links and before the Word document is made.
        """
        by_id = {page.id: page for page in pages if page.finalized}
        for (number, y), name in self._bookmarks.items():
            page = by_id.get(number)
            line = next(
                (
                    line
                    for line in (_lines(page) if page else ())
                    if y is None or line.bbox.y1 >= y - _TARGET_TOLERANCE
                ),
                None,
            )
            if line is not None:
                _around_make_docx(line, before=lambda p, name=name: self._add_bookmark(p, name))

    def finish(self, doc: Document, page_starts: dict[int, Paragraph]) -> None:
        """
        Bookmark the first paragraph of each targeted page whose target line
        could not be found, such as a page kept as a picture, then join the
        pieces of a link that pdf2docx wrote as separate runs.
        """
        for (number, _), name in self._bookmarks.items():
            if name not in self._placed and (paragraph := page_starts.get(number)) is not None:
                self._add_bookmark(paragraph, name, at_start=True)
        _merge_adjacent_hyperlinks(doc)

    def _bookmark_name(self, target: tuple[int, float | None]) -> str:
        if target not in self._bookmarks:
            # Word hides bookmarks whose name starts with an underscore.
            self._bookmarks[target] = f"_PdfLink{len(self._bookmarks) + 1}"
        return self._bookmarks[target]

    def _write_link(self, paragraph: Paragraph, new: list, link: PdfLink) -> None:
        """Wrap the runs just written for a span or image in a hyperlink."""
        runs = [element for element in new if element.tag == qn("w:r")]
        if not runs:
            return
        hyperlink = OxmlElement("w:hyperlink")
        relation = None
        if link.uri is not None:
            relation = paragraph.part.relate_to(link.uri, RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
            hyperlink.set(qn("r:id"), relation)
        elif link.target is not None:
            hyperlink.set(qn("w:anchor"), self._bookmark_name(link.target))
        else:
            return
        hyperlink.set(qn("w:history"), "1")
        runs[0].addprevious(hyperlink)
        for run in runs:
            hyperlink.append(run)
            # Word only follows a click on a picture through the picture's own link.
            for properties in run.iter(qn("wp:docPr")):
                if relation is not None:
                    click = OxmlElement("a:hlinkClick")
                    click.set(qn("r:id"), relation)
                    properties.insert(0, click)

    def _add_bookmark(self, paragraph: Paragraph, name: str, at_start: bool = False) -> None:
        if name in self._placed:
            return
        self._placed.add(name)
        bookmark_id = str(len(self._placed))
        start, end = OxmlElement("w:bookmarkStart"), OxmlElement("w:bookmarkEnd")
        start.set(qn("w:id"), bookmark_id)
        start.set(qn("w:name"), name)
        end.set(qn("w:id"), bookmark_id)
        p = paragraph._p
        if at_start:
            position = 1 if p.pPr is not None else 0
            p.insert(position, end)
            p.insert(position, start)
        else:
            p.append(start)
            p.append(end)


def _drop_pdf2docx_links(page) -> None:
    """Remove the links pdf2docx attached itself, which PdfLinks replaces."""
    for line in _lines(page):
        for span in line.spans:
            if isinstance(span, TextSpan):
                span.style = [style for style in span.style if style.get("type") != RectType.HYPERLINK.value]


def _lines(page) -> Iterator:
    """Every text line of a parsed page in document order, table cells included."""
    for section in page.sections:
        for column in section:
            yield from _block_lines(column.blocks)


def _block_lines(blocks) -> Iterator:
    for block in blocks:
        if block.is_table_block:
            for row in block:
                for cell in row:
                    if cell is not None:
                        yield from _block_lines(cell.blocks)
        elif block.is_text_image_block:
            yield from block.lines


def _float_images(page) -> Iterator:
    # pdf2docx writes every floating image of a page from this list.
    yield from page.float_images


def _link_line(line, links: list[PdfLink], used: set[int], write: Callable) -> None:
    """Split the line's spans where a link starts or ends and attach each link."""
    if not links:
        return
    text_spans = [span for span in line.spans if isinstance(span, TextSpan) and span.chars]
    chars = [char for span in text_spans for char in span.chars]
    found = _bridge_spaces(chars, [_link_at(char, links) for char in chars])
    used.update(id(link) for link in found if link is not None)
    found_by_span = iter(found)

    spans = []
    for span in line.spans:
        if isinstance(span, ImageSpan):
            spans.append(span)
            if (link := _link_over(span.bbox, links)) is not None:
                used.add(id(link))
                _around_make_docx(span, after=lambda p, new, link=link: write(p, new, link))
            continue
        if not isinstance(span, TextSpan) or not span.chars:
            spans.append(span)
            continue

        pairs = [(char, next(found_by_span)) for char in span.chars]
        groups = [list(group) for _, group in itertools.groupby(pairs, lambda pair: _target_key(pair[1]))]
        for group in groups:
            part = span
            if len(groups) > 1:
                part = span.copy()
                part.chars = [char for char, _ in group]
                part.update_bbox(part.cal_bbox())
            spans.append(part)
            link = group[0][1]
            if link is not None and part.text:
                _around_make_docx(part, after=lambda p, new, link=link: write(p, new, link))
    line.spans.reset(spans)


def _target_key(link: PdfLink | None) -> tuple | None:
    return (link.uri, link.page, link.y) if link is not None else None


def _bridge_spaces(chars: list, found: list[PdfLink | None]) -> list[PdfLink | None]:
    """
    Give the spaces between two pieces of the same link to that link: some
    writers make a separate link area for each word of the linked text.
    """
    i = 0
    while i < len(chars):
        end = i
        while end < len(chars) and found[end] is None and not chars[end].c.strip():
            end += 1
        bridged = end > i > 0 and end < len(chars) and found[i - 1] is not None
        if bridged and _target_key(found[i - 1]) == _target_key(found[end]):
            found[i:end] = [found[i - 1]] * (end - i)
        i = max(end, i + 1)
    return found


def _link_at(char, links: list[PdfLink]) -> PdfLink | None:
    """The link whose area holds the character's center."""
    box = char.bbox
    center = pymupdf.Point((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2)
    margin = _CHAR_TOLERANCE * min(box.width, box.height)
    for link in links:
        if any(center in area + (-margin, -margin, margin, margin) for area in link.areas):
            return link
    return None


def _link_over(bbox: pymupdf.Rect, links: list[PdfLink]) -> PdfLink | None:
    """The link covering most of an image, if it covers enough of it."""
    area = abs(pymupdf.Rect(bbox))
    if not area:
        return None
    best, best_share = None, _IMAGE_COVERAGE
    for link in links:
        share = max(abs(pymupdf.Rect(bbox) & a) for a in link.areas) / area
        if share >= best_share:
            best, best_share = link, share
    return best


def _around_make_docx(element, before: Callable | None = None, after: Callable | None = None) -> None:
    """
    Run code around a layout element's make_docx(paragraph): `before` with the
    paragraph, `after` with the paragraph and the XML elements the element
    added to it.
    """
    make_docx = element.make_docx

    def wrapped(paragraph, *args, **kwargs):
        if before is not None:
            before(paragraph)
        # Keep the existing children referenced: lxml reuses the id of a
        # child's Python object once nothing refers to it.
        existing = list(paragraph._p)
        result = make_docx(paragraph, *args, **kwargs)
        if after is not None:
            seen = set(map(id, existing))
            after(paragraph, [child for child in paragraph._p if id(child) not in seen])
        return result

    element.make_docx = wrapped


def _merge_adjacent_hyperlinks(doc: Document) -> None:
    """Join hyperlinks that follow each other and point to the same place."""
    for hyperlink in list(doc.element.body.iter(qn("w:hyperlink"))):
        following = hyperlink.getnext()
        if hyperlink.getparent() is None or following is None or following.tag != qn("w:hyperlink"):
            continue
        if _hyperlink_target(hyperlink) == _hyperlink_target(following):
            for child in reversed(list(hyperlink)):
                following.insert(0, child)
            hyperlink.getparent().remove(hyperlink)


def _hyperlink_target(hyperlink) -> tuple[str | None, str | None]:
    return hyperlink.get(qn("r:id")), hyperlink.get(qn("w:anchor"))
