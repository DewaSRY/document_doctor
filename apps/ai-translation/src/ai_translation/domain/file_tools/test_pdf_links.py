"""Tests that converting a PDF to Word keeps its links on the right text and images."""

from io import BytesIO

import pymupdf
import pytest
from docx import Document
from docx.oxml.ns import qn

from ai_translation.domain.file_tools import pdf_to_docx
from ai_translation.domain.file_tools.pdf_links import read_links

# ---------------------------------------------------------------------------
# Building PDFs
# ---------------------------------------------------------------------------


def _new_pdf(pages: int = 1) -> pymupdf.Document:
    pdf = pymupdf.open()
    for _ in range(pages):
        pdf.new_page()
    return pdf


def _write(page: pymupdf.Page, y: float, text: str) -> None:
    page.insert_text((72, y), text, fontsize=12)


def _link(page: pymupdf.Page, text: str, uri: str | None = None, page_to: int | None = None) -> None:
    """Link the first occurrence of `text` on the page, like a PDF writer does."""
    link: dict = {"from": page.search_for(text)[0]}
    if uri is not None:
        link |= {"kind": pymupdf.LINK_URI, "uri": uri}
    else:
        link |= {"kind": pymupdf.LINK_GOTO, "page": page_to, "to": pymupdf.Point(72, 72)}
    page.insert_link(link)


def _html_pdf(html: str) -> bytes:
    """Lay out HTML with MuPDF, which writes links over flowing text the way browsers do."""
    page, content = pymupdf.paper_rect("a4"), pymupdf.paper_rect("a4") + (72, 72, -72, -72)
    story = pymupdf.Story(html=html, user_css="body { font-family: sans-serif; font-size: 11pt; }")
    pdf = story.write_with_links(lambda *_: (page, content, None))
    return pdf.tobytes()


# ---------------------------------------------------------------------------
# Reading the Word document
# ---------------------------------------------------------------------------


class _Converted:
    def __init__(self, pdf: bytes | pymupdf.Document):
        data = pdf.tobytes() if isinstance(pdf, pymupdf.Document) else pdf
        self.doc = Document(BytesIO(pdf_to_docx(data)))
        self.body = self.doc.element.body

    @property
    def links(self) -> list[tuple[str, str]]:
        """(visible text, target) of every hyperlink; internal targets as '#bookmark'."""
        result = []
        for hyperlink in self.body.iter(qn("w:hyperlink")):
            text = "".join(t.text or "" for t in hyperlink.iter(qn("w:t")))
            if relation := hyperlink.get(qn("r:id")):
                result.append((text, self.doc.part.rels[relation].target_ref))
            else:
                result.append((text, "#" + hyperlink.get(qn("w:anchor"))))
        return result

    def targets(self, text: str) -> list[str]:
        """Targets of the hyperlinks whose visible text contains `text`."""
        return [target for visible, target in self.links if text in visible]

    def linked_text(self, target: str) -> str:
        return "".join(visible for visible, t in self.links if t == target)

    @property
    def text(self) -> str:
        return "".join(t.text or "" for t in self.body.iter(qn("w:t")))

    def page_of(self, element) -> int:
        """0-based PDF page an element was rebuilt from: pages are separate sections."""
        page = 0
        for paragraph in self.body.iter(qn("w:p")):
            if paragraph == element or paragraph in element.iterancestors():
                return page
            if paragraph.find(f"{qn('w:pPr')}/{qn('w:sectPr')}") is not None:
                page += 1
        raise AssertionError("element is not in the document")

    def bookmark(self, name: str):
        for start in self.body.iter(qn("w:bookmarkStart")):
            if start.get(qn("w:name")) == name:
                return start
        raise AssertionError(f"no bookmark named {name}")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_single_link_stays_on_its_word_only():
    pdf = _new_pdf()
    _write(pdf[0], 100, "Visit OpenAI")
    _link(pdf[0], "OpenAI", "https://openai.com/")

    converted = _Converted(pdf)

    assert "Visit OpenAI" in converted.text
    assert converted.links == [("OpenAI", "https://openai.com/")]


def test_several_links_on_one_line_keep_their_own_addresses():
    pdf = _new_pdf()
    _write(pdf[0], 100, "Search with Google or Bing or DuckDuckGo today.")
    _link(pdf[0], "Google", "https://google.com/")
    _link(pdf[0], "Bing", "https://bing.com/")
    _link(pdf[0], "DuckDuckGo", "https://duckduckgo.com/")

    converted = _Converted(pdf)

    assert converted.links == [
        ("Google", "https://google.com/"),
        ("Bing", "https://bing.com/"),
        ("DuckDuckGo", "https://duckduckgo.com/"),
    ]


