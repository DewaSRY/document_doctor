"""
Reads the layout of a Word document for the editor: pages and margins per
section, headers and footers, paragraphs with their resolved formatting, tables,
images and text boxes, in document order. Translatable text is referenced by
segment key (see DOCXHandler); everything else is returned as fixed content.

All lengths are in points. Formatting is resolved the way Word does:
document defaults, then the table style, the paragraph style chain, numbering,
the character style chain and finally direct formatting.
"""

import re
from dataclasses import dataclass

from docx.document import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml.ns import qn
from docx.text.hyperlink import Hyperlink
from docx.text.run import Run
from lxml import etree

_MC = "{http://schemas.openxmlformats.org/markup-compatibility/2006}"
_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
_WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
_WPS = "{http://schemas.microsoft.com/office/word/2010/wordprocessingShape}"
_V = "{urn:schemas-microsoft-com:vml}"
_R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

_EMU_PER_PT = 12700
_TWIPS_PER_PT = 20

_ALIGN = {
    "left": "left",
    "start": "left",
    "center": "center",
    "right": "right",
    "end": "right",
    "both": "justify",
    "distribute": "justify",
    "lowKashida": "justify",
    "mediumKashida": "justify",
    "highKashida": "justify",
    "thaiDistribute": "justify",
}
_HIGHLIGHT = {
    "yellow": "#ffff00",
    "green": "#00ff00",
    "cyan": "#00ffff",
    "magenta": "#ff00ff",
    "blue": "#0000ff",
    "red": "#ff0000",
    "darkBlue": "#000080",
    "darkCyan": "#008080",
    "darkGreen": "#008000",
    "darkMagenta": "#800080",
    "darkRed": "#800000",
    "darkYellow": "#808000",
    "darkGray": "#808080",
    "lightGray": "#c0c0c0",
    "black": "#000000",
    "white": "#ffffff",
}
# Bullets drawn with symbol fonts use private-use code points.
_SYMBOL_BULLETS = {
    "": "•",
    "": "▪",
    "": "■",
    "": "➢",
    "": "❖",
    "": "✓",
    "": "□",
    "": "➔",
    "": "–",
    "": "➞",
}
_BROWSER_IMAGES = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"}
# The editor's paragraph style choices, by Word's built-in style ids.
_HEADING_STYLES = {
    "Title": "title",
    "Subtitle": "subtitle",
    **{f"Heading{level}": f"h{level}" for level in range(1, 7)},
}


def _pt(value: str | None, per_pt: float = _TWIPS_PER_PT) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value) / per_pt, 2)
    except ValueError:
        return None


def _val(element, name: str = "w:val") -> str | None:
    return None if element is None else element.get(qn(name))


def _on(element) -> bool | None:
    """A toggle property: absent is None, otherwise on unless its value says off."""
    if element is None:
        return None
    return _val(element) not in ("0", "false", "off", "none")


def _hex(value: str | None) -> str | None:
    if not value or value == "auto" or not re.fullmatch(r"[0-9A-Fa-f]{6}", value):
        return None
    return f"#{value.lower()}"


def _shading(element) -> str | None:
    """The fill colour of a w:shd element."""
    if element is None or _val(element) == "nil":
        return None
    fill = _hex(_val(element, "w:fill"))
    if fill:
        return fill
    if _val(element) == "solid":
        return _hex(_val(element, "w:color"))
    return None


def _border(element) -> dict | None:
    if element is None or _val(element) in (None, "nil", "none"):
        return None
    size = _val(element, "w:sz")
    style = _val(element)
    return {
        # w:sz is in eighths of a point.
        "width": round(max(float(size) / 8, 0.25), 2) if size else 0.5,
        "color": _hex(_val(element, "w:color")) or "#000000",
        "style": (
            "dotted"
            if style in ("dotted", "dotDash", "dotDotDash")
            else "dashed"
            if style.startswith("dash")
            else "double"
            if style.startswith(("double", "triple", "thinThick", "thickThin"))
            else "solid"
        ),
    }


def _stronger(a: dict | None, b: dict | None) -> dict | None:
    if a is None:
        return b
    if b is None:
        return a
    return a if a["width"] >= b["width"] else b


@dataclass
class _Fonts:
    major: str = "Calibri Light"
    minor: str = "Calibri"
    major_ea: str | None = None
    minor_ea: str | None = None


