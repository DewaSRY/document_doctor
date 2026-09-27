import re
from collections import Counter
from copy import deepcopy
from dataclasses import dataclass
from io import BytesIO

from docx import Document as DocxDocument
from docx.document import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.hyperlink import Hyperlink
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from lxml import etree

from .base import DocumentHandler

# Tabs and line breaks split a paragraph into separately translated pieces,
# so "Label<tab>: value" and multi-line addresses keep their structure.
_SEPARATORS = {qn("w:tab"), qn("w:ptab"), qn("w:br"), qn("w:cr")}
_LINE_BREAKS = {qn("w:br"), qn("w:cr")}
_MC = "{http://schemas.openxmlformats.org/markup-compatibility/2006}"
# Language tags, so Word proofs (and picks fonts for) the translation in the target language.
_LANGUAGE_TAGS = {
    "en": "en-US",
    "id": "id-ID",
    "fr": "fr-FR",
    "de": "de-DE",
    "es": "es-ES",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "zh": "zh-CN",
}
_EAST_ASIAN = {"ja", "ko", "zh"}


@dataclass
class _Piece:
    """Text of a paragraph between tabs and line breaks: the unit that is translated."""

    paragraph: Paragraph
    items: list[Run | Hyperlink]

    @property
    def text(self) -> str:
        return "".join(item.text for item in self.items)


class _PartParent:
    """Minimal parent for paragraphs found outside python-docx's object model."""

    def __init__(self, part):
        self.part = part