def test_links_on_different_lines_of_a_page():
    pdf = _new_pdf()
    _write(pdf[0], 100, "First see the manual for setup.")
    _write(pdf[0], 300, "Then read the changelog for news.")
    _link(pdf[0], "manual", "https://example.com/manual")
    _link(pdf[0], "changelog", "https://example.com/changelog")

    converted = _Converted(pdf)

    assert converted.targets("manual") == ["https://example.com/manual"]
    assert converted.targets("changelog") == ["https://example.com/changelog"]


def test_links_on_every_page_stay_on_their_page():
    pdf = _new_pdf(pages=3)
    for number in range(3):
        _write(pdf[number], 100, f"Page {number + 1} points to Target{number + 1} here.")
        _link(pdf[number], f"Target{number + 1}", f"https://example.com/{number + 1}")

    converted = _Converted(pdf)

    assert len(converted.doc.sections) == 3
    hyperlinks = list(converted.body.iter(qn("w:hyperlink")))
    assert converted.links == [(f"Target{n}", f"https://example.com/{n}") for n in (1, 2, 3)]
    assert [converted.page_of(h) for h in hyperlinks] == [0, 1, 2]


def test_linked_and_plain_text_are_kept_apart():
    pdf = _new_pdf()
    _write(pdf[0], 100, "Plain start, then Documentation, then plain end.")
    _write(pdf[0], 130, "A whole line without any link at all.")
    _link(pdf[0], "Documentation", "https://docs.example.com/")

    converted = _Converted(pdf)

    assert converted.links == [("Documentation", "https://docs.example.com/")]
    assert "Plain start, then Documentation, then plain end." in converted.text
    assert "A whole line without any link at all." in converted.text


def test_link_wrapping_across_lines_covers_exactly_the_linked_words():
    pdf = _new_pdf()
    pdf[0].insert_textbox(
        pymupdf.Rect(72, 90, 300, 160),
        "This paragraph has a wrapping link that continues across lines and then ends.",
        fontsize=12,
    )
    for area in pdf[0].search_for("wrapping link that continues across lines"):
        pdf[0].insert_link({"kind": pymupdf.LINK_URI, "from": area, "uri": "https://wrap.example/"})

    converted = _Converted(pdf)

    linked = converted.linked_text("https://wrap.example/")
    assert " ".join(linked.split()) == "wrapping link that continues across lines"
    assert {target for _, target in converted.links} == {"https://wrap.example/"}


def test_one_link_area_over_two_lines_follows_its_quad_points():
    """A link drawn as one rectangle around two lines, with QuadPoints marking the linked words."""
    pdf = _new_pdf()
    page = pdf[0]
    _write(page, 100, "Before the link starts here")
    _write(page, 120, "and it ends here after.")
    first, second = page.search_for("starts here")[0], page.search_for("and it ends")[0]
    page.insert_link({"kind": pymupdf.LINK_URI, "from": first | second, "uri": "https://quads.example/"})
    (xref,) = [xref for xref, kind, _ in page.annot_xrefs() if kind == pymupdf.PDF_ANNOT_LINK]
    to_pdf = ~page.transformation_matrix
    quads = []
    for rect in (first, second):
        for point in (rect.bl, rect.br, rect.tl, rect.tr):
            quads.extend(point * to_pdf)
    pdf.xref_set_key(xref, "QuadPoints", "[" + " ".join(f"{v:g}" for v in quads) + "]")

    converted = _Converted(pdf)

    linked = converted.linked_text("https://quads.example/")
    assert " ".join(linked.split()) == "starts here and it ends"
    assert "Before the link" in converted.text


def test_link_area_shorter_than_the_line_still_links_its_text():
    """Writers such as Word draw link areas tight around the glyphs, shorter than the line."""
    pdf = _new_pdf()
    _write(pdf[0], 100, "Read the Guide first.")
    area = pdf[0].search_for("Guide")[0]
    tight = pymupdf.Rect(area.x0, area.y0 + area.height * 0.3, area.x1, area.y1 - area.height * 0.25)
    pdf[0].insert_link({"kind": pymupdf.LINK_URI, "from": tight, "uri": "https://guide.example/"})

    converted = _Converted(pdf)

    assert converted.links == [("Guide", "https://guide.example/")]


def test_link_on_an_image_makes_the_picture_clickable():
    pdf = _new_pdf()
    _write(pdf[0], 100, "Click the logo below.")
    pixmap = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 40, 40), False)
    pixmap.clear_with(180)
    logo = pymupdf.Rect(72, 150, 172, 250)
    pdf[0].insert_image(logo, pixmap=pixmap)
    pdf[0].insert_link({"kind": pymupdf.LINK_URI, "from": logo, "uri": "https://logo.example/"})

    converted = _Converted(pdf)

    pictures = converted.body.xpath(".//w:hyperlink//w:drawing")
    assert len(pictures) == 1
    hyperlink = next(pictures[0].iterancestors(qn("w:hyperlink")))
    assert converted.doc.part.rels[hyperlink.get(qn("r:id"))].target_ref == "https://logo.example/"
    click = pictures[0].xpath(".//a:hlinkClick")
    assert click and converted.doc.part.rels[click[0].get(qn("r:id"))].target_ref == "https://logo.example/"
    assert converted.targets("logo") == []  # the caption is not linked


