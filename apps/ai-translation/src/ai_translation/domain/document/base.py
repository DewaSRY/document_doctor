import re
from abc import ABC, abstractmethod

# A sentence ends at . ! ? followed by whitespace and a letter, or at a CJK full stop.
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[\"'“‘(\[]?[^\W\d_])|(?<=[。！？])")
# A short capitalised word before the dot is an abbreviation ("Jl.", "Dr.", "No."), not a sentence end.
_ABBREVIATION = re.compile(r"(?:^|\s)(?:[A-Z][a-z]{0,2}|[a-z]\.[a-z])\.$")


class DocumentHandler(ABC):
    """Abstract base class for document handlers."""

    @abstractmethod
    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract text from document, preserving structure info."""

    @abstractmethod
    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
        styles: dict[str, dict] | None = None,
    ) -> bytes:
        """Create translated document preserving original structure.

        styles: optional per-segment style overrides, by key (PDF only).
        """

    @staticmethod
    def _segment_text(text: str) -> list[str]:
        """Segment text into sentences."""
        sentences: list[str] = []
        for part in _SENTENCE_END.split(text.strip()):
            part = part.strip()
            if not part:
                continue
            if sentences and _ABBREVIATION.search(sentences[-1]):
                sentences[-1] = f"{sentences[-1]} {part}"
            else:
                sentences.append(part)
        return sentences
