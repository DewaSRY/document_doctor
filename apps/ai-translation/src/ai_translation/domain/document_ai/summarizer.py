import re
from dataclasses import dataclass

from ai_translation.domain.translation import TranslationParams, get_translator

from .text import chunk_paragraphs

# Number of key points for each summary length.
KEY_POINTS = {"short": 3, "medium": 5, "detailed": 8}

_BULLET = re.compile(r"^\s*(?:[-*•·]|\d+[.)])\s+(.*\S)\s*$")


@dataclass
class Summary:
    overview: str
    key_points: list[str]
    truncated: bool


def _parse_bullets(text: str) -> list[str]:
    bullets = [match.group(1) for line in text.splitlines() if (match := _BULLET.match(line))]
    # Small models sometimes answer with plain lines instead of a list.
    if not bullets:
        bullets = [line.strip() for line in text.splitlines() if len(line.strip()) > 3]
    return list(dict.fromkeys(bullets))


def summarize(paragraphs: list[str], length: str, language_name: str | None) -> Summary:
    """
    Summarize a document map-reduce style: key points per chunk, then one
    overview and a condensed list of key points for the whole document.

    The summary is written in the document's language, then translated when
    another language is asked for: the small model follows a translation
    prompt far more reliably than "summarize in <language>".
    """
    chunks, truncated = chunk_paragraphs(paragraphs)
    if not chunks:
        return Summary(overview="", key_points=[], truncated=False)

    count = KEY_POINTS.get(length, KEY_POINTS["medium"])
    language = "Write in the same language as the document."
    model = get_translator()

    per_chunk = max(2, count if len(chunks) == 1 else count // 2 + 1)
    chunk_notes = model.chat_batch(
        [
            [
                {
                    "role": "system",
                    "content": (
                        "You summarize documents. "
                        f"List the {per_chunk} most important points of the text as a bulleted list, "
                        "one short sentence per point, each line starting with '- '. "
                        f"{language} Output only the list."
                    ),
                },
                {"role": "user", "content": chunk},
            ]
            for chunk in chunks
        ],
        max_new_tokens=60 * per_chunk,
    )
    points = [point for notes in chunk_notes for point in _parse_bullets(notes)]
    notes_text = "\n".join(f"- {point}" for point in points)

    conversations = [
        [
            {
                "role": "system",
                "content": (
                    "You summarize documents. Using the notes about a document, write one "
                    f"paragraph of 2 to {count // 2 + 3} sentences that says what the document is about "
                    f"and its main conclusions. {language} Output only the paragraph."
                ),
            },
            {"role": "user", "content": notes_text},
        ]
    ]
    condense = len(points) > count
    if condense:
        conversations.append(
            [
                {
                    "role": "system",
                    "content": (
                        "You summarize documents. Merge the notes into the "
                        f"{count} most important points, as a bulleted list, one short sentence per point, "
                        f"each line starting with '- '. {language} Output only the list."
                    ),
                },
                {"role": "user", "content": notes_text},
            ]
        )

    results = model.chat_batch(conversations, max_new_tokens=384)
    key_points = _parse_bullets(results[1])[:count] if condense else points

    overview = results[0].strip()

    if language_name:
        translated = model.translate_batch(
            [
                TranslationParams(text=text, source_language="", target_language=language_name)
                for text in [overview, *key_points]
            ]
        )
        overview, key_points = translated[0], translated[1:]

    return Summary(overview=overview, key_points=key_points, truncated=truncated)