def test_internal_links_point_to_a_bookmark_on_the_target_page():
    pdf = _new_pdf(pages=2)
    _write(pdf[0], 100, "Jump to the appendix now.")
    _link(pdf[0], "appendix", page_to=1)
    _write(pdf[1], 100, "Appendix content starts here.")
    _write(pdf[1], 130, "Back to the beginning.")
    _link(pdf[1], "beginning", page_to=0)

    converted = _Converted(pdf)

    forward, back = converted.targets("appendix"), converted.targets("beginning")
    assert len(forward) == len(back) == 1 and forward[0].startswith("#") and back[0].startswith("#")
    appendix = converted.bookmark(forward[0][1:])
    assert converted.page_of(appendix) == 1
    assert "Appendix content" in "".join(t.text for t in appendix.getparent().iter(qn("w:t")))
    assert converted.page_of(converted.bookmark(back[0][1:])) == 0


def test_internal_link_targets_the_line_at_its_destination():
    pdf = _new_pdf(pages=2)
    _write(pdf[0], 100, "See the details section.")
    pdf[0].insert_link(
        {"kind": pymupdf.LINK_GOTO, "from": pdf[0].search_for("details")[0], "page": 1, "to": pymupdf.Point(72, 380)}
    )
    _write(pdf[1], 100, "Unrelated introduction at the top.")
    _write(pdf[1], 400, "Details are explained here.")

    converted = _Converted(pdf)

    (target,) = converted.targets("details")
    paragraph = converted.bookmark(target[1:]).getparent()
    assert "Details are explained" in "".join(t.text for t in paragraph.iter(qn("w:t")))


def test_links_in_flowing_html_text_and_table_cells():
    converted = _Converted(
        _html_pdf(
            "<p>Our <a href='https://example.com/terms'>terms of service</a> apply, and the "
            "<a href='https://example.com/privacy'>privacy policy</a> explains the rest of "
            "what we do with the data you give us when you sign up for the service.</p>"
            "<table><tr><td>Support</td><td><a href='mailto:help@example.com'>help@example.com</a></td></tr>"
            "<tr><td>Status</td><td><a href='https://status.example.com/'>status page</a></td></tr></table>"
        )
    )

    assert converted.linked_text("https://example.com/terms") == "terms of service"
    assert converted.linked_text("https://example.com/privacy") == "privacy policy"
    assert converted.linked_text("mailto:help@example.com") == "help@example.com"
    assert converted.linked_text("https://status.example.com/") == "status page"


def test_hyperlinks_are_written_as_paragraph_content():
    """Nested in a run, as pdf2docx writes them, stricter readers such as Google Docs drop links."""
    pdf = _new_pdf()
    _write(pdf[0], 100, "Visit OpenAI")
    _link(pdf[0], "OpenAI", "https://openai.com/")

    converted = _Converted(pdf)

    parents = {h.getparent().tag for h in converted.body.iter(qn("w:hyperlink"))}
    assert parents == {qn("w:p")}


def test_pdf_without_links_converts_as_before():
    pdf = _new_pdf(pages=2)
    _write(pdf[0], 100, "No links on this page.")
    _write(pdf[1], 100, "Nor on this one.")

    converted = _Converted(pdf)

    assert converted.links == []
    assert len(converted.doc.sections) == 2
    assert "No links on this page." in converted.text and "Nor on this one." in converted.text


@pytest.mark.parametrize("rotation", [0, 90])
def test_link_areas_are_read_in_the_coordinates_of_the_displayed_page(rotation):
    pdf = _new_pdf()
    _write(pdf[0], 100, "Rotated OpenAI")
    area = pdf[0].search_for("OpenAI")[0]
    pdf[0].insert_link({"kind": pymupdf.LINK_URI, "from": area, "uri": "https://openai.com/"})
    pdf[0].set_rotation(rotation)
    page = pymupdf.open(stream=pdf.tobytes())[0]

    (link,) = read_links(page)

    assert link.uri == "https://openai.com/"
    assert tuple(link.areas[0]) == pytest.approx(tuple(area * page.rotation_matrix), abs=0.5)


def test_links_to_other_files_are_kept_as_external_links():
    pdf = _new_pdf()
    _write(pdf[0], 100, "Open the annex file.")
    pdf[0].insert_link(
        {"kind": pymupdf.LINK_GOTOR, "from": pdf[0].search_for("annex")[0], "file": "annex.pdf", "page": 0}
    )

    (link,) = read_links(pymupdf.open(stream=pdf.tobytes())[0])

    assert link.uri == "annex.pdf" and link.page is None