class DocxLayoutReader:
    """Builds the editor layout of one document. `keys` maps each run or
    hyperlink element of a translatable piece to its segment key and its
    dominant run (the formatting the translation is written with)."""

    def __init__(self, doc: Document, pieces: dict):
        self.doc = doc
        self.styles = self._styles_by_id(doc)
        self.fonts = self._theme_fonts(doc)
        self.defaults_ppr, self.defaults_rpr = self._doc_defaults(doc)
        self.default_para_style = next(
            (
                sid
                for sid, style in self.styles.items()
                if style.get(qn("w:type")) == "paragraph"
                and style.get(qn("w:default")) in ("1", "true")
            ),
            None,
        )
        self.numbering = self._numbering(doc)
        self.counters: dict[str, list[int | None]] = {}
        self.overridden: set[tuple[str, int]] = set()
        self.default_tab = self._default_tab(doc)

        from .docx_handler import DOCXHandler

        self.keys: dict = {}
        self.piece_runs: dict[str, Run | None] = {}
        for key, piece in pieces.items():
            runs = []
            for item in piece.items:
                element = item._hyperlink if isinstance(item, Hyperlink) else item._r
                self.keys[element] = key
                runs.extend(item.runs if isinstance(item, Hyperlink) else [item])
            self.piece_runs[key] = DOCXHandler._dominant_run(
                [run for run in runs if run.text]
            )

    # ------------------------------------------------------------------ document

    def read(self) -> dict:
        body = self.doc.element.body
        headers: dict[str, list[dict]] = {}
        sections: list[dict] = []
        blocks: list[dict] = []
        inherited = {"header": {}, "footer": {}}

        def close(sect_pr) -> None:
            nonlocal blocks
            sections.append(self._section(sect_pr, blocks, headers, inherited))
            blocks = []

        for index, child in enumerate(body.iterchildren()):
            if child.tag == qn("w:sectPr"):
                continue
            # Blocks the user adds in the editor are placed after an element of the body, by its index.
            for block in self._block(child, self.doc.part, None):
                block["body_index"] = index
                blocks.append(block)
            sect_pr = child.find(f"{qn('w:pPr')}/{qn('w:sectPr')}") if child.tag == qn("w:p") else None
            if sect_pr is not None:
                close(sect_pr)
        close(body.find(qn("w:sectPr")))

        layout = {
            "format": "docx",
            "default_tab": self.default_tab,
            "sections": sections,
            "headers": headers,
            "styles": self._named_styles(),
        }
        # Most runs share a few styles: send each once and refer to it by index.
        layout["run_styles"] = _intern_runs(layout)
        return layout

    def _section(self, sect_pr, blocks: list[dict], headers: dict, inherited: dict) -> dict:
        size = sect_pr.find(qn("w:pgSz")) if sect_pr is not None else None
        margin = sect_pr.find(qn("w:pgMar")) if sect_pr is not None else None
        cols = sect_pr.find(qn("w:cols")) if sect_pr is not None else None
        kind = sect_pr.find(qn("w:type")) if sect_pr is not None else None

        def length(element, name: str, default: float) -> float:
            value = _pt(_val(element, name))
            return value if value is not None else default

        refs = {}
        for tag, group in (("w:headerReference", "header"), ("w:footerReference", "footer")):
            found = dict(inherited[group])
            for ref in sect_pr.iterfind(qn(tag)) if sect_pr is not None else []:
                rel_id = ref.get(f"{_R}id")
                variant = _val(ref, "w:type") or "default"
                part = self.doc.part.related_parts.get(rel_id)
                if part is None:
                    continue
                name = str(part.partname).lstrip("/")
                if name not in headers:
                    headers[name] = [
                        block
                        for child in part.element.iterchildren()
                        for block in self._block(child, part, None)
                    ]
                found[variant] = name
            # A section without its own header shows the previous section's.
            inherited[group] = found
            refs[group] = {"default": found.get("default"), "first": found.get("first")}

        gutter = length(margin, "w:gutter", 0)
        return {
            "page": {
                "width": length(size, "w:w", 612),
                "height": length(size, "w:h", 792),
            },
            "margin": {
                "top": abs(length(margin, "w:top", 72)),
                "right": length(margin, "w:right", 72),
                "bottom": abs(length(margin, "w:bottom", 72)),
                "left": length(margin, "w:left", 72) + gutter,
                "header": length(margin, "w:header", 36),
                "footer": length(margin, "w:footer", 36),
            },
            "break": _val(kind) or "nextPage",
            "columns": int(_val(cols, "w:num") or 1),
            "title_page": _on(sect_pr.find(qn("w:titlePg"))) is True if sect_pr is not None else False,
            "header": refs["header"],
            "footer": refs["footer"],
            "blocks": blocks,
        }

    def _block(self, element, part, table_style: str | None) -> list[dict]:
        tag = element.tag
        if tag == qn("w:p"):
            return self._paragraph(element, part, table_style)
        if tag == qn("w:tbl"):
            return [self._table(element, part)]
        if tag == qn("w:sdt"):
            content = element.find(qn("w:sdtContent"))
            return [
                block
                for child in (content.iterchildren() if content is not None else [])
                for block in self._block(child, part, table_style)
            ]
        if tag == f"{_MC}AlternateContent":
            choice = element.find(f"{_MC}Choice")
            return [
                block
                for child in (choice.iterchildren() if choice is not None else [])
                for block in self._block(child, part, table_style)
            ]
        return []

    # ------------------------------------------------------------------ styles

    @staticmethod
    def _styles_by_id(doc: Document) -> dict:
        try:
            element = doc.styles.element
        except Exception:
            return {}
        return {style.get(qn("w:styleId")): style for style in element.iterfind(qn("w:style"))}

    @staticmethod
    def _doc_defaults(doc: Document):
        try:
            element = doc.styles.element
        except Exception:
            return None, None
        defaults = element.find(qn("w:docDefaults"))
        if defaults is None:
            return None, None
        return (
            defaults.find(f"{qn('w:pPrDefault')}/{qn('w:pPr')}"),
            defaults.find(f"{qn('w:rPrDefault')}/{qn('w:rPr')}"),
        )

    @staticmethod
    def _theme_fonts(doc: Document) -> _Fonts:
        fonts = _Fonts()
        try:
            theme = doc.part.part_related_by(RT.THEME)
            root = etree.fromstring(theme.blob)
        except Exception:
            return fonts
        for name in ("major", "minor"):
            font = root.find(f".//{_A}{name}Font")
            if font is None:
                continue
            latin = font.find(f"{_A}latin")
            ea = font.find(f"{_A}ea")
            if latin is not None and latin.get("typeface"):
                setattr(fonts, name, latin.get("typeface"))
            if ea is not None and ea.get("typeface"):
                setattr(fonts, f"{name}_ea", ea.get("typeface"))
        return fonts

    @staticmethod
    def _default_tab(doc: Document) -> float:
        try:
            tab = doc.settings.element.find(qn("w:defaultTabStop"))
        except Exception:
            tab = None
        return _pt(_val(tab)) or 36.0

    def _style_chain(self, style_id: str | None) -> list:
        """The style and the styles it is based on, base first."""
        chain = []
        seen = set()
        while style_id and style_id in self.styles and style_id not in seen:
            seen.add(style_id)
            style = self.styles[style_id]
            chain.append(style)
            style_id = _val(style.find(qn("w:basedOn")))
        return list(reversed(chain))

    def _heading(self, style_id: str | None) -> str | None:
        for style in reversed(self._style_chain(style_id)):
            kind = _HEADING_STYLES.get(style.get(qn("w:styleId")))
            if kind:
                return kind
            name = _val(style.find(qn("w:name"))) or ""
            match = re.fullmatch(r"(?i)heading (\d)", name)
            if match and 1 <= int(match.group(1)) <= 6:
                return f"h{match.group(1)}"
            if name.lower() in ("title", "subtitle"):
                return name.lower()
        return None

    def _named_styles(self) -> dict:
        """Resolved formatting of the paragraph styles the editor offers."""
        result = {}
        by_kind = {}
        for style_id in self.styles:
            if self.styles[style_id].get(qn("w:type")) != "paragraph":
                continue
            kind = _HEADING_STYLES.get(style_id)
            if kind and kind not in by_kind:
                by_kind[kind] = style_id
        if self.default_para_style:
            by_kind["normal"] = self.default_para_style
        for kind, style_id in by_kind.items():
            props = self._paragraph_props(style_id, None, None)
            result[kind] = {
                "style_id": style_id,
                "style": props["style"],
                "run": self._run_style([], style_id, None),
            }
        return result

    # ------------------------------------------------------------------ paragraph formatting

    def _ppr_layers(self, style_id: str | None, table_style: str | None, direct):
        layers = [self.defaults_ppr]
        layers += [s.find(qn("w:pPr")) for s in self._style_chain(table_style)]
        layers += [s.find(qn("w:pPr")) for s in self._style_chain(style_id)]
        return [layer for layer in layers if layer is not None], direct

    def _paragraph_props(self, style_id: str | None, table_style: str | None, direct) -> dict:
        layers, direct = self._ppr_layers(style_id, table_style, direct)

        num_pr = None
        for layer in [*layers, direct]:
            if layer is not None and layer.find(qn("w:numPr")) is not None:
                candidate = layer.find(qn("w:numPr"))
                # A style's numPr may only name the list; the level can come from elsewhere.
                if num_pr is None or candidate.find(qn("w:numId")) is not None:
                    num_pr = candidate
        level = None
        if num_pr is not None:
            num_id = _val(num_pr.find(qn("w:numId")))
            ilvl = int(_val(num_pr.find(qn("w:ilvl"))) or 0)
            if num_id and num_id != "0":
                level = self._level(num_id, ilvl)

        ordered = list(layers)
        if level is not None and level["ppr"] is not None:
            ordered.append(level["ppr"])
        if direct is not None:
            ordered.append(direct)

        align = "left"
        indent = {"left": 0.0, "right": 0.0, "first": 0.0}
        spacing = {"before": 0.0, "after": 0.0}
        line = {"rule": "auto", "value": 1.0}
        contextual = False
        shading = None
        borders: dict = {}
        break_before = False
        tabs: dict[float, dict] = {}

        for layer in ordered:
            jc = _val(layer.find(qn("w:jc")))
            if jc:
                align = _ALIGN.get(jc, align)
            ind = layer.find(qn("w:ind"))
            if ind is not None:
                for side, names in (("left", ("w:left", "w:start")), ("right", ("w:right", "w:end"))):
                    for name in names:
                        value = _pt(_val(ind, name))
                        if value is not None:
                            indent[side] = value
                hanging = _pt(_val(ind, "w:hanging"))
                first = _pt(_val(ind, "w:firstLine"))
                if hanging is not None:
                    indent["first"] = -hanging
                elif first is not None:
                    indent["first"] = first
            sp = layer.find(qn("w:spacing"))
            if sp is not None:
                for side in ("before", "after"):
                    value = _pt(_val(sp, f"w:{side}"))
                    if value is not None:
                        spacing[side] = value
                    if _val(sp, f"w:{side}Autospacing") in ("1", "true", "on"):
                        spacing[side] = 14.0
                if _val(sp, "w:line") is not None:
                    rule = _val(sp, "w:lineRule") or "auto"
                    raw = float(_val(sp, "w:line"))
                    line = (
                        {"rule": "auto", "value": round(raw / 240, 3)}
                        if rule == "auto"
                        else {"rule": "exact" if rule == "exact" else "atLeast", "value": round(raw / 20, 2)}
                    )
            if layer.find(qn("w:contextualSpacing")) is not None:
                contextual = _on(layer.find(qn("w:contextualSpacing")))
            if layer.find(qn("w:shd")) is not None:
                shading = _shading(layer.find(qn("w:shd")))
            bdr = layer.find(qn("w:pBdr"))
            if bdr is not None:
                for side in ("top", "bottom", "left", "right"):
                    element = bdr.find(qn(f"w:{side}"))
                    if element is not None:
                        borders[side] = _border(element)
            if layer.find(qn("w:pageBreakBefore")) is not None:
                break_before = bool(_on(layer.find(qn("w:pageBreakBefore"))))
            tab_list = layer.find(qn("w:tabs"))
            if tab_list is not None:
                for tab in tab_list.iterfind(qn("w:tab")):
                    pos = _pt(_val(tab, "w:pos"))
                    kind = _val(tab)
                    if pos is None:
                        continue
                    if kind == "clear":
                        tabs.pop(pos, None)
                    elif kind != "bar":
                        tabs[pos] = {
                            "pos": pos,
                            "align": {"end": "right", "start": "left", "num": "left"}.get(kind, kind or "left"),
                            "leader": _val(tab, "w:leader") or "none",
                        }

        return {
            "style": {
                "align": align,
                "indent_left": indent["left"],
                "indent_right": indent["right"],
                "indent_first": indent["first"],
                "space_before": spacing["before"],
                "space_after": spacing["after"],
                "line": line,
                "contextual": bool(contextual),
                "shading": shading,
                "borders": {side: value for side, value in borders.items() if value} or None,
                "tabs": sorted(tabs.values(), key=lambda tab: tab["pos"]),
            },
            "level": level,
            "break_before": break_before,
        }

    # ------------------------------------------------------------------ numbering

    def _numbering(self, doc: Document) -> dict:
        try:
            element = doc.part.numbering_part.element
        except Exception:
            return {"nums": {}, "abstract": {}}
        abstract = {
            _val(item, "w:abstractNumId"): {
                int(_val(lvl, "w:ilvl") or 0): lvl for lvl in item.iterfind(qn("w:lvl"))
            }
            for item in element.iterfind(qn("w:abstractNum"))
        }
        nums = {}
        for num in element.iterfind(qn("w:num")):
            overrides = {}
            for override in num.iterfind(qn("w:lvlOverride")):
                ilvl = int(_val(override, "w:ilvl") or 0)
                start = _val(override.find(qn("w:startOverride")))
                lvl = override.find(qn("w:lvl"))
                overrides[ilvl] = {"start": int(start) if start else None, "lvl": lvl}
            nums[_val(num, "w:numId")] = {
                "abstract": _val(num.find(qn("w:abstractNumId"))),
                "overrides": overrides,
            }
        return {"nums": nums, "abstract": abstract}

    def _lvl(self, num_id: str, ilvl: int):
        num = self.numbering["nums"].get(num_id)
        if num is None:
            return None, None
        override = num["overrides"].get(ilvl, {})
        lvl = override.get("lvl")
        if lvl is None:
            lvl = self.numbering["abstract"].get(num["abstract"], {}).get(ilvl)
        return num, lvl

    def _level(self, num_id: str, ilvl: int) -> dict | None:
        num, lvl = self._lvl(num_id, ilvl)
        if lvl is None:
            return None
        return {"num_id": num_id, "ilvl": ilvl, "lvl": lvl, "ppr": lvl.find(qn("w:pPr"))}

    def _marker(self, level: dict, mark_style: dict) -> dict | None:
        """The list number or bullet of a paragraph; advances the list's counters."""
        num_id, ilvl, lvl = level["num_id"], level["ilvl"], level["lvl"]
        num = self.numbering["nums"][num_id]
        key = num["abstract"] or num_id
        counters = self.counters.setdefault(key, [None] * 9)

        def start_of(index: int) -> int:
            override = num["overrides"].get(index, {}).get("start")
            if override is not None:
                return override
            _, level_lvl = self._lvl(num_id, index)
            start = _val(level_lvl.find(qn("w:start"))) if level_lvl is not None else None
            return int(start) if start else 1

        if (num_id, ilvl) not in self.overridden and num["overrides"].get(ilvl, {}).get("start") is not None:
            # A list that restarts its numbering (a later "1." list of the same kind).
            self.overridden.add((num_id, ilvl))
            counters[ilvl] = None
        counters[ilvl] = start_of(ilvl) if counters[ilvl] is None else counters[ilvl] + 1
        for deeper in range(ilvl + 1, len(counters)):
            counters[deeper] = None

        fmt = _val(lvl.find(qn("w:numFmt"))) or "decimal"
        text = _val(lvl.find(qn("w:lvlText")))
        if text is None:
            text = "" if fmt == "none" else f"%{ilvl + 1}."

        def number(index: int) -> str:
            value = counters[index] if counters[index] is not None else start_of(index)
            _, level_lvl = self._lvl(num_id, index)
            level_fmt = _val(level_lvl.find(qn("w:numFmt"))) if level_lvl is not None else fmt
            return self._format_number(value, level_fmt or "decimal")

        if fmt == "bullet":
            label = "".join(_SYMBOL_BULLETS.get(char, char) for char in text)
            if label and all("" <= char <= "" for char in label):
                label = "•"
        else:
            label = re.sub(r"%(\d)", lambda m: number(int(m.group(1)) - 1), text)

        run = self._run_style([lvl.find(qn("w:rPr"))], None, None, base=mark_style)
        if fmt == "bullet" and run["family"].lower() in ("symbol", "wingdings"):
            run = {**run, "family": mark_style["family"]}
        return {
            "text": label,
            "run": run,
            "suffix": _val(lvl.find(qn("w:suff"))) or "tab",
        }

    @staticmethod
    def _format_number(value: int, fmt: str) -> str:
        if fmt == "decimalZero":
            return f"{value:02d}"
        if fmt in ("lowerLetter", "upperLetter"):
            letters = ""
            n = value
            while n > 0:
                n, remainder = divmod(n - 1, 26)
                letters = chr(97 + remainder) + letters
            return letters.upper() if fmt == "upperLetter" else letters
        if fmt in ("lowerRoman", "upperRoman"):
            numerals = [
                (1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"),
                (50, "l"), (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i"),
            ]
            roman = ""
            n = value
            for amount, numeral in numerals:
                while n >= amount:
                    roman += numeral
                    n -= amount
            return roman.upper() if fmt == "upperRoman" else roman
        if fmt == "none":
            return ""
        return str(value)

    # ------------------------------------------------------------------ run formatting

    def _run_style(self, direct_layers: list, para_style: str | None, table_style: str | None, char_style: str | None = None, base: dict | None = None) -> dict:
        """Resolved formatting of a run: defaults, table style, paragraph style, character style, direct."""
        if base is None:
            layers = [self.defaults_rpr]
            layers += [s.find(qn("w:rPr")) for s in self._style_chain(table_style)]
            layers += [s.find(qn("w:rPr")) for s in self._style_chain(para_style or self.default_para_style)]
            layers += [s.find(qn("w:rPr")) for s in self._style_chain(char_style)]
        else:
            layers = []
        layers += direct_layers
        style = dict(base) if base else {
            "family": "Times New Roman",
            "east_asia": None,
            "size": 10.0,
            "bold": False,
            "italic": False,
            "underline": False,
            "strike": False,
            "color": None,
            "highlight": None,
            "caps": False,
            "small_caps": False,
            "vert": None,
            "spacing": 0.0,
            "hidden": False,
        }
        for layer in layers:
            if layer is None:
                continue
            fonts = layer.find(qn("w:rFonts"))
            if fonts is not None:
                family = _val(fonts, "w:ascii") or _val(fonts, "w:hAnsi")
                theme = _val(fonts, "w:asciiTheme") or _val(fonts, "w:hAnsiTheme")
                if theme:
                    family = self.fonts.major if theme.startswith("major") else self.fonts.minor
                if family:
                    style["family"] = family
                east_asia = _val(fonts, "w:eastAsia")
                ea_theme = _val(fonts, "w:eastAsiaTheme")
                if ea_theme:
                    east_asia = self.fonts.major_ea if ea_theme.startswith("major") else self.fonts.minor_ea
                if east_asia:
                    style["east_asia"] = east_asia
            size = _pt(_val(layer.find(qn("w:sz"))), 2)
            if size:
                style["size"] = size
            for name, tag in (
                ("bold", "w:b"),
                ("italic", "w:i"),
                ("caps", "w:caps"),
                ("small_caps", "w:smallCaps"),
                ("hidden", "w:vanish"),
            ):
                value = _on(layer.find(qn(tag)))
                if value is not None:
                    style[name] = value
            strike = _on(layer.find(qn("w:strike")))
            double = _on(layer.find(qn("w:dstrike")))
            if strike is not None or double is not None:
                style["strike"] = bool(strike or double)
            underline = layer.find(qn("w:u"))
            if underline is not None:
                style["underline"] = _val(underline) not in (None, "none", "0", "false")
            color = layer.find(qn("w:color"))
            if color is not None:
                style["color"] = _hex(_val(color))
            highlight = layer.find(qn("w:highlight"))
            if highlight is not None:
                style["highlight"] = _HIGHLIGHT.get(_val(highlight))
            shading = layer.find(qn("w:shd"))
            if shading is not None and _shading(shading):
                style["highlight"] = _shading(shading)
            vert = _val(layer.find(qn("w:vertAlign")))
            if vert:
                style["vert"] = {"superscript": "super", "subscript": "sub"}.get(vert)
            spacing = _pt(_val(layer.find(qn("w:spacing"))))
            if spacing is not None:
                style["spacing"] = spacing
        return style

    def _style_of_run(self, r, para_style: str | None, table_style: str | None) -> dict:
        rpr = r.find(qn("w:rPr"))
        char_style = _val(rpr.find(qn("w:rStyle"))) if rpr is not None else None
        return self._run_style([rpr], para_style, table_style, char_style)

    # ------------------------------------------------------------------ paragraph content

    def _paragraph(self, p, part, table_style: str | None) -> list[dict]:
        ppr = p.find(qn("w:pPr"))
        style_id = _val(ppr.find(qn("w:pStyle"))) if ppr is not None else None
        style_id = style_id or self.default_para_style
        props = self._paragraph_props(style_id, table_style, ppr)
        mark_rpr = ppr.find(qn("w:rPr")) if ppr is not None else None
        mark = self._run_style([mark_rpr], style_id, table_style)

        paragraph = {
            "type": "paragraph",
            "style": props["style"],
            "style_id": style_id,
            "heading": self._heading(style_id),
            "run": mark,
            "marker": None,
            "parts": [],
            "break_before": props["break_before"],
            "break_after": False,
        }
        frames: list[dict] = []
        context = _Walk(paragraph, frames, part, style_id, table_style)
        for child in p.iterchildren():
            self._inline(child, context, None)

        if props["level"] is not None:
            paragraph["marker"] = self._marker(props["level"], mark)

        # A page break at the very start of a paragraph is a break before it.
        parts = paragraph["parts"]
        if parts and parts[0].get("type") == "page_break":
            paragraph["break_before"] = True
        if any(part.get("type") == "page_break" for part in parts[1:]):
            paragraph["break_after"] = True
        paragraph["parts"] = [part for part in parts if part.get("type") != "page_break"]
        return [paragraph, *frames]

    def _inline(self, element, context: "_Walk", key: str | None) -> None:
        tag = element.tag
        if tag == qn("w:r"):
            self._run(element, context, self.keys.get(element, key))
        elif tag == qn("w:hyperlink"):
            link_key = self.keys.get(element, key)
            for child in element.iterchildren():
                self._inline(child, context, link_key)
        elif tag in (qn("w:smartTag"), qn("w:ins"), qn("w:customXml"), qn("w:dir"), qn("w:bdo")):
            for child in element.iterchildren():
                self._inline(child, context, key)
        elif tag == qn("w:sdt"):
            content = element.find(qn("w:sdtContent"))
            for child in content.iterchildren() if content is not None else []:
                self._inline(child, context, key)
        elif tag == qn("w:fldSimple"):
            field = _field_name(element.get(qn("w:instr")) or "")
            if field:
                runs = element.findall(qn("w:r"))
                run_style = self._style_of_run(runs[0], context.style_id, context.table_style) if runs else context.paragraph["run"]
                context.add({"type": "field", "field": field, "run": run_style})
            else:
                for child in element.iterchildren():
                    self._inline(child, context, key)
        elif tag == f"{_MC}AlternateContent":
            choice = element.find(f"{_MC}Choice")
            for child in choice.iterchildren() if choice is not None else []:
                self._inline(child, context, key)

    def _run(self, r, context: "_Walk", key: str | None) -> None:
        style = self._style_of_run(r, context.style_id, context.table_style)
        if key is not None and key not in context.placed:
            context.placed.add(key)
            dominant = self.piece_runs.get(key)
            run_style = (
                self._style_of_run(dominant._r, context.style_id, context.table_style)
                if dominant is not None
                else style
            )
            context.add({"type": "segment", "key": key, "run": run_style})

        for child in r.iterchildren():
            tag = child.tag
            if tag == f"{_MC}AlternateContent":
                choice = child.find(f"{_MC}Choice")
                children = list(choice.iterchildren()) if choice is not None else []
            else:
                children = [child]
            for item in children:
                self._run_item(item, context, key, style)

    def _run_item(self, item, context: "_Walk", key: str | None, style: dict) -> None:
        tag = item.tag
        if tag == qn("w:fldChar"):
            kind = _val(item, "w:fldCharType")
            if kind == "begin":
                context.field = {"instr": "", "result": False, "emitted": False}
            elif kind == "separate" and context.field is not None:
                context.field["result"] = True
            elif kind == "end":
                context.field = None
            return
        if tag == qn("w:instrText"):
            if context.field is not None:
                context.field["instr"] += item.text or ""
            return
        if tag == qn("w:drawing"):
            self._drawing(item, context)
            return
        if tag == qn("w:pict") or tag == qn("w:object"):
            self._vml(item, context)
            return
        if tag == qn("w:br") and _val(item, "w:type") == "page":
            context.add({"type": "page_break"})
            return
        if key is not None or style.get("hidden"):
            # The segment carries this text.
            return

        field = context.field
        if field is not None and field["result"]:
            name = _field_name(field["instr"])
            if name:
                if not field["emitted"]:
                    field["emitted"] = True
                    context.add({"type": "field", "field": name, "run": style})
                return

        if tag == qn("w:t"):
            text = item.text or ""
            if text:
                context.add_text(text, style)
        elif tag in (qn("w:tab"), qn("w:ptab")):
            context.add({"type": "tab"})
        elif tag in (qn("w:br"), qn("w:cr")):
            context.add({"type": "break"})
        elif tag == qn("w:noBreakHyphen"):
            context.add_text("‑", style)
        elif tag == qn("w:sym"):
            char = _val(item, "w:char")
            if char:
                try:
                    code = chr(int(char, 16))
                except ValueError:
                    return
                context.add_text(_SYMBOL_BULLETS.get(code, code if not "" <= code <= "" else "•"), style)

    # ------------------------------------------------------------------ drawings

    def _image_src(self, part, rel_id: str | None) -> str | None:
        if not rel_id:
            return None
        target = part.related_parts.get(rel_id)
        if target is None:
            return None
        name = str(target.partname).lstrip("/")
        extension = name[name.rfind(".") :].lower() if "." in name else ""
        return name if extension in _BROWSER_IMAGES else None

    def _drawing(self, drawing, context: "_Walk") -> None:
        container = drawing.find(f"{_WP}inline")
        anchor = drawing.find(f"{_WP}anchor")
        if container is None:
            container = anchor
        if container is None:
            return
        extent = container.find(f"{_WP}extent")
        width = _pt(extent.get("cx"), _EMU_PER_PT) if extent is not None else None
        height = _pt(extent.get("cy"), _EMU_PER_PT) if extent is not None else None
        position = self._anchor(anchor) if anchor is not None else None

        textbox = container.find(f".//{_WPS}txbx/{qn('w:txbxContent')}")
        if textbox is not None:
            shape = container.find(f".//{_WPS}spPr")
            context.frames.append(
                {
                    "type": "frame",
                    "width": width or 0,
                    "height": height or 0,
                    "position": position,
                    "fill": self._shape_fill(shape),
                    "border": self._shape_line(shape),
                    "blocks": [
                        block
                        for child in textbox.iterchildren()
                        for block in self._block(child, context.part, context.table_style)
                    ],
                }
            )
            return

        blip = container.find(f".//{_A}blip")
        doc_pr = container.find(f"{_WP}docPr")
        context.add(
            {
                "type": "image",
                "src": self._image_src(context.part, blip.get(f"{_R}embed") if blip is not None else None),
                "width": width or 0,
                "height": height or 0,
                "position": position,
                "alt": (doc_pr.get("descr") or doc_pr.get("title") or "") if doc_pr is not None else "",
            }
        )

    @staticmethod
    def _anchor(anchor) -> dict:
        def axis(tag: str) -> dict:
            element = anchor.find(f"{_WP}{tag}")
            if element is None:
                return {"relative": "column", "offset": 0.0, "align": None}
            offset = element.find(f"{_WP}posOffset")
            align = element.find(f"{_WP}align")
            return {
                "relative": element.get("relativeFrom") or "column",
                "offset": _pt(offset.text, _EMU_PER_PT) if offset is not None and offset.text else 0.0,
                "align": align.text if align is not None else None,
            }

        wrap = "none"
        for name in ("wrapSquare", "wrapTight", "wrapThrough", "wrapTopAndBottom", "wrapNone"):
            if anchor.find(f"{_WP}{name}") is not None:
                wrap = name.removeprefix("wrap").lower()
                break
        return {
            "x": axis("positionH"),
            "y": axis("positionV"),
            "wrap": wrap,
            "behind": anchor.get("behindDoc") in ("1", "true"),
        }

    @staticmethod
    def _shape_fill(shape) -> str | None:
        if shape is None:
            return None
        fill = shape.find(f"{_A}solidFill/{_A}srgbClr")
        return _hex(fill.get("val")) if fill is not None else None

    @staticmethod
    def _shape_line(shape) -> dict | None:
        if shape is None:
            return None
        line = shape.find(f"{_A}ln")
        if line is None or line.find(f"{_A}noFill") is not None:
            return None
        color = line.find(f"{_A}solidFill/{_A}srgbClr")
        width = line.get("w")
        return {
            "width": _pt(width, _EMU_PER_PT) if width else 0.75,
            "color": _hex(color.get("val")) if color is not None else "#000000",
            "style": "solid",
        }

    def _vml(self, pict, context: "_Walk") -> None:
        for shape in pict.iter(f"{_V}shape", f"{_V}rect", f"{_V}roundrect"):
            size = _vml_size(shape.get("style") or "")
            textbox = shape.find(f".//{qn('w:txbxContent')}")
            if textbox is not None:
                context.frames.append(
                    {
                        "type": "frame",
                        "width": size[0],
                        "height": size[1],
                        "position": None,
                        "fill": _hex((shape.get("fillcolor") or "").lstrip("#")),
                        "border": None,
                        "blocks": [
                            block
                            for child in textbox.iterchildren()
                            for block in self._block(child, context.part, context.table_style)
                        ],
                    }
                )
                continue
            data = shape.find(f"{_V}imagedata")
            if data is not None:
                context.add(
                    {
                        "type": "image",
                        "src": self._image_src(context.part, data.get(f"{_R}id")),
                        "width": size[0],
                        "height": size[1],
                        "position": None,
                        "alt": "",
                    }
                )

    # ------------------------------------------------------------------ tables

    def _table(self, tbl, part) -> dict:
        tbl_pr = tbl.find(qn("w:tblPr"))
        style_id = _val(tbl_pr.find(qn("w:tblStyle"))) if tbl_pr is not None else None
        layers = [s.find(qn("w:tblPr")) for s in self._style_chain(style_id)]
        layers = [layer for layer in [*layers, tbl_pr] if layer is not None]

        borders: dict = {}
        margins = {"top": 0.0, "right": 5.4, "bottom": 0.0, "left": 5.4}
        align = "left"
        indent = 0.0
        for layer in layers:
            tbl_borders = layer.find(qn("w:tblBorders"))
            if tbl_borders is not None:
                for side in ("top", "left", "bottom", "right", "insideH", "insideV", "start", "end"):
                    element = tbl_borders.find(qn(f"w:{side}"))
                    if element is not None:
                        name = {"start": "left", "end": "right"}.get(side, side)
                        borders[name] = _border(element)
            cell_margins = layer.find(qn("w:tblCellMar"))
            if cell_margins is not None:
                margins.update(self._margins(cell_margins))
            jc = _val(layer.find(qn("w:jc")))
            if jc:
                align = {"center": "center", "right": "right", "end": "right"}.get(jc, "left")
            ind = _pt(_val(layer.find(qn("w:tblInd")), "w:w"))
            if ind is not None:
                indent = ind

        columns = [
            _pt(_val(col, "w:w")) or 0.0
            for col in tbl.iterfind(f"{qn('w:tblGrid')}/{qn('w:gridCol')}")
        ]

        # Rows and cells, with the grid column each cell starts at.
        grid: list[list[dict]] = []
        for tr in self._rows(tbl):
            tr_pr = tr.find(qn("w:trPr"))
            height = tr_pr.find(qn("w:trHeight")) if tr_pr is not None else None
            before = tr_pr.find(qn("w:gridBefore")) if tr_pr is not None else None
            col = int(_val(before) or 0)
            cells = []
            for tc in self._cells(tr):
                tc_pr = tc.find(qn("w:tcPr"))
                span = int(_val(tc_pr.find(qn("w:gridSpan"))) or 1) if tc_pr is not None else 1
                v_merge = tc_pr.find(qn("w:vMerge")) if tc_pr is not None else None
                cells.append(
                    {
                        "tc": tc,
                        "tc_pr": tc_pr,
                        "col": col,
                        "span": span,
                        "merge": None if v_merge is None else (_val(v_merge) or "continue"),
                    }
                )
                col += span
            grid.append(
                {
                    "height": _pt(_val(height)) if height is not None else None,
                    "rule": (_val(height, "w:hRule") or "atLeast") if height is not None else "auto",
                    "header": tr_pr is not None and _on(tr_pr.find(qn("w:tblHeader"))) is True,
                    "cells": cells,
                }
            )

        count = max([len(columns), *(sum(c["span"] for c in row["cells"]) + row["cells"][0]["col"] if row["cells"] else 0 for row in grid)], default=0)
        while len(columns) < count:
            columns.append(columns[-1] if columns else 72.0)
        row_count = len(grid)

        rows = []
        for index, row in enumerate(grid):
            cells = []
            for cell in row["cells"]:
                if cell["merge"] == "continue":
                    continue
                row_span = 1
                if cell["merge"] == "restart":
                    for below in grid[index + 1 :]:
                        if any(c["col"] == cell["col"] and c["merge"] == "continue" for c in below["cells"]):
                            row_span += 1
                        else:
                            break
                cells.append(
                    self._cell(cell, index, row_span, row_count, count, borders, margins, style_id, part, columns)
                )
            rows.append(
                {
                    "height": row["height"],
                    "rule": "atLeast" if row["rule"] == "exact" else row["rule"],
                    "header": row["header"],
                    "cells": cells,
                }
            )

        # Adjacent cells share an edge: draw the stronger of the two borders.
        edges: dict[tuple, dict | None] = {}
        for index, row in enumerate(rows):
            for cell in row["cells"]:
                for r in range(index, index + cell["row_span"]):
                    edges[("right", r, cell["col"] + cell["span"])] = cell["borders"]["right"]
                for c in range(cell["col"], cell["col"] + cell["span"]):
                    edges[("bottom", index + cell["row_span"], c)] = cell["borders"]["bottom"]
        for index, row in enumerate(rows):
            for cell in row["cells"]:
                cell["borders"]["left"] = _stronger(cell["borders"]["left"], edges.get(("right", index, cell["col"])))
                cell["borders"]["top"] = _stronger(cell["borders"]["top"], edges.get(("bottom", index, cell["col"])))

        return {
            "type": "table",
            "columns": columns,
            "align": align,
            "indent": indent,
            "rows": rows,
        }

    @staticmethod
    def _rows(tbl) -> list:
        rows = []
        for child in tbl.iterchildren():
            if child.tag == qn("w:tr"):
                rows.append(child)
            elif child.tag == qn("w:sdt"):
                content = child.find(qn("w:sdtContent"))
                rows.extend(content.iterfind(qn("w:tr")) if content is not None else [])
        return rows

    @staticmethod
    def _cells(tr) -> list:
        cells = []
        for child in tr.iterchildren():
            if child.tag == qn("w:tc"):
                cells.append(child)
            elif child.tag == qn("w:sdt"):
                content = child.find(qn("w:sdtContent"))
                cells.extend(content.iterfind(qn("w:tc")) if content is not None else [])
        return cells

    @staticmethod
    def _margins(element) -> dict:
        result = {}
        for side, names in (("top", ("top",)), ("bottom", ("bottom",)), ("left", ("left", "start")), ("right", ("right", "end"))):
            for name in names:
                found = element.find(qn(f"w:{name}"))
                if found is not None and _val(found, "w:type") in (None, "dxa"):
                    value = _pt(_val(found, "w:w"))
                    if value is not None:
                        result[side] = value
        return result

    def _cell(self, cell, row: int, row_span: int, row_count: int, col_count: int, borders: dict, margins: dict, style_id, part, columns) -> dict:
        tc_pr = cell["tc_pr"]
        col, span = cell["col"], cell["span"]
        edge = {
            "top": borders.get("top") if row == 0 else borders.get("insideH"),
            "bottom": borders.get("bottom") if row + row_span >= row_count else borders.get("insideH"),
            "left": borders.get("left") if col == 0 else borders.get("insideV"),
            "right": borders.get("right") if col + span >= col_count else borders.get("insideV"),
        }
        cell_margins = dict(margins)
        shading = None
        valign = "top"
        if tc_pr is not None:
            tc_borders = tc_pr.find(qn("w:tcBorders"))
            if tc_borders is not None:
                for side in ("top", "bottom", "left", "right", "start", "end"):
                    element = tc_borders.find(qn(f"w:{side}"))
                    if element is not None:
                        edge[{"start": "left", "end": "right"}.get(side, side)] = _border(element)
            tc_mar = tc_pr.find(qn("w:tcMar"))
            if tc_mar is not None:
                cell_margins.update(self._margins(tc_mar))
            shading = _shading(tc_pr.find(qn("w:shd")))
            valign = {"center": "center", "bottom": "bottom"}.get(_val(tc_pr.find(qn("w:vAlign"))), "top")
        return {
            "col": col,
            "span": span,
            "row_span": row_span,
            "width": round(sum(columns[col : col + span]), 2),
            "shading": shading,
            "valign": valign,
            "margin": cell_margins,
            "borders": edge,
            "blocks": [
                block
                for child in cell["tc"].iterchildren()
                for block in self._block(child, part, style_id)
            ],
        }


class _Walk:
    """State while reading the content of one paragraph."""

    def __init__(self, paragraph: dict, frames: list, part, style_id, table_style):
        self.paragraph = paragraph
        self.frames = frames
        self.part = part
        self.style_id = style_id
        self.table_style = table_style
        self.placed: set[str] = set()
        self.field: dict | None = None

    def add(self, part: dict) -> None:
        self.paragraph["parts"].append(part)

    def add_text(self, text: str, style: dict) -> None:
        parts = self.paragraph["parts"]
        if parts and parts[-1]["type"] == "text" and parts[-1]["run"] == style:
            parts[-1]["text"] += text
        else:
            parts.append({"type": "text", "text": text, "run": style})


def _intern_runs(layout: dict) -> list[dict]:
    """Replace every "run" style in the layout by its index in the returned list."""
    styles: list[dict] = []
    index: dict[tuple, int] = {}

    def intern(style: dict) -> int:
        style = {name: value for name, value in style.items() if name != "hidden"}
        key = tuple(sorted(style.items()))
        if key not in index:
            index[key] = len(styles)
            styles.append(style)
        return index[key]

    def visit(value) -> None:
        if isinstance(value, dict):
            for name, item in value.items():
                if name == "run" and isinstance(item, dict):
                    value[name] = intern(item)
                else:
                    visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    visit(layout)
    return styles


def _field_name(instr: str) -> str | None:
    word = instr.strip().split(" ", 1)[0].upper() if instr.strip() else ""
    return {"PAGE": "page", "NUMPAGES": "pages", "SECTIONPAGES": "pages"}.get(word)


def _vml_size(style: str) -> tuple[float, float]:
    values = {}
    for item in style.split(";"):
        if ":" not in item:
            continue
        name, value = item.split(":", 1)
        match = re.fullmatch(r"\s*([\d.]+)\s*(pt|in|px|cm|mm)?\s*", value)
        if not match:
            continue
        number = float(match.group(1))
        unit = match.group(2) or "pt"
        values[name.strip()] = number * {"pt": 1, "in": 72, "px": 0.75, "cm": 28.3465, "mm": 2.83465}[unit]
    return round(values.get("width", 0), 2), round(values.get("height", 0), 2)
