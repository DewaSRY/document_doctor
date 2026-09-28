import json
import re
from dataclasses import dataclass

from ai_translation.domain.translation import get_translator

from .text import chunk_paragraphs

# Fields the model looks for. Contact details are found with patterns, which
# is more reliable than a small model.
MODEL_FIELDS = ["people", "organizations", "dates", "amounts", "locations"]
PATTERN_FIELDS = {
    "emails": re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    "urls": re.compile(r"https?://[^\s<>()\"']+[^\s<>()\"'.,;:!?]"),
    # Starts with +, ( or 0 so plain numbers and amounts are not matched.
    "phone_numbers": re.compile(r"(?<!\w)(?<!\d[.,])(?:\+|\(|0)[\d\s()-]{7,}\d(?!\w|[.,]\d)"),
}
_MIN_PHONE_DIGITS = 8
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
FIELDS = MODEL_FIELDS + list(PATTERN_FIELDS)

_SYSTEM_PROMPT = (
    "You extract information from documents. Read the text and return a JSON object "
    "with exactly these keys: "
    '"people" (names of people), "organizations" (companies and institutions), '
    '"dates" (dates and periods), "amounts" (money, quantities and percentages), '
    '"locations" (places and addresses). '
    "Each value is a list of strings copied exactly from the text. "
    "Use an empty list when nothing is found. Output only the JSON object."
)


@dataclass
class Extraction:
    fields: dict[str, list[str]]
    truncated: bool


def _parse_json_object(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        value = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _normalize(value: str) -> str:
    return " ".join(value.split()).casefold()


def _add_unique(target: list[str], seen: set[str], value: str) -> None:
    key = _normalize(value)
    if key and key not in seen:
        seen.add(key)
        target.append(" ".join(value.split()))


def extract(paragraphs: list[str]) -> Extraction:
    """Extract people, organizations, dates, amounts, places and contact details."""
    chunks, truncated = chunk_paragraphs(paragraphs)
    fields: dict[str, list[str]] = {field: [] for field in FIELDS}
    seen: dict[str, set[str]] = {field: set() for field in FIELDS}

    if chunks:
        answers = get_translator().chat_batch(
            [
                [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": chunk},
                ]
                for chunk in chunks
            ],
            max_new_tokens=512,
        )
        for chunk, answer in zip(chunks, answers):
            parsed = _parse_json_object(answer)
            chunk_text = _normalize(chunk)
            for field in MODEL_FIELDS:
                values = parsed.get(field)
                if not isinstance(values, list):
                    continue
                for value in values:
                    # Keep only values that really occur in the text.
                    if isinstance(value, str) and _normalize(value) in chunk_text:
                        _add_unique(fields[field], seen[field], value)

    # Patterns are cheap, so they run on the whole document.
    text = "\n".join(paragraphs)
    for field, pattern in PATTERN_FIELDS.items():
        for match in pattern.finditer(text):
            value = match.group(0).strip()
            if field == "phone_numbers" and (
                sum(char.isdigit() for char in value) < _MIN_PHONE_DIGITS or _ISO_DATE.match(value)
            ):
                continue
            _add_unique(fields[field], seen[field], value)

    return Extraction(fields=fields, truncated=truncated)
