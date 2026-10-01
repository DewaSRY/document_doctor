import html
import itertools
import math
import re
import statistics
from dataclasses import dataclass, field
from functools import cache

import pymupdf

from .base import DocumentHandler

# Leading list markers ("-", "•", "1.", "a)") stay in the PDF; only the text after them is translated.
_LIST_MARKER = re.compile(
    r"\s*(?:[-–—•●○◦▪■□►▶➢➤✓✔*·]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+"
)
_SERIF_FONTS = (
    "times",
    "roman",
    "serif",
    "georgia",
    "garamond",
    "cambria",
    "palatino",
    "minion",
    "book",
)
_MONO_FONTS = ("courier", "mono", "consol", "menlo")


@dataclass
class _Line:
    """One visible, horizontal line of text, without its leading list marker."""

    block: int
    text: str
    rect: pymupdf.Rect  # area of the translatable text
    full_rect: pymupdf.Rect  # area of all visible characters, marker included
    baseline: float
    font_size: float
    color: int
    bold: bool
    italic: bool
    family: str
    first_word_width: float
    has_marker: bool
    align_right: bool = False


@dataclass
class _Segment:
    """A translatable piece of text on a page and the lines it occupies."""

    key: str
    page_num: int
    lines: list[_Line] = field(default_factory=list)
    line_height: float = 1.15  # distance between baselines, relative to the font size

    @property
    def text(self) -> str:
        text = self.lines[0].text
        for line in self.lines[1:]:
            # Undo hyphenation of words split over two lines.
            if re.search(r"[^\W\d_]-$", text) and line.text[:1].islower():
                text = f"{text[:-1]}{line.text}"
            else:
                text = f"{text} {line.text}"
        return text

    @property
    def style(self) -> _Line:
        return self.lines[0]

    @property
    def bbox(self) -> pymupdf.Rect:
        bbox = pymupdf.Rect(self.lines[0].rect)
        for line in self.lines[1:]:
            bbox |= line.rect
        return bbox


class _PageLayout:
    """
    The free space around text on a page.

    Everything visible (text, table borders, images) is an obstacle, so a translation
    may grow into empty space but never over other content or out of its table cell.
    """

    def __init__(self, page: pymupdf.Page, lines: list[_Line]):
        self.obstacles = [line.full_rect for line in lines]
        self.containers: list[pymupdf.Rect] = []
        shapes = [
            pymupdf.Rect(d["rect"])
            for d in page.get_drawings()
            if d.get("fill") or d.get("color")
        ]
        shapes += [pymupdf.Rect(info["bbox"]) for info in page.get_image_info()]
        for rect in shapes:
            # Hairlines have an empty rect; give them some thickness.
            if rect.width < 1 or rect.height < 1:
                rect = rect + (-0.5, -0.5, 0.5, 0.5)
            self.obstacles.append(rect)
            if rect.width > 5 and rect.height > 5:
                self.containers.append(rect)

        page_rect = page.rect
        if lines:
            text_left = min(line.full_rect.x0 for line in lines)
            self.text_right = max(line.full_rect.x1 for line in lines)
            text_bottom = max(line.full_rect.y1 for line in lines)
        else:
            text_left, self.text_right, text_bottom = (
                page_rect.x0,
                page_rect.x1,
                page_rect.y1,
            )
        # Assume symmetric page margins.
        self.area = pymupdf.Rect(
            min(text_left, page_rect.x1 - self.text_right),
            page_rect.y0,
            max(self.text_right, page_rect.x1 - text_left),
            max(text_bottom, page_rect.y1 - 36),
        )

    def bounds(self, rect: pymupdf.Rect) -> pymupdf.Rect:
        """The page area, or the smallest shape (e.g. a table cell) that encloses the text."""
        grown = rect + (-1, -1, 1, 1)
        enclosing = [c for c in self.containers if c.contains(grown)]
        container = min(enclosing, key=lambda c: c.width * c.height, default=None)
        return (
            pymupdf.Rect(self.area) & container
            if container
            else pymupdf.Rect(self.area)
        )

    def _beside(self, rect: pymupdf.Rect, ignore: set[int]) -> list[pymupdf.Rect]:
        band = rect.height * 0.25
        return [
            o
            for o in self.obstacles
            if id(o) not in ignore and o.y0 < rect.y1 - band and o.y1 > rect.y0 + band
        ]

    def right_limit(self, rect: pymupdf.Rect, ignore: set[int] = frozenset()) -> float:
        limits = [o.x0 for o in self._beside(rect, ignore) if o.x0 >= rect.x1 - 0.5]
        return min([self.bounds(rect).x1, *limits])

    def left_limit(self, rect: pymupdf.Rect, ignore: set[int] = frozenset()) -> float:
        limits = [o.x1 for o in self._beside(rect, ignore) if o.x1 <= rect.x0 + 0.5]
        return max([self.bounds(rect).x0, *limits])

    def bottom_limit(self, rect: pymupdf.Rect, ignore: set[int] = frozenset()) -> float:
        limits = [
            o.y0
            for o in self.obstacles
            if id(o) not in ignore
            and o.y0 >= rect.y1 - 0.5
            and o.x0 < rect.x1
            and o.x1 > rect.x0
        ]
        return min([self.bounds(rect).y1, *limits])