class DOCXHandler(DocumentHandler):
    """
    Handler for DOCX documents.

    Every paragraph (body, tables, headers, footers, text boxes and content
    controls) is one segment; a paragraph with tabs or line breaks is one
    segment per piece between them. Keys look like 'para_3' or 'para_3_1'
    and are stable between extraction and rebuild.
    """

    _HAS_LETTER = re.compile(r"[^\W\d_]")

    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract translatable paragraphs from the DOCX."""
        doc = DocxDocument(BytesIO(file_content))
        return {
            key: self._segment_text(piece.text)
            for key, piece in self._collect_pieces(doc).items()
        }

    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
    ) -> bytes:
        """Replace each paragraph with its translation, keeping the formatting."""
        doc = DocxDocument(BytesIO(file_content))

        for key, piece in self._collect_pieces(doc).items():
            translated_text = translations.get(key, "").strip()
            if translated_text:
                self._write_piece(piece, translated_text, target_language)
                self._let_row_grow(piece.paragraph)

        for element, _ in self._stories(doc):
            self._sync_fallback_text_boxes(element)

        doc.core_properties.subject = (
            f"Translated from {source_language} to {target_language}"
        )
        doc.core_properties.comments = "Translated by AI Translation Service"
        doc.core_properties.language = _LANGUAGE_TAGS.get(
            target_language, target_language
        )

        output = BytesIO()
        doc.save(output)
        return output.getvalue()

    # ------------------------------------------------------------------ extraction

    def _collect_pieces(self, doc: Document) -> dict[str, _Piece]:
        result: dict[str, _Piece] = {}
        for number, paragraph in enumerate(self._collect_paragraphs(doc)):
            pieces = self._split_paragraph(paragraph)
            if len(pieces) == 1:
                result[f"para_{number}"] = pieces[0]
                continue
            for index, piece in enumerate(pieces):
                if self._HAS_LETTER.search(piece.text):
                    result[f"para_{number}_{index}"] = piece
        return result

    def _collect_paragraphs(self, doc: Document) -> list[Paragraph]:
        paragraphs: list[Paragraph] = []

        def walk(container) -> None:
            """Add the paragraphs of a document, cell, header or footer, including nested tables."""
            paragraphs.extend(container.paragraphs)
            for table in container.tables:
                for row in table.rows:
                    for cell in row.cells:
                        walk(cell)

        walk(doc)
        for section in doc.sections:
            # Linked headers belong to an earlier section (or do not exist); reading them would add one.
            for header_footer in (section.header, section.footer):
                if not header_footer.is_linked_to_previous:
                    walk(header_footer)

        # Paragraphs python-docx does not expose: text boxes, content controls and
        # first-page / even-page headers. They come last, so keys of the rest stay the same.
        for element, parent in self._stories(doc):
            for p in element.iter(qn("w:p")):
                # The fallback copy of a text box is synced after writing.
                if next(p.iterancestors(f"{_MC}Fallback"), None) is None:
                    paragraphs.append(Paragraph(p, parent))

        # Merged cells and linked headers return the same paragraph more than once.
        result: list[Paragraph] = []
        seen = set()
        for paragraph in paragraphs:
            if paragraph._p in seen:
                continue
            seen.add(paragraph._p)
            if self._HAS_LETTER.search(paragraph.text):
                result.append(paragraph)
        return result

    @staticmethod
    def _stories(doc: Document) -> list[tuple]:
        """The body and every header and footer part, each with a parent for its paragraphs."""
        stories = [(doc.element.body, doc._body)]
        for rel in doc.part.rels.values():
            if rel.reltype in (RT.HEADER, RT.FOOTER) and not rel.is_external:
                stories.append((rel.target_part.element, _PartParent(rel.target_part)))
        return stories

    def _split_paragraph(self, paragraph: Paragraph) -> list[_Piece]:
        self._isolate_separators(paragraph)
        pieces = [_Piece(paragraph, [])]
        separators: list[Run] = []
        for item in paragraph.iter_inner_content():
            if isinstance(item, Run) and self._separator(item) is not None:
                separators.append(item)
                pieces.append(_Piece(paragraph, []))
            else:
                pieces[-1].items.append(item)

        # A line break inside a sentence (manual wrapping) does not split it.
        merged = [pieces[0]]
        for separator, piece in zip(separators, pieces[1:], strict=True):
            previous = merged[-1]
            tag = self._separator(separator)
            continues = (
                tag.tag in _LINE_BREAKS
                and tag.get(qn("w:type")) in (None, "textWrapping")
                and previous.text.strip()
                and not re.search(r"[.:;!?。：]\s*$", previous.text)
                and piece.text.lstrip()[:1].islower()
            )
            if continues:
                previous.items.extend([separator, *piece.items])
            else:
                merged.append(piece)
        return merged

    @staticmethod
    def _separator(run: Run):
        """The tab or break element if the run holds nothing else."""
        children = [child for child in run._r if child.tag != qn("w:rPr")]
        if len(children) == 1 and children[0].tag in _SEPARATORS:
            return children[0]
        return None

    @staticmethod
    def _isolate_separators(paragraph: Paragraph) -> None:
        """Move tabs and breaks inside a run with text into runs of their own."""
        for r in paragraph._p.xpath("./w:r"):
            children = [child for child in r if child.tag != qn("w:rPr")]
            if len(children) < 2 or not any(
                child.tag in _SEPARATORS for child in children
            ):
                continue
            groups: list[list] = []
            for child in children:
                if (
                    child.tag in _SEPARATORS
                    or not groups
                    or groups[-1][-1].tag in _SEPARATORS
                ):
                    groups.append([child])
                else:
                    groups[-1].append(child)
            for group in groups:
                new_r = OxmlElement("w:r", attrs=dict(r.attrib))
                if r.rPr is not None:
                    new_r.append(deepcopy(r.rPr))
                new_r.extend(group)
                r.addprevious(new_r)
            r.getparent().remove(r)

    # ------------------------------------------------------------------ rebuild

    @classmethod
    def _write_piece(
        cls, piece: _Piece, translated_text: str, target_language: str
    ) -> None:
        """
        Write the translation back with the formatting that covers most of the text.

        Hyperlinks whose text still appears in the translation (URLs, e-mail
        addresses) are left untouched, so the link keeps working; the translated
        text around them goes into the plain runs before and after each link.
        """
        items = piece.items
        paragraph = piece.paragraph

        kept_links: list[tuple[int, Hyperlink]] = []
        pieces: list[str] = []
        cursor = 0
        for index, item in enumerate(items):
            if not isinstance(item, Hyperlink) or not item.text.strip():
                continue
            position = translated_text.find(item.text, cursor)
            if position < 0:
                continue
            kept_links.append((index, item))
            pieces.append(translated_text[cursor:position])
            cursor = position + len(item.text)
        pieces.append(translated_text[cursor:])

        all_runs = [
            run
            for item in items
            if not any(item is link for _, link in kept_links)
            for run in (item.runs if isinstance(item, Hyperlink) else [item])
            if run.text
        ]
        template = cls._dominant_run(all_runs)
        bounds = [-1] + [index for index, _ in kept_links] + [len(items)]

        for group, text in enumerate(pieces):
            group_items = items[bounds[group] + 1 : bounds[group + 1]]
            runs: list[Run] = []
            for item in group_items:
                runs.extend(item.runs if isinstance(item, Hyperlink) else [item])

            # Only touch runs with text, so images and other inline objects survive.
            text_runs = [run for run in runs if run.text]
            if text_runs:
                written = cls._fill_runs(text_runs, text, template)
            elif text.strip():
                new_run = Run(
                    deepcopy(template._r) if template else paragraph._p.add_r(),
                    paragraph,
                )
                new_run.text = text
                if group > 0:
                    kept_links[group - 1][1]._hyperlink.addnext(new_run._r)
                elif kept_links:
                    kept_links[0][1]._hyperlink.addprevious(new_run._r)
                written = [new_run]
            else:
                continue

            for run in written:
                cls._set_language(run, target_language)

    @classmethod
    def _fill_runs(cls, runs: list[Run], text: str, template: Run | None) -> list[Run]:
        """
        Put the text into the first run and empty the others.

        A lead-in with its own formatting ("**Note:** text") keeps it, when the
        translation has a colon as well; the rest gets the main formatting.
        """
        lead = []
        for run in runs:
            if lead and cls._format_key(run) != cls._format_key(lead[0]):
                break
            lead.append(run)
        lead_text = "".join(run.text for run in lead)
        split = re.search(r"[:：]", text)
        if (
            template is not None
            and len(lead) < len(runs)
            and cls._format_key(lead[0]) != cls._format_key(template)
            and re.search(r"[:：]\s*$", lead_text)
            and split
        ):
            head, rest = text[: split.end()], text[split.end() :]
            first_rest = runs[len(lead)]
            for run in runs:
                run.text = ""
            lead[0].text = head
            first_rest.text = rest
            cls._copy_format(template, first_rest)
            return [lead[0], first_rest]

        for run in runs:
            run.text = ""
        runs[0].text = text
        if template is not None:
            cls._copy_format(template, runs[0])
        return [runs[0]]

    @classmethod
    def _dominant_run(cls, runs: list[Run]) -> Run | None:
        """The run whose formatting covers the most characters."""
        if not runs:
            return None
        weights: Counter[bytes] = Counter()
        first: dict[bytes, Run] = {}
        for run in runs:
            key = cls._format_key(run)
            weights[key] += len(run.text.strip())
            first.setdefault(key, run)
        return first[max(weights, key=lambda key: weights[key])]

    @staticmethod
    def _format_key(run: Run) -> bytes:
        rPr = run._r.rPr
        return etree.tostring(rPr) if rPr is not None else b""

    @staticmethod
    def _copy_format(source: Run, target: Run) -> None:
        if source._r is target._r:
            return
        if target._r.rPr is not None:
            target._r.remove(target._r.rPr)
        if source._r.rPr is not None:
            target._r.insert(0, deepcopy(source._r.rPr))

    @staticmethod
    def _set_language(run: Run, target_language: str) -> None:
        tag = _LANGUAGE_TAGS.get(target_language)
        if tag is None:
            return
        rPr = run._r.get_or_add_rPr()
        lang = rPr.find(qn("w:lang"))
        if lang is None:
            lang = OxmlElement("w:lang")
            rPr.insert_element_before(
                lang, "w:eastAsianLayout", "w:specVanish", "w:oMath"
            )
        if target_language in _EAST_ASIAN:
            lang.set(qn("w:eastAsia"), tag)
            rPr.get_or_add_rFonts().set(qn("w:hint"), "eastAsia")
        else:
            lang.set(qn("w:val"), tag)

    @staticmethod
    def _let_row_grow(paragraph: Paragraph) -> None:
        """A table row with an exact height would clip a longer translation."""
        for tr in paragraph._p.iterancestors(qn("w:tr")):
            for height in tr.iter(qn("w:trHeight")):
                if height.get(qn("w:hRule")) == "exact":
                    height.set(qn("w:hRule"), "atLeast")

    @staticmethod
    def _sync_fallback_text_boxes(element) -> None:
        """Copy translated text boxes into their legacy (VML) fallback, shown by older readers."""
        for alternate in element.iter(f"{_MC}AlternateContent"):
            choice = [
                box
                for branch in alternate.iterchildren(f"{_MC}Choice")
                for box in branch.iter(qn("w:txbxContent"))
            ]
            fallback = [
                box
                for branch in alternate.iterchildren(f"{_MC}Fallback")
                for box in branch.iter(qn("w:txbxContent"))
            ]
            if len(choice) != len(fallback):
                continue
            for source, target in zip(choice, fallback, strict=True):
                for child in list(target):
                    target.remove(child)
                target.extend(deepcopy(child) for child in source)