@dataclass
class _Placement:
    """Where and how a translation is written: the segment's own style, unless overridden."""

    segment: _Segment
    rect: pymupdf.Rect
    align: str
    text_indent: float
    font_size: float
    family: str
    bold: bool
    italic: bool
    color: int
    scale: float = 1.0
    # Formatting of ranges of the text, as sent by the editor.
    runs: list[dict] | None = None

    def apply_style(self, style: dict | None) -> None:
        """Apply a user's style override (see SegmentStyle in the REST schemas)."""
        if not style:
            return
        self.font_size = style.get("font_size", self.font_size)
        if style.get("family"):
            family = style["family"]
            self.family = (
                family
                if family in ("Helvetica", "Times", "Courier")
                else PDFHandler._font_family(family.lower(), 0)
            )
        self.bold = style.get("bold", self.bold)
        self.italic = style.get("italic", self.italic)
        if "color" in style:
            self.color = int(style["color"].lstrip("#"), 16)
        if "align" in style:
            self.align = style["align"]
            if self.align not in ("left", "justify"):
                self.text_indent = 0.0


class PDFHandler(DocumentHandler):
    """
    Handler for PDF documents.

    Text is extracted line by line (wrapped lines of one paragraph are merged),
    so every translation can be written back into the area of its source text,
    with the original font style, alignment and line spacing. When a translation
    is longer, it first grows into the free space around it and only then shrinks.
    Keys look like 'page_0_seg_3' and are stable between extraction and rebuild.
    """

    _HAS_LETTER = re.compile(r"[^\W\d_]")

    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract translatable text segments from the PDF."""
        with pymupdf.open(stream=file_content, filetype="pdf") as pdf_document:
            return {
                segment.key: self._segment_text(segment.text)
                for page in pdf_document
                for segment in self._page_segments(page)[0]
            }

    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
        styles: dict[str, dict] | None = None,
        runs: dict[str, list[dict]] | None = None,
        insertions: list[dict] | None = None,
        media: dict[str, bytes] | None = None,
    ) -> bytes:
        """Replace each source segment with its translation, keeping the layout.
        A PDF's pages are fixed, so blocks inserted in the editor do not apply."""
        styles = styles or {}
        runs = runs or {}
        with pymupdf.open(stream=file_content, filetype="pdf") as pdf_document:
            for page in pdf_document:
                # Layout is read before the original text is removed.
                segments, layout = self._page_segments(page)
                placements = [
                    self._place(segment, layout)
                    for segment in segments
                    if translations.get(segment.key, "").strip()
                ]
                if not placements:
                    continue
                for placement in placements:
                    placement.apply_style(styles.get(placement.segment.key))
                    placement.runs = runs.get(placement.segment.key)

                # Redaction deletes link annotations over the text; restore them afterwards.
                links = page.get_links()

                self._remove_text(page, [p.segment for p in placements])

                self._fit(placements, translations)
                for placement in placements:
                    self._write(page, placement, translations[placement.segment.key])

                self._restore_links(page, links)

            pdf_document.set_metadata(
                {
                    **(pdf_document.metadata or {}),
                    "subject": f"Translated from {source_language} to {target_language}",
                }
            )

            pdf_bytes = pdf_document.tobytes(
                garbage=4,
                deflate=True,
                clean=True,
            )
            return pdf_bytes

    def page_layouts(self, file_content: bytes) -> list[dict]:
        """
        Every page's size and, per segment, the area and style its translation is
        written with, in PDF points. The editor uses it to show each translation
        where the rebuilt PDF will have it.
        """
        pages = []
        with pymupdf.open(stream=file_content, filetype="pdf") as pdf_document:
            for page in pdf_document:
                segments, layout = self._page_segments(page)
                pages.append(
                    {
                        "page": page.number,
                        "width": round(page.rect.width, 2),
                        "height": round(page.rect.height, 2),
                        "segments": [
                            self._layout_entry(self._place(segment, layout))
                            for segment in segments
                        ],
                    }
                )
        return pages

    def render_page(
        self, file_content: bytes, page_num: int, zoom: float, with_text: bool
    ) -> bytes:
        """
        A PNG of one page. Without text, the translatable text is removed (as in the
        rebuild), leaving images, tables and untranslated text for the editor's background.
        """
        with pymupdf.open(stream=file_content, filetype="pdf") as pdf_document:
            if not 0 <= page_num < pdf_document.page_count:
                raise IndexError(page_num)
            page = pdf_document[page_num]
            if not with_text:
                segments, _ = self._page_segments(page)
                if segments:
                    self._remove_text(page, segments)
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            return pixmap.tobytes("png")

    @staticmethod
    def _layout_entry(placement: _Placement) -> dict:
        segment = placement.segment
        return {
            "key": segment.key,
            # The area the translation may fill, and the area of the source text.
            "rect": [round(v, 2) for v in placement.rect],
            "source_rect": [round(v, 2) for v in segment.bbox],
            "baseline": round(segment.style.baseline, 2),
            "baseline_ratio": round(
                _baseline_ratio(placement.family, round(segment.line_height, 2)), 4
            ),
            "line_count": len(segment.lines),
            "line_height": round(segment.line_height, 3),
            "text_indent": round(placement.text_indent, 2),
            "font_size": round(placement.font_size, 2),
            "family": placement.family,
            "bold": placement.bold,
            "italic": placement.italic,
            "color": f"#{placement.color:06x}",
            "align": placement.align,
        }

    @staticmethod
    def _remove_text(page: pymupdf.Page, segments: list[_Segment]) -> None:
        """
        Remove the segments' text only; keep images and table lines. The redaction
        covers the middle of each line, so tightly spaced neighbours are not touched.
        """
        for segment in segments:
            for line in segment.lines:
                band = line.rect.height * 0.3
                page.add_redact_annot(line.rect + (0, band, 0, -band), fill=False)
        page.apply_redactions(
            images=pymupdf.PDF_REDACT_IMAGE_NONE,
            graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
        )

    # ------------------------------------------------------------------ extraction

    @classmethod
    def _page_lines(cls, page: pymupdf.Page) -> list[_Line]:
        lines: list[_Line] = []
        text_dict = page.get_text("rawdict", flags=pymupdf.TEXTFLAGS_TEXT)

        for block_num, block in enumerate(text_dict.get("blocks", [])):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                # Rotated and vertical text is left as it is.
                dir_x, dir_y = line["dir"]
                if dir_x < 0.99 or abs(dir_y) > 0.01:
                    continue

                # Invisible text (e.g. the OCR layer of a scan) is not translated.
                chars = [
                    (char, span)
                    for span in line["spans"]
                    if span.get("alpha", 255) > 0
                    for char in span["chars"]
                ]
                visible = [
                    (index, char, span)
                    for index, (char, span) in enumerate(chars)
                    if not char["c"].isspace()
                ]
                if not visible:
                    continue

                marker = _LIST_MARKER.match("".join(char["c"] for char, _ in chars))
                start = marker.end() if marker else 0
                content = [entry for entry in visible if entry[0] >= start]
                if not content:
                    # The line is only a marker (or looks like one): keep it whole.
                    marker, content = None, visible

                groups: list[list[tuple[int, dict, dict]]] = []
                for entry in content:
                    if groups:
                        previous = groups[-1][-1]
                        gap = entry[1]["bbox"][0] - previous[1]["bbox"][2]
                        threshold = max(3.0, max(entry[2]["size"], previous[2]["size"]) * 1.5)
                        if gap > threshold:
                            groups.append([])
                    if not groups:
                        groups.append([])
                    groups[-1].append(entry)

                for group_index, group in enumerate(groups):
                    first_index, last_index = group[0][0], group[-1][0]
                    group_chars = [char for _, char, _ in group]
                    full_chars = group_chars
                    if marker and group_index == 0:
                        full_chars = [
                            char for index, char, _ in visible if index < start
                        ] + full_chars
                    text = " ".join(
                        "".join(char["c"] for char, _ in chars[first_index : last_index + 1]).split()
                    )
                    span = max(
                        {id(item[2]): item[2] for item in group}.values(),
                        key=lambda candidate: sum(1 for item in group if item[2] is candidate),
                    )
                    first_word = group[: len(text.split(" ", 1)[0])]
                    font = span["font"].lower()
                    lines.append(
                        _Line(
                            block=block_num,
                            text=text,
                            rect=cls._chars_rect(group_chars),
                            full_rect=cls._chars_rect(full_chars),
                            baseline=group[0][1]["origin"][1],
                            font_size=span["size"],
                            color=span["color"],
                            bold=bool(span["flags"] & pymupdf.TEXT_FONT_BOLD)
                            or any(
                                w in font for w in ("bold", "black", "heavy", "semibold")
                            ),
                            italic=bool(span["flags"] & pymupdf.TEXT_FONT_ITALIC)
                            or any(w in font for w in ("italic", "oblique")),
                            family=cls._font_family(font, span["flags"]),
                            first_word_width=first_word[-1][1]["bbox"][2]
                            - first_word[0][1]["bbox"][0],
                            has_marker=marker is not None and group_index == 0,
                            align_right=len(groups) > 1 and group_index == len(groups) - 1,
                        )
                    )
        return lines

    @staticmethod
    def _chars_rect(chars) -> pymupdf.Rect:
        rect = pymupdf.Rect()
        for char in chars:
            rect |= char["bbox"]
        return rect

    @staticmethod
    def _font_family(font: str, flags: int) -> str:
        """Pick a built-in font with the same metrics class as the original."""
        if flags & pymupdf.TEXT_FONT_MONOSPACED or any(w in font for w in _MONO_FONTS):
            return "Courier"
        if "sans" not in font and (
            flags & pymupdf.TEXT_FONT_SERIFED or any(w in font for w in _SERIF_FONTS)
        ):
            return "Times"
        return "Helvetica"

    def _page_segments(self, page: pymupdf.Page) -> tuple[list[_Segment], _PageLayout]:
        lines = self._page_lines(page)
        layout = _PageLayout(page, lines)

        segments: list[_Segment] = []
        for line in lines:
            current = segments[-1] if segments else None
            if current is not None and self._continues_paragraph(current, line, layout):
                current.lines.append(line)
            else:
                segments.append(
                    _Segment(
                        key=f"page_{page.number}_seg_{len(segments)}",
                        page_num=page.number,
                        lines=[line],
                    )
                )

        # Line spacing is learned from wrapped paragraphs only: the distance between
        # separate list items or table rows includes paragraph spacing.
        spacing: dict[int, list[float]] = {}
        for segment in segments:
            baselines = [line.baseline for line in segment.lines]
            spacing.setdefault(round(segment.style.font_size), []).extend(
                (b - a) / segment.style.font_size
                for a, b in itertools.pairwise(baselines)
            )
        for segment in segments:
            ratios = spacing.get(round(segment.style.font_size))
            if ratios:
                segment.line_height = min(max(statistics.median(ratios), 1.0), 2.0)

        return [s for s in segments if self._HAS_LETTER.search(s.text)], layout

    @staticmethod
    def _continues_paragraph(
        segment: _Segment, line: _Line, layout: _PageLayout
    ) -> bool:
        """A line continues the segment when it has the same style and the previous line wrapped."""
        previous = segment.lines[-1]
        if line.block != previous.block or line.has_marker:
            return False
        if abs(line.font_size - previous.font_size) > 0.6 or line.bold != previous.bold:
            return False

        height = previous.rect.height
        gap = line.rect.y0 - previous.rect.y1
        if (
            not (-0.3 * height <= gap <= 0.6 * height)
            or line.baseline <= previous.baseline
        ):
            return False

        # Continuation lines start where the previous one did (a first-line indent is allowed).
        start = segment.lines[1].rect.x0 if len(segment.lines) > 1 else previous.rect.x0
        indented = (
            len(segment.lines) == 1
            and 0 < previous.rect.x0 - line.rect.x0 <= 4 * line.font_size
        )
        if abs(line.rect.x0 - start) >= 3 and not indented:
            return False

        # The previous line wrapped if the first word of this line would not have fit behind it.
        right = min(layout.right_limit(previous.rect), layout.text_right)
        space = previous.font_size * 0.25
        return previous.rect.x1 + space + line.first_word_width > right

    # ------------------------------------------------------------------ rebuild

    @staticmethod
    def _place(segment: _Segment, layout: _PageLayout) -> _Placement:
        """Find the area a translation may fill: the source area plus the free space around it."""
        bbox = segment.bbox
        style = segment.style
        size = style.font_size
        own = {id(line.full_rect) for line in segment.lines}
        pad = size * 0.2

        left = layout.left_limit(bbox, own)
        right = layout.right_limit(bbox, own)
        bounds = layout.bounds(bbox)
        # Keep a small distance to neighbouring content, but never less room than the original.
        if right < bounds.x1:
            right = max(right - pad, bbox.x1)
        if left > bounds.x0:
            left = min(left + pad, bbox.x0)

        tolerance = max(3.0, size * 0.35)
        centers = [(line.rect.x0 + line.rect.x1) / 2 for line in segment.lines]
        ends = [line.rect.x1 for line in segment.lines[:-1]]
        if (
            all(abs(c - (left + right) / 2) <= tolerance for c in centers)
            and bbox.x0 - left > size
        ):
            align = "center"
            half = max(
                min(bbox.x0 + bbox.width / 2 - left, right - bbox.x0 - bbox.width / 2),
                bbox.width / 2,
            )
            center = bbox.x0 + bbox.width / 2
            x0, x1 = center - half, center + half
        elif (
            len(segment.lines) == 1
            and (
                segment.style.align_right
                or (
                    abs(layout.text_right - bbox.x1) <= tolerance
                    and bbox.x0 - bounds.x0 > (bounds.x1 - bounds.x0) * 0.4
                )
            )
        ):
            align = "right"
            x0, x1 = left, bbox.x1
        else:
            align = (
                "justify" if len(ends) >= 2 and max(ends) - min(ends) <= 1.5 else "left"
            )
            # Every paragraph may grow into the free space beside it (right_limit
            # already stops at real neighbours), not just its original column.
            x1 = max(right, bbox.x1)
            x0 = bbox.x0

        bottom = layout.bottom_limit(pymupdf.Rect(x0, bbox.y0, x1, bbox.y1), own)
        y1 = max(bbox.y1, bottom - pad)
        text_indent = style.rect.x0 - bbox.x0 if align in ("left", "justify") else 0.0
        return _Placement(
            segment,
            pymupdf.Rect(x0, bbox.y0, x1, y1),
            align,
            text_indent,
            font_size=style.font_size,
            family=style.family,
            bold=style.bold,
            italic=style.italic,
            color=style.color,
        )

    @classmethod
    def _fit(cls, placements: list[_Placement], translations: dict[str, str]) -> None:
        """
        Find the font scale each translation needs to fit its area. Segments stacked in
        one column of a block (list items, a table column) with the same font size
        share the smallest scale, so their text keeps a uniform size.
        """
        groups: dict[tuple[int, int, int], list[_Placement]] = {}
        for placement in placements:
            segment = placement.segment
            rect = cls._text_rect(placement, 1.0)
            story = pymupdf.Story(
                cls._html(placement, translations[segment.key]),
                user_css=cls._css(placement, 1.0),
            )
            fit = story.fit_scale(
                pymupdf.Rect(0, 0, rect.width, rect.height), scale_min=1
            )
            # Round down, so near-equal scales look equal.
            placement.scale = (
                math.floor(20 / fit.parameter) / 20 if fit.parameter > 1 else 1.0
            )
            column = round(segment.bbox.x0 / 3)
            groups.setdefault(
                (segment.style.block, column, round(placement.font_size)), []
            ).append(placement)

        for group in groups.values():
            scale = min(placement.scale for placement in group)
            for placement in group:
                placement.scale = scale

    @classmethod
    def _write(
        cls, page: pymupdf.Page, placement: _Placement, translated_text: str
    ) -> None:
        # scale_low=0 is a safety net: the text shrinks further if it still does not fit.
        page.insert_htmlbox(
            cls._text_rect(placement, placement.scale),
            cls._html(placement, translated_text),
            css=cls._css(placement, placement.scale),
            scale_low=0,
        )

    @staticmethod
    def _html(placement: _Placement, text: str) -> str:
        """The translation as HTML, with the formatting of its ranges when there is any."""
        runs = placement.runs
        if not runs or "".join(run.get("text", "") for run in runs) != text:
            return html.escape(text)
        parts = []
        for run in runs:
            style = run.get("style") or {}
            css = []
            if style.get("bold") is not None:
                css.append(f"font-weight: {'bold' if style['bold'] else 'normal'}")
            if style.get("italic") is not None:
                css.append(f"font-style: {'italic' if style['italic'] else 'normal'}")
            decoration = [
                name
                for name, on in (("underline", style.get("underline")), ("line-through", style.get("strike")))
                if on
            ]
            if decoration:
                css.append(f"text-decoration: {' '.join(decoration)}")
            if re.fullmatch(r"#[0-9a-fA-F]{6}", style.get("color") or ""):
                css.append(f"color: {style['color']}")
            if re.fullmatch(r"#[0-9a-fA-F]{6}", style.get("highlight") or ""):
                css.append(f"background-color: {style['highlight']}")
            text_html = html.escape(run.get("text", ""))
            parts.append(f'<span style="{"; ".join(css)}">{text_html}</span>' if css else text_html)
        return "".join(parts)

    @staticmethod
    def _text_rect(placement: _Placement, scale: float) -> pymupdf.Rect:
        """The placement area, moved so the first baseline lands on the original one."""
        segment = placement.segment
        size = placement.font_size * scale
        top = segment.style.baseline - size * _baseline_ratio(
            placement.family, round(segment.line_height, 2)
        )
        rect = pymupdf.Rect(placement.rect)
        rect.y0 = top
        # The original number of lines always fits at the original size; the extra
        # room only overlaps the leading of the next line, never its glyphs.
        rect.y1 = max(
            rect.y1, top + size * segment.line_height * len(segment.lines) + 0.5
        )
        return rect

    @staticmethod
    def _css(placement: _Placement, scale: float) -> str:
        red, green, blue = pymupdf.sRGB_to_rgb(placement.color)
        return (
            "body {margin: 0; padding: 0;} "
            f"* {{font-family: {placement.family}; font-size: {placement.font_size * scale:.2f}px; "
            f"color: rgb({red}, {green}, {blue}); "
            f"font-weight: {'bold' if placement.bold else 'normal'}; "
            f"font-style: {'italic' if placement.italic else 'normal'}; "
            f"line-height: {placement.segment.line_height:.2f}; "
            f"text-align: {placement.align}; text-indent: {placement.text_indent * scale:.2f}px; "
            "margin: 0; padding: 0;}"
        )

    @staticmethod
    def _restore_links(page: pymupdf.Page, links: list[dict]) -> None:
        """Re-add links, moved onto their URL text if the translation shifted it."""
        existing = {(link.get("uri"), tuple(link["from"])) for link in page.get_links()}
        for link in links:
            if (link.get("uri"), tuple(link["from"])) in existing:
                continue
            uri = link.get("uri") or ""
            display = uri.removeprefix("mailto:")
            hits = page.search_for(display) if display else []
            if hits:
                # Prefer the occurrence closest to where the link used to be.
                link["from"] = min(
                    hits,
                    key=lambda rect: (
                        abs(rect.y0 - link["from"].y0) + abs(rect.x0 - link["from"].x0)
                    ),
                )
            link.pop("xref", None)
            link.pop("id", None)
            page.insert_link(link)



@cache
def _baseline_ratio(family: str, line_height: float) -> float:
    """Distance from the top of an HTML box to the first baseline, relative to the font size."""
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_htmlbox(
            pymupdf.Rect(0, 0, 500, 500),
            "Hg",
            css=f"body {{margin: 0;}} * {{font-family: {family}; font-size: 100px; "
            f"line-height: {line_height}; margin: 0; padding: 0;}}",
        )
        span = page.get_text("dict")["blocks"][0]["lines"][0]["spans"][0]
        return span["origin"][1] / 100
